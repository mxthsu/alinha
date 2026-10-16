"""LangGraph review assistant: generate -> verify grounded claims -> present for approval.

The assistant never mutates ResumeProfile. Users manually incorporate any
suggested wording; an unsupported claim is never promoted to a valid revision.
"""
from collections.abc import Callable
from typing import TypedDict

from langgraph.graph import END, START, StateGraph

from alinha_api.resume_schema import ResumeReviewResult, ReviewSuggestion
from alinha_api.schemas import AnalysisResult


class ReviewState(TypedDict, total=False):
    resume_text: str
    job_description: str
    analysis: AnalysisResult
    review: ResumeReviewResult


def build_resume_review_workflow(
    analyze: Callable[[str, str], AnalysisResult],
):
    def analyze_job(state: ReviewState) -> dict:
        return {"analysis": analyze(state["resume_text"], state["job_description"])}

    def prepare_review(state: ReviewState) -> dict:
        report = state["analysis"]
        suggestions = []
        for item in report.requirements[:12]:
            # AnalysisResult has already validated every job quote. We verify
            # existing resume citations again before exposing review guidance.
            from alinha_api.services.analysis import evidence_exists
            if item.resume_evidence and not evidence_exists(
                item.resume_evidence, state["resume_text"]
            ):
                continue
            if not evidence_exists(item.job_evidence, state["job_description"]):
                continue
            suggestions.append(ReviewSuggestion(
                requirement=item.requirement,
                job_evidence=item.job_evidence,
                resume_evidence=item.resume_evidence,
                status=item.status,
                guidance=item.recommendation,
            ))
        return {"review": ResumeReviewResult(
            summary=report.summary,
            suggestions=suggestions,
            limitations=[
                *report.limitations,
                "Sugestões geradas por IA: confirme os fatos antes de modificar seu perfil.",
                "Nenhuma alteração foi aplicada automaticamente.",
            ],
        )}

    builder = StateGraph(ReviewState)
    builder.add_node("analyze_with_model", analyze_job)
    builder.add_node("verify_and_prepare", prepare_review)
    builder.add_edge(START, "analyze_with_model")
    builder.add_edge("analyze_with_model", "verify_and_prepare")
    builder.add_edge("verify_and_prepare", END)
    return builder.compile()

"""Explicit LangGraph pipeline: model generation followed by evidence verification."""
from typing import TypedDict

from langgraph.graph import END, START, StateGraph

from alinha_api.schemas import AnalysisDraft, AnalysisResult
from alinha_api.services.analysis import validate_draft
from alinha_api.services.provider import AnalysisProvider


class AnalysisState(TypedDict, total=False):
    resume_text: str
    job_description: str
    draft: AnalysisDraft
    result: AnalysisResult


def build_workflow(provider: AnalysisProvider):
    def generate(state: AnalysisState) -> dict:
        return {
            "draft": provider.analyze(state["resume_text"], state["job_description"])
        }

    def verify(state: AnalysisState) -> dict:
        return {
            "result": validate_draft(
                state["draft"], state["resume_text"], state["job_description"]
            )
        }

    graph = StateGraph(AnalysisState)
    graph.add_node("generate", generate)
    graph.add_node("verify_evidence", verify)
    graph.add_edge(START, "generate")
    graph.add_edge("generate", "verify_evidence")
    graph.add_edge("verify_evidence", END)
    return graph.compile()

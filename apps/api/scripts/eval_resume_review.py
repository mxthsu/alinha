"""Offline grounding evaluation for the Studio review workflow.

Synthetic fixtures only; no model calls or real credentials. This evaluates the
deterministic safety gate, NOT the semantic accuracy of Gemini/Claude.
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from alinha_api.schemas import AnalysisResult, RequirementDraft
from alinha_api.services.analysis import evidence_exists
from alinha_api.workflows.resume_review import build_resume_review_workflow

DATASET = [
    {
        "resume": "Sou desenvolvedora Python e criei testes automatizados com pytest.",
        "job": "Vaga fictícia: experiência em Python e FastAPI e testes automatizados.",
        "good": RequirementDraft(
            requirement="Python", job_evidence="experiência em Python",
            resume_evidence="desenvolvedora Python", status="evidenciado",
            recommendation="Mostre os projetos reais em Python.",
        ),
        "bad": RequirementDraft(
            requirement="AWS", job_evidence="certificação AWS",
            resume_evidence="certificação AWS", status="evidenciado",
            recommendation="Adicione certificação AWS.",
        ),
    },
    {
        "resume": "Currículo fictício: usei bancos SQL em aplicações internas.",
        "job": "Vaga fictícia: conhecimento em SQL e administração Kubernetes.",
        "good": RequirementDraft(
            requirement="SQL", job_evidence="conhecimento em SQL",
            resume_evidence="bancos SQL", status="parcial",
            recommendation="Explique apenas aplicações reais com SQL.",
        ),
        "bad": RequirementDraft(
            requirement="Kubernetes", job_evidence="administração Kubernetes",
            resume_evidence="experiência inventada com Kubernetes",
            status="evidenciado",
            recommendation="Afirme experiência com Kubernetes.",
        ),
    },
]


def evaluate() -> dict:
    total = 0
    accepted = 0
    fabricated_accepted = 0
    human_gate_count = 0
    calls = 0
    for fixture in DATASET:
        def analyzer(_resume, _job, source=fixture):
            nonlocal calls
            calls += 1
            return AnalysisResult(
                job_title="Oportunidade fictícia", summary="Resumo sintético",
                requirements=[source["good"], source["bad"]],
                limitations=["Resultado de teste."],
            )

        result = build_resume_review_workflow(analyzer).invoke({
            "resume_text": fixture["resume"], "job_description": fixture["job"],
        })["review"]
        total += 2
        accepted += len(result.suggestions)
        human_gate_count += sum(item.approval_required for item in result.suggestions)
        for item in result.suggestions:
            if not evidence_exists(item.job_evidence, fixture["job"]):
                fabricated_accepted += 1
            if item.resume_evidence and not evidence_exists(
                item.resume_evidence, fixture["resume"]
            ):
                fabricated_accepted += 1
    return {
        "dataset": "2 casos inteiramente sintéticos",
        "metric_scope": "verificador determinístico, não qualidade semântica do modelo",
        "candidate_claims": total,
        "review_suggestions_accepted": accepted,
        "fabricated_citations_passed": fabricated_accepted,
        "approval_required_rate": round(human_gate_count / accepted, 3) if accepted else 1.0,
        "provider_calls": 0,
        "simulated_analyzer_calls": calls,
    }


if __name__ == "__main__":
    result = evaluate()
    print(json.dumps(result, ensure_ascii=False, indent=2))
    if result["fabricated_citations_passed"] != 0 or result["provider_calls"] != 0:
        raise SystemExit(1)

"""Contract and evidence verification tests; no network or real user data."""
from fastapi.testclient import TestClient

from alinha_api.main import app
from alinha_api.schemas import AnalysisDraft, RequirementDraft
from alinha_api.services.analysis import validate_draft
from alinha_api.services.document_reader import extract_resume
from alinha_api.workflows.analysis import build_workflow

RESUME = (
    "Ana Souza desenvolveu APIs em Python com FastAPI, testes automatizados "
    "e realizou manutenção de sistemas empresariais."
)
VACANCY = (
    "Vaga: Pessoa Desenvolvedora Backend. Necessário experiência com Python e FastAPI. "
    "Desejável familiaridade com Kubernetes e observabilidade em produção."
)


class FakeProvider:
    def analyze(self, resume_text: str, job_description: str) -> AnalysisDraft:
        return AnalysisDraft(
            job_title="Pessoa Desenvolvedora Backend",
            requirements=[
                RequirementDraft(
                    requirement="Python e FastAPI",
                    job_evidence="experiência com Python e FastAPI",
                    status="evidenciado",
                    resume_evidence="APIs em Python com FastAPI",
                    recommendation="Detalhe os resultados obtidos com essas APIs.",
                ),
                RequirementDraft(
                    requirement="Kubernetes",
                    job_evidence="familiaridade com Kubernetes",
                    status="evidenciado",
                    resume_evidence="Kubernetes em produção",  # Not in resume.
                    recommendation="Mostre uma implantação Kubernetes.",
                ),
                RequirementDraft(
                    requirement="Requisito inventado",
                    job_evidence="experiência com Rust",  # Not in vacancy.
                    status="evidenciado",
                    resume_evidence="APIs em Python",
                    recommendation="Detalhe.",
                ),
            ],
        )


def test_workflow_rejects_unverifiable_evidence():
    state = build_workflow(FakeProvider()).invoke(
        {"resume_text": RESUME, "job_description": VACANCY}
    )
    result = state["result"]
    assert len(result.requirements) == 2
    assert result.requirements[0].status == "evidenciado"
    assert result.requirements[1].status == "nao_identificado"
    assert result.requirements[1].resume_evidence is None
    assert "1 com evidências no currículo" in result.summary


def test_draft_with_no_job_evidence_is_rejected():
    draft = AnalysisDraft(
        job_title="Backend",
        requirements=[
            RequirementDraft(
                requirement="Rust",
                job_evidence="Obrigatório Rust",
                status="nao_identificado",
                recommendation="Não afirmar experiência inexistente.",
            )
        ],
    )
    import pytest

    with pytest.raises(ValueError, match="verificado"):
        validate_draft(draft, RESUME, VACANCY)


def test_in_memory_text_extraction():
    assert extract_resume("curriculo.txt", RESUME.encode("utf-8")) == RESUME


def test_invalid_extension_is_rejected():
    import pytest

    with pytest.raises(ValueError, match="Formato inválido"):
        extract_resume("curriculo.exe", b"definitely not a resume")


def test_health():
    response = TestClient(app).get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_missing_ai_configuration_does_not_simulate_analysis(monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    response = TestClient(app).post(
        "/api/v1/analyses/text",
        json={"resume_text": RESUME, "job_description": VACANCY},
    )
    assert response.status_code == 503


def test_invalid_pdf_is_rejected():
    response = TestClient(app).post(
        "/api/v1/analyses/upload",
        files={"file": ("cv.pdf", b"not-a-real-pdf", "application/pdf")},
        data={"job_description": VACANCY},
    )
    assert response.status_code == 422

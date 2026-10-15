"""Synthetic evidence recovery scenarios; absolutely no live candidate data."""
import pytest

from alinha_api.schemas import AnalysisDraft, RequirementDraft
from alinha_api.services.analysis import evidence_exists, validate_draft
from alinha_api.services.evidence_quotes import literal_or_recovered


def item(requirement, job_evidence, resume_evidence=None, status="evidenciado"):
    return RequirementDraft(
        requirement=requirement,
        job_evidence=job_evidence,
        status=status,
        resume_evidence=resume_evidence,
        recommendation="Descreva apenas projetos reais relacionados à vaga.",
    )


def test_recovers_only_verbatim_vacancy_excerpt():
    vacancy = (
        "Sobre a empresa: Nossa missão é tornar processos mais claros.\n"
        "Requisitos da oportunidade:\n"
        "- Experiência profissional com Python e FastAPI na construção de serviços.\n"
        "- Conhecimentos em testes automatizados com pytest e documentação técnica.\n"
        "Conheça nosso site: https://example.org"
    )
    curriculum = "Atuei em projetos Python e FastAPI no desenvolvimento de serviços internos."
    draft = AnalysisDraft(job_title="Engenheiro Backend", requirements=[
        item(
            "Python e FastAPI",
            "Experiência comprovada na construção de serviços Python e FastAPI.",
            "projetos Python e FastAPI",
        ),
    ])
    result = validate_draft(draft, curriculum, vacancy)
    assert len(result.requirements) == 1
    evidence = result.requirements[0].job_evidence
    assert evidence in vacancy
    assert "Python e FastAPI" in evidence
    assert result.requirements[0].status == "evidenciado"


def test_unrelated_or_invented_requirements_remain_rejected():
    vacancy = "- Experiência em Python e FastAPI para desenvolvimento de APIs.\n"
    draft = AnalysisDraft(job_title="Backend", requirements=[
        item("Kubernetes e AWS", "Kubernetes e AWS para infraestrutura em nuvem."),
    ])
    with pytest.raises(ValueError, match="verificado"):
        validate_draft(draft, "Experiência em Kubernetes e AWS.", vacancy)


def test_invalid_resume_citation_is_downgraded_not_fabricated():
    vacancy = "Requisitos:\n- Experiência com Python e FastAPI em aplicações web.\n"
    draft = AnalysisDraft(job_title="Backend", requirements=[
        item(
            "Python e FastAPI",
            "Experiência comprovada com Python e FastAPI em aplicações web.",
            "Fui responsável por grandes projetos Python em produção.",
        ),
    ])
    result = validate_draft(draft, "Tenho experiência em suporte a sistemas legados.", vacancy)
    assert result.requirements[0].job_evidence in vacancy
    assert result.requirements[0].status == "nao_identificado"
    assert result.requirements[0].resume_evidence is None


def test_ambiguous_clauses_do_not_get_arbitrary_recovery():
    vacancy = (
        "- Experiência com Python e FastAPI para sistemas financeiros.\n"
        "- Experiência com Python e FastAPI para sistemas educacionais.\n"
    )
    assert literal_or_recovered(
        "Experiência comprovada com Python e FastAPI",
        "Python e FastAPI",
        vacancy,
    ) is None


def test_handles_literal_quote_with_accents_and_line_wraps():
    vacancy = "Necessário domínio de \nPython e FastAPI para a vaga."
    quote = "necessario dominio de Python e FastAPI"
    assert evidence_exists(quote, vacancy)
    assert literal_or_recovered(quote, "Python e FastAPI", vacancy) is not None


def test_long_unstructured_input_never_returns_fabricated_quote():
    vacancy = (
        "Informações gerais sobre nossa cultura, benefícios, produtos e tecnologia. "
        * 18
    )
    assert literal_or_recovered(
        "Experiência com Kubernetes e Terraform",
        "Kubernetes e Terraform",
        vacancy,
    ) is None


def test_api_returns_specific_error_when_all_quotes_unverifiable(monkeypatch):
    from fastapi.testclient import TestClient

    from alinha_api.main import app

    class FakeUnverifiedProvider:
        def analyze(self, *_):
            return AnalysisDraft(
                job_title="Pessoa Backend",
                requirements=[item(
                    "Kubernetes e AWS",
                    "Necessário Kubernetes e AWS para infraestrutura em nuvem.",
                    None,
                    "nao_identificado",
                )],
            )

    monkeypatch.setattr("alinha_api.main.api_key", lambda _: "synthetic-only")
    monkeypatch.setattr("alinha_api.main.GeminiProvider", FakeUnverifiedProvider)
    response = TestClient(app).post(
        "/api/v1/analyses/text",
        json={
            "resume_text": "Currículo de teste: Python e FastAPI, análise de requisitos e documentação.",
            "job_description": "Vaga de teste pede Python e FastAPI para criação de APIs e documentação.",
            "provider": "gemini",
        },
    )
    assert response.status_code == 422
    assert "citações" in response.json()["detail"]
    assert "Revise os textos" not in response.json()["detail"]


def test_workflow_repairs_quote_without_another_ai_call():
    from alinha_api.workflows.analysis import build_workflow

    vacancy = "- Profissional com experiência prática em Python e FastAPI para APIs."
    resume = "Trabalhei com Python e FastAPI em sistemas corporativos."
    class FakeProvider:
        calls = 0

        def analyze(self, *_):
            self.calls += 1
            return AnalysisDraft(
                job_title="Pessoa Backend",
                requirements=[
                    item(
                        "Python e FastAPI",
                        "Experiência profissional comprovada em Python e FastAPI.",
                        "Python e FastAPI",
                    ),
                ],
            )

    provider = FakeProvider()
    result = build_workflow(provider).invoke(
        {"resume_text": resume, "job_description": vacancy}
    )["result"]
    assert provider.calls == 1
    assert result.requirements[0].status == "evidenciado"
    assert result.requirements[0].job_evidence in vacancy

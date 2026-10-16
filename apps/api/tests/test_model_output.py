"""Lenient Gemini response parsing without weakening verified evidence."""
from types import SimpleNamespace

import pytest

from alinha_api.services import provider as provider_module
from alinha_api.services.analysis import validate_draft
from alinha_api.services.model_output import ModelOutputError, parse_model_output
from alinha_api.services.provider import GeminiProvider


def test_overlong_model_fields_are_clipped_before_strict_validation():
    raw = {
        "job_title": "Vaga fictícia " * 30,
        "requirements": [
            {
                "requirement": "Python com FastAPI" * 20,
                "job_evidence": "Experiência em Python e FastAPI " * 20,
                "status": "evidenciado",
                "resume_evidence": "Criei APIs Python e FastAPI." * 20,
                "recommendation": "Descreva apenas a experiência verdadeira. " * 20,
            }
        ],
    }
    draft = parse_model_output(raw)
    assert len(draft.job_title) <= 130
    assert len(draft.requirements[0].job_evidence) <= 300
    assert len(draft.requirements[0].recommendation) <= 450
    assert len(draft.requirements[0].requirement) <= 180


def test_partial_entries_are_skipped_without_inventing_evidence():
    raw = {
        "job_title": None,
        "requirements": [
            {"requirement": "Kubernetes", "job_evidence": None, "status": "evidenciado"},
            {
                "requirement": "Python e FastAPI",
                "job_evidence": "- Experiência com Python e FastAPI em produção.",
                "status": "unknown",
                "recommendation": None,
                "resume_evidence": "Tenho experiência com Python.",
            },
        ],
    }
    draft = parse_model_output(raw)
    assert draft.job_title == "Oportunidade analisada"
    assert len(draft.requirements) == 1
    assert draft.requirements[0].status == "nao_identificado"
    assert draft.requirements[0].resume_evidence is None
    assert draft.requirements[0].recommendation
    result = validate_draft(
        draft,
        "Currículo fictício com experiência em Python.",
        "Descrição fictícia:\n- Experiência com Python e FastAPI em produção.",
    )
    assert result.requirements[0].status == "nao_identificado"


def test_all_missing_vacancy_quotes_raise_explained_format_error():
    with pytest.raises(ModelOutputError, match="citações"):
        parse_model_output(
            {"job_title": "Backend", "requirements": [{"requirement": "Python", "status": "evidenciado"}]}
        )


def test_invalid_json_does_not_leak_model_body():
    with pytest.raises(ModelOutputError, match="formato inválido"):
        parse_model_output('{"secret_document":"do not reveal",')


def test_gemini_provider_uses_lenient_wire_and_one_request(monkeypatch):
    seen = []

    class FakeClient:
        def __init__(self, *, http_options, **_):
            seen.append(http_options.retry_options.attempts)
            self.models = SimpleNamespace(generate_content=self.generate)

        def __enter__(self):
            return self

        def __exit__(self, *_):
            return False

        @staticmethod
        def generate(*, config, **_):
            seen.append(config.response_schema.__name__)
            return SimpleNamespace(parsed={
                "job_title": "Backend",
                "requirements": [
                    {"requirement": "Infraestrutura não presente", "job_evidence": None},
                    {
                        "requirement": "Python e FastAPI",
                        "job_evidence": "- Experiência em Python e FastAPI.",
                        "resume_evidence": "Python e FastAPI",
                        "status": "evidenciado",
                        "recommendation": "Detalhe seus projetos reais.",
                    },
                ],
            })

    monkeypatch.setattr(provider_module, "reserve_gemini_request", lambda _: None)
    monkeypatch.setattr(provider_module.genai, "Client", FakeClient)
    draft = GeminiProvider(api_key="synthetic-not-a-real-key").analyze(
        "Criei soluções com Python e FastAPI.", "Vaga exige Python e FastAPI."
    )
    assert len(draft.requirements) == 1
    assert seen == [1, "ModelAnalysisResponse"]

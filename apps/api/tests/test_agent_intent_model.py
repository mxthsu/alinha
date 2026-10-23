"""No network, credentials, personal CVs or real job application submissions."""
import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from alinha_api import main
from alinha_api.agent.intent_model import (
    AnthropicIntentModel,
    IntentRequest,
    IntentSuggestion,
    IntentToolProposal,
    OpenAIIntentModel,
    _parse,
    validated_proposal,
)
from alinha_api.services.provider import ProviderError


class FakeAI:
    def __init__(self):
        self.calls = 0

    def propose(self, objective):
        assert objective == "Encontre vagas de Engenheiro de IA remoto"
        self.calls += 1
        return IntentSuggestion(
            role="Engenheiro de IA", reason="Cargo mencionado explicitamente no pedido."
        )


def client():
    return TestClient(main.app, base_url="http://127.0.0.1:8000",
                      client=("127.0.0.1", 42424))


def test_fake_provider_proposes_but_cannot_execute():
    fake = FakeAI()
    plan = validated_proposal(fake, "Encontre vagas de Engenheiro de IA remoto")
    assert fake.calls == 1
    assert plan.tool == "job.search"
    assert plan.query == "Engenheiro de IA"
    assert plan.needs_confirmation is True
    assert plan.executed is False
    assert plan.external_submission is False
    assert plan.model_calls == 1
    assert "application.submit" not in plan.model_dump_json()


def test_reject_malicious_model_tool_or_unknown_role():
    with pytest.raises(ValidationError):
        IntentToolProposal.model_validate({
            "tool": "application.submit", "query": "Engenheiro de IA",
            "reason": "unsafe", "needs_confirmation": False,
            "executed": True, "external_submission": True, "model_calls": 5,
        })
    with pytest.raises(ValueError):
        IntentSuggestion(role="https://attacker.example", reason="Link de outra fonte")
    with pytest.raises(ProviderError):
        _parse('{"role":"Engenheiro","reason":"x","exec":"application.submit"}')
    with pytest.raises(ProviderError):
        _parse("}" * 2501)


def test_request_strict_limits_and_no_resume_fields():
    with pytest.raises(ValueError):
        IntentRequest(objective="X"*401, provider="gemini")
    with pytest.raises(ValueError):
        IntentRequest(objective="Encontre vagas de Python", provider="fake")
    with pytest.raises(ValueError):
        IntentRequest.model_validate({
            "objective": "Encontre vagas de Python", "provider": "gemini",
            "resume": "INFORMAÇÃO PRIVADA DE CURRÍCULO",
        })


def test_route_requires_local_origin_and_never_runs_tools(monkeypatch):
    monkeypatch.setenv("ALINHA_DEPLOYMENT_MODE", "community")
    fake = FakeAI()
    monkeypatch.setitem(main.MODELS, "gemini", lambda: fake)
    with client() as c:
        response = c.post(
            "/api/v1/agent/interpret",
            headers={"Origin": "http://localhost:3000"},
            json={"objective": "Encontre vagas de Engenheiro de IA remoto", "provider": "gemini"},
        )
        assert response.status_code == 200, response.text
        assert response.json()["executed"] is False
        assert response.json()["tool"] == "job.search"
        assert response.headers["cache-control"] == "no-store"
        assert fake.calls == 1
        rejected = c.post(
            "/api/v1/agent/interpret",
            headers={"Origin": "https://attacker.example"},
            json={"objective": "Encontre vagas de Engenheiro de IA remoto", "provider": "gemini"},
        )
        assert rejected.status_code == 403
        assert fake.calls == 1


def test_cloud_is_forbidden_before_multitenant_auth(monkeypatch):
    monkeypatch.setenv("ALINHA_DEPLOYMENT_MODE", "cloud")
    fake = FakeAI()
    monkeypatch.setitem(main.MODELS, "gemini", lambda: fake)
    with client() as c:
        response = c.post(
            "/api/v1/agent/interpret",
            headers={"Origin": "http://localhost:3000"},
            json={"objective": "Encontre vagas de Engenheiro de IA remoto", "provider": "gemini"},
        )
        assert response.status_code == 403
        assert fake.calls == 0


def test_missing_provider_returns_only_safe_message(monkeypatch):
    monkeypatch.setenv("ALINHA_DEPLOYMENT_MODE", "community")
    class Failing:
        def propose(self, _):
            raise ProviderError("Conecte uma chave OpenAI API antes de interpretar o objetivo.")
    monkeypatch.setitem(main.MODELS, "openai_api", lambda: Failing())
    with client() as c:
        response = c.post("/api/v1/agent/interpret",
            headers={"Origin": "http://localhost:3000"},
            json={"objective": "Quero trabalhar com IA", "provider": "openai_api"})
    assert response.status_code == 422
    assert "chave OpenAI API" in response.json()["detail"]


def test_api_adapters_use_output_cap_and_no_retention(monkeypatch):
    seen={}
    monkeypatch.setattr(
        "alinha_api.agent.intent_model.saved_api_key", lambda provider:"synthetic-key"
    )
    class FakeResponse:
        def raise_for_status(self): pass
        def json(self):
            if "https://api.openai.com" in seen["url"]:
                return {"status":"completed","output":[{"content":[{
                    "type":"output_text","text":'{"role":"Engenheiro de IA","reason":"Cargo declarado"}'
                }]}]}
            return {"stop_reason":"end_turn","content":[{
                "type":"text","text":'{"role":"Engenheiro de IA","reason":"Cargo declarado"}'
            }]}
    def fake_post(url, **kwargs):
        seen.update(url=url,request=kwargs["json"])
        return FakeResponse()
    monkeypatch.setattr("alinha_api.agent.intent_model.httpx.post", fake_post)
    assert OpenAIIntentModel().propose("Busco IA").role=="Engenheiro de IA"
    assert seen["request"]["store"] is False
    assert seen["request"]["max_output_tokens"] == 260
    assert AnthropicIntentModel().propose("Busco IA").role=="Engenheiro de IA"
    assert seen["request"]["max_tokens"] == 260

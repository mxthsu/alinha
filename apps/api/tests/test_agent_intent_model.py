"""Opt-in career planning. Entirely fake, no live provider or external job calls."""
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from alinha_api import main
from alinha_api.agent.call_budget import reserve_call
from alinha_api.agent.intent_model import (
    AnthropicIntentModel,
    IntentRequest,
    IntentSuggestion,
    IntentToolProposal,
    OpenAIIntentModel,
    _parse,
    build_reviewed_plan,
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
            role="Engenheiro de IA",
            reason="Cargo mencionado explicitamente no pedido.",
        )


def client():
    return TestClient(
        main.app,
        base_url="http://127.0.0.1:8000",
        client=("127.0.0.1", 42424),
    )


def payload(provider="gemini", objective="Encontre vagas de Engenheiro de IA remoto",
            run_id=None, request_id=None, preview_requested=True):
    return {
        "run_id": str(run_id or uuid4()),
        "request_id": str(request_id or uuid4()),
        "objective": objective,
        "provider": provider,
        "preview_requested": preview_requested,
    }


def local_ledger(monkeypatch, tmp_path):
    monkeypatch.setattr(main.journey_store, "path", tmp_path / "test-intent.sqlite3")
    monkeypatch.setattr(
        main, "reserve_call",
        lambda run_id, request_id: reserve_call(
            run_id, request_id, path=tmp_path / "test-intent.sqlite3"
        ),
    )


def test_fake_provider_proposes_but_cannot_execute():
    fake = FakeAI()
    suggestion = validated_proposal(fake, "Encontre vagas de Engenheiro de IA remoto")
    assert fake.calls == 1
    assert suggestion.tool == "job.search"
    assert suggestion.query == "Engenheiro de IA"
    assert suggestion.needs_confirmation is True
    assert suggestion.executed is False
    assert suggestion.external_submission is False
    assert suggestion.model_calls == 1
    assert "application.submit" not in suggestion.model_dump_json()


def test_code_generates_review_only_ordered_tool_plan():
    run_id = uuid4()
    suggestion = IntentToolProposal(query="Engenheiro de IA", reason="Cargo declarado")
    plan = build_reviewed_plan(
        suggestion, run_id=run_id, calls_used=1, calls_remaining=1,
        preview_requested=True,
    )
    assert [s.tool for s in plan.steps] == [
        "job.search", "job.assess", "application.preview",
    ]
    assert [s.requires_confirmation for s in plan.steps] == [True, False, True]
    assert all(s.external_submission is False and s.state == "proposed"
               for s in plan.steps)
    shorter = build_reviewed_plan(
        suggestion, run_id=run_id, calls_used=1, calls_remaining=1,
        preview_requested=False,
    )
    assert [s.tool for s in shorter.steps] == ["job.search", "job.assess"]


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
    good = payload()
    with pytest.raises(ValidationError):
        IntentRequest.model_validate({**good, "objective": "X"*401})
    with pytest.raises(ValidationError):
        IntentRequest.model_validate({**good, "provider": "fake"})
    with pytest.raises(ValidationError):
        IntentRequest.model_validate({**good, "resume": "PRIVATE FICTITIOUS CV"})
    with pytest.raises(ValidationError):
        IntentRequest.model_validate({**good, "run_id": "not-a-uuid"})
    assert IntentRequest.model_validate(good).preview_requested is True


def test_route_requires_local_origin_and_never_runs_tools(monkeypatch, tmp_path):
    monkeypatch.setenv("ALINHA_DEPLOYMENT_MODE", "community")
    local_ledger(monkeypatch, tmp_path)
    fake = FakeAI()
    monkeypatch.setitem(main.MODELS, "gemini", lambda: fake)
    data = payload()
    with client() as c:
        response = c.post(
            "/api/v1/agent/interpret",
            headers={"Origin": "http://localhost:3000"},
            json=data,
        )
        assert response.status_code == 200, response.text
        body = response.json()
        assert body["executed"] is False
        assert body["tool"] == "job.search"
        assert body["calls_used"] == 1 and body["calls_remaining"] == 1
        assert body["run_id"] == data["run_id"]
        assert len(body["steps"]) == 3
        assert response.headers["cache-control"] == "no-store"
        assert fake.calls == 1
        rejected = c.post(
            "/api/v1/agent/interpret",
            headers={"Origin": "https://attacker.example"},
            json=payload(),
        )
        assert rejected.status_code == 403
        assert fake.calls == 1


def test_budget_blocks_retries_duplicate_and_third_call(monkeypatch, tmp_path):
    monkeypatch.setenv("ALINHA_DEPLOYMENT_MODE", "community")
    local_ledger(monkeypatch, tmp_path)
    fake = FakeAI()
    monkeypatch.setitem(main.MODELS, "gemini", lambda: fake)
    run_id = uuid4()
    one = payload(run_id=run_id)
    with client() as c:
        assert c.post("/api/v1/agent/interpret",
            headers={"Origin": "http://localhost:3000"}, json=one).status_code == 200
        # The same request ID cannot trigger a second provider call.
        duplicate = c.post("/api/v1/agent/interpret",
            headers={"Origin": "http://localhost:3000"}, json=one)
        assert duplicate.status_code == 409
        second = c.post("/api/v1/agent/interpret",
            headers={"Origin": "http://localhost:3000"}, json=payload(run_id=run_id))
        assert second.status_code == 200
        assert second.json()["calls_remaining"] == 0
        third = c.post("/api/v1/agent/interpret",
            headers={"Origin": "http://localhost:3000"}, json=payload(run_id=run_id))
        assert third.status_code == 429
        assert fake.calls == 2


def test_cloud_forbidden_before_multitenant_auth(monkeypatch):
    monkeypatch.setenv("ALINHA_DEPLOYMENT_MODE", "cloud")
    fake = FakeAI()
    monkeypatch.setitem(main.MODELS, "gemini", lambda: fake)
    with client() as c:
        response = c.post(
            "/api/v1/agent/interpret",
            headers={"Origin": "http://localhost:3000"},
            json=payload(),
        )
        assert response.status_code == 403
        assert fake.calls == 0


def test_missing_provider_reserves_budget_but_returns_safe_error(monkeypatch, tmp_path):
    monkeypatch.setenv("ALINHA_DEPLOYMENT_MODE", "community")
    local_ledger(monkeypatch, tmp_path)
    class Failing:
        def propose(self, _):
            raise ProviderError("Conecte uma chave OpenAI API antes de interpretar o objetivo.")
    monkeypatch.setitem(main.MODELS, "openai_api", lambda: Failing())
    with client() as c:
        response = c.post("/api/v1/agent/interpret",
            headers={"Origin": "http://localhost:3000"},
            json=payload(provider="openai_api",objective="Quero trabalhar com IA"))
    assert response.status_code == 422
    assert "chave OpenAI API" in response.json()["detail"]


def test_api_adapters_use_output_cap_and_no_retention(monkeypatch):
    seen = {}
    monkeypatch.setattr(
        "alinha_api.agent.intent_model.saved_api_key", lambda provider: "synthetic-key",
    )
    class FakeResponse:
        def raise_for_status(self):
            pass

        def json(self):
            if "https://api.openai.com" in seen["url"]:
                return {"status": "completed", "output": [{"content": [{
                    "type": "output_text",
                    "text": '{"role":"Engenheiro de IA","reason":"Cargo declarado"}',
                }]}]}
            return {"stop_reason": "end_turn", "content": [{
                "type": "text",
                "text": '{"role":"Engenheiro de IA","reason":"Cargo declarado"}',
            }]}
    def fake_post(url, **kwargs):
        seen.update(url=url, request=kwargs["json"])
        return FakeResponse()
    monkeypatch.setattr("alinha_api.agent.intent_model.httpx.post", fake_post)
    assert OpenAIIntentModel().propose("Busco IA").role == "Engenheiro de IA"
    assert seen["request"]["store"] is False
    assert seen["request"]["max_output_tokens"] == 260
    fmt = seen["request"]["text"]["format"]
    assert fmt["strict"] is True
    assert fmt["schema"]["additionalProperties"] is False
    assert set(fmt["schema"]["required"]) == {"role", "reason"}
    assert "maxLength" not in str(fmt["schema"])
    assert AnthropicIntentModel().propose("Busco IA").role == "Engenheiro de IA"
    assert seen["request"]["max_tokens"] == 260

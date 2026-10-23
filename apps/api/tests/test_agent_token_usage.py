"""Reported provider usage is audited without storing prompts or invented prices.

All model calls are mocked; no external keys, tokens or endpoints are contacted.
"""

from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from types import SimpleNamespace
from uuid import uuid4

from fastapi.testclient import TestClient

from alinha_api import main
from alinha_api.agent.call_budget import reserve_call
from alinha_api.agent.intent_model import (
    AnthropicIntentModel,
    GeminiIntentModel,
    IntentSuggestion,
    OllamaIntentModel,
    OpenAIIntentModel,
)
from alinha_api.agent.journey_store import JourneyStorageUnavailable, JourneyStore
from alinha_api.agent.token_usage import (
    begin_usage_capture,
    captured_usage,
    end_usage_capture,
    report_usage,
)
from alinha_api.services.provider import ProviderError

ORIGIN = {"Origin": "http://localhost:3000"}
OBJECTIVE = "Quero trabalhar como engenheiro de IA no Brasil"


class MockModel:
    calls = 0

    def propose(self, objective):
        assert objective == OBJECTIVE
        self.calls += 1
        report_usage(model="modelo-sintetico", input_tokens=44, output_tokens=12, total_tokens=56)
        return IntentSuggestion(role="Engenheiro de IA", reason="Cargo mencionado.")


def setup(tmp_path, monkeypatch, model=None):
    store = JourneyStore(tmp_path / "usage.sqlite3")
    monkeypatch.setattr(main, "journey_store", store)
    monkeypatch.setattr(
        main, "reserve_call", lambda run, req: reserve_call(run, req, path=store.path)
    )
    monkeypatch.setattr(main, "get_mode", lambda: "community")
    mocked = model if model is not None else MockModel()
    monkeypatch.setitem(main.MODELS, "gemini", lambda: mocked)
    client = TestClient(main.app, base_url="http://127.0.0.1:8000", client=("127.0.0.1", 44000))
    run, req = uuid4(), uuid4()
    data = {
        "run_id": str(run),
        "request_id": str(req),
        "objective": OBJECTIVE,
        "provider": "gemini",
        "preview_requested": True,
    }
    return client, store, mocked, data


def test_reported_tokens_persist_without_prompt_secret_or_fake_cost(tmp_path, monkeypatch):
    client, store, model, data = setup(tmp_path, monkeypatch)
    response = client.post("/api/v1/agent/interpret", json=data, headers=ORIGIN)
    assert response.status_code == 200, response.text
    usage = client.get(f"/api/v1/agent/intent/usage/{data['run_id']}")
    assert usage.status_code == 200 and usage.headers["cache-control"] == "no-store"
    assert usage.json() == [
        {
            "run_id": data["run_id"],
            "request_id": data["request_id"],
            "provider": "gemini",
            "model": "modelo-sintetico",
            "status": "completed",
            "input_tokens": 44,
            "output_tokens": 12,
            "total_tokens": 56,
            "provider_reported": True,
            "observed_at": usage.json()[0]["observed_at"],
            "cost_usd": None,
        }
    ]
    assert model.calls == 1
    assert JourneyStore(store.path).list_model_usage(data["run_id"])[0].total_tokens == 56
    raw = store.path.read_bytes()
    assert OBJECTIVE.encode() not in raw
    assert b"api_key" not in raw
    assert b"prompt" not in raw
    assert client.post("/api/v1/agent/interpret", json=data, headers=ORIGIN).status_code == 409
    assert len(store.list_model_usage(data["run_id"])) == 1


def test_missing_provider_usage_is_unknown_not_zero(tmp_path, monkeypatch):
    class WithoutUsage:
        def propose(self, objective):
            return IntentSuggestion(role="Engenheiro de IA", reason="Cargo mencionado.")

    client, store, _, data = setup(tmp_path, monkeypatch, WithoutUsage())
    assert client.post("/api/v1/agent/interpret", json=data, headers=ORIGIN).status_code == 200
    record = store.list_model_usage(data["run_id"])[0]
    assert record.provider_reported is False
    assert record.input_tokens is None and record.total_tokens is None
    assert record.cost_usd is None


def test_failed_provider_attempt_has_audit_but_no_proposal(tmp_path, monkeypatch):
    class Failing:
        def propose(self, objective):
            raise ProviderError("Não foi possível concluir a chamada.")

    client, store, _, data = setup(tmp_path, monkeypatch, Failing())
    response = client.post("/api/v1/agent/interpret", json=data, headers=ORIGIN)
    assert response.status_code == 422
    record = store.list_model_usage(data["run_id"])[0]
    assert record.status == "failed" and record.total_tokens is None
    assert client.get(f"/api/v1/agent/intent/proposals/{data['run_id']}").status_code == 404


def test_audit_storage_unavailable_prevents_proposal_creation(tmp_path, monkeypatch):
    client, store, model, data = setup(tmp_path, monkeypatch)

    def inaccessible(**kwargs):
        raise JourneyStorageUnavailable("db indisponível")

    monkeypatch.setattr(store, "record_model_usage", inaccessible)
    assert client.post("/api/v1/agent/interpret", json=data, headers=ORIGIN).status_code == 503
    assert model.calls == 1
    assert client.get(f"/api/v1/agent/intent/proposals/{data['run_id']}").status_code == 404


def test_usage_route_is_local_and_not_mutable(tmp_path, monkeypatch):
    client, _store, _, data = setup(tmp_path, monkeypatch)
    endpoint = f"/api/v1/agent/intent/usage/{data['run_id']}"
    assert client.get(endpoint, headers={"Origin": "https://evil.example"}).status_code == 403
    assert client.post(endpoint, json={"total_tokens": 0}, headers=ORIGIN).status_code == 405
    assert client.get(endpoint).json() == []


def test_invalid_counts_are_unknown_not_cast_or_estimated():
    token = begin_usage_capture()
    try:
        report_usage(model="mock-v1", input_tokens=True, output_tokens=-1, total_tokens="1000")
        observed = captured_usage()
        assert observed.model == "mock-v1"
        assert observed.input_tokens is None
        assert observed.output_tokens is None
        assert observed.total_tokens is None
        assert observed.reported is False
    finally:
        end_usage_capture(token)


def test_capture_isolated_across_concurrent_intent_calls():
    def worker(value: int):
        capture = begin_usage_capture()
        try:
            report_usage(model="mock", input_tokens=value, output_tokens=0)
            return captured_usage().input_tokens
        finally:
            end_usage_capture(capture)

    with ThreadPoolExecutor(max_workers=6) as pool:
        observed = list(pool.map(worker, range(6)))
    assert observed == list(range(6))
    assert captured_usage() is None


def test_provider_adapters_extract_only_reported_usage(monkeypatch):
    import alinha_api.agent.intent_model as intent

    monkeypatch.setattr(intent, "saved_api_key", lambda provider: "fake-key")
    monkeypatch.setattr(intent, "local_ollama_allowed", lambda: True)
    monkeypatch.setattr(intent, "reserve_gemini_request", lambda model: None)

    class FakeResponse:
        def __init__(self, body):
            self.body = body

        def raise_for_status(self):
            return None

        def json(self):
            return self.body

    class FakeClient:
        def __init__(self, **kwargs):
            self.models = self

        def __enter__(self):
            return self

        def __exit__(self, *args):
            return False

        def generate_content(self, **kwargs):
            return SimpleNamespace(
                parsed=IntentSuggestion(role="Engenheiro de IA", reason="Cargo."),
                usage_metadata=SimpleNamespace(
                    prompt_token_count=21,
                    candidates_token_count=4,
                    total_token_count=25,
                ),
            )

    monkeypatch.setattr(intent.genai, "Client", FakeClient)

    responses = {
        "openai_api": {
            "status": "completed",
            "model": "modelo-openai-falso",
            "output": [
                {
                    "content": [
                        {
                            "type": "output_text",
                            "text": '{"role":"Engenheiro de IA","reason":"Cargo."}',
                        }
                    ]
                }
            ],
            "usage": {"input_tokens": 31, "output_tokens": 7, "total_tokens": 38},
        },
        "anthropic": {
            "model": "modelo-claude-falso",
            "stop_reason": "end_turn",
            "content": [{"type": "text", "text": '{"role":"Engenheiro de IA","reason":"Cargo."}'}],
            "usage": {"input_tokens": 41, "output_tokens": 8},
        },
        "ollama": {
            "model": "modelo-ollama-falso",
            "response": '{"role":"Engenheiro de IA","reason":"Cargo."}',
            "prompt_eval_count": 51,
            "eval_count": 9,
        },
    }
    monkeypatch.setattr(
        intent.httpx,
        "post",
        lambda url, **kwargs: FakeResponse(
            responses["openai_api"]
            if "openai" in url
            else (responses["anthropic"] if "anthropic" in url else responses["ollama"])
        ),
    )

    for model, expected in [
        (GeminiIntentModel(), (21, 4, 25)),
        (OpenAIIntentModel(), (31, 7, 38)),
        (AnthropicIntentModel(), (41, 8, 49)),
        (OllamaIntentModel(), (51, 9, None)),
    ]:
        capture = begin_usage_capture()
        try:
            assert model.propose(OBJECTIVE).role == "Engenheiro de IA"
            usage = captured_usage()
            assert (usage.input_tokens, usage.output_tokens, usage.total_tokens) == expected
            assert usage.reported is True
        finally:
            end_usage_capture(capture)

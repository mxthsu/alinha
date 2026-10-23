"""Model-suggested goal must be confirmed before the durable career agent runs.

Every provider and job board in these tests is fake; no personal data or network.
"""

from __future__ import annotations

import sqlite3
import time
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from alinha_api import main
from alinha_api.agent.call_budget import reserve_call
from alinha_api.agent.discovery import DiscoveredJob, JobSearchResult
from alinha_api.agent.intent_model import IntentSuggestion
from alinha_api.agent.journey_store import JourneyStore
from alinha_api.agent.models import JobOpportunity
from alinha_api.resume_schema import ResumeProfile

ORIGIN = {"Origin": "http://localhost:3000"}
OBJECTIVE = "Encontre vagas remotas de Engenheiro de IA para mim"
ROLE = "Engenheiro de IA"
PROFILE = ResumeProfile(skills=["Python"], summary="Pessoa fictícia e sem contato real.")


class FakeAI:
    calls = 0
    role = ROLE

    def propose(self, text):
        assert text == OBJECTIVE
        self.calls += 1
        return IntentSuggestion(role=self.role, reason="Cargo identificado no objetivo.")


def harness(tmp_path, monkeypatch, *, preview=True):
    database = tmp_path / "intent-linked.sqlite3"
    store = JourneyStore(database)
    fake = FakeAI()
    monkeypatch.setattr(main, "journey_store", store)
    monkeypatch.setattr(
        main,
        "reserve_call",
        lambda run, req: reserve_call(
            run,
            req,
            path=database,
        ),
    )
    monkeypatch.setenv("ALINHA_DEPLOYMENT_MODE", "community")
    monkeypatch.setitem(main.MODELS, "gemini", lambda: fake)
    monkeypatch.setattr(
        main,
        "get_record",
        lambda kind: ({"profile": PROFILE.model_dump()}, 1),
    )
    calls = []

    def fake_jobs(request, q, **kwargs):
        calls.append(q)
        return JobSearchResult(
            source_name="Plataforma fictícia",
            jobs=[
                DiscoveredJob(
                    opportunity=JobOpportunity(
                        source="gupy",
                        external_id="fake-id",
                        title="Engenheiro de IA",
                        company="Exemplo Fictício",
                        work_mode="remote",
                        source_url="https://jobs.example.org/fake-id",
                    ),
                    description="Python",
                    excerpt="Python",
                )
            ],
        )

    monkeypatch.setattr(main, "discover_jobs", fake_jobs)
    client = TestClient(main.app, base_url="http://127.0.0.1:8000", client=("127.0.0.1", 55000))
    ids = {"run_id": str(uuid4()), "request_id": str(uuid4())}
    intent = {
        **ids,
        "objective": OBJECTIVE,
        "provider": "gemini",
        "preview_requested": preview,
    }
    return client, store, fake, calls, intent


def propose(client, request):
    return client.post("/api/v1/agent/interpret", headers=ORIGIN, json=request)


def confirmation(body, **updates):
    result = {
        "run_id": body["run_id"],
        "request_id": str(uuid4()),
        "confirmed_role": ROLE,
        "search_authorized": True,
        "profile_revision": 1,
        "max_jobs": 3,
    }
    result.update(updates)
    return result


def confirm(client, body):
    return client.post("/api/v1/agent/runs/confirm-intent", headers=ORIGIN, json=body)


def test_propose_then_confirm_then_run_three_tools(tmp_path, monkeypatch):
    client, store, fake, sources, intent = harness(tmp_path, monkeypatch)
    generated = propose(client, intent)
    assert generated.status_code == 200, generated.text
    assert generated.json()["query"] == ROLE
    assert generated.json()["needs_confirmation"] is True
    assert generated.json()["executed"] is False
    assert fake.calls == 1 and sources == []
    assert client.get(f"/api/v1/agent/runs/{intent['run_id']}").status_code == 404
    recovered = client.get(f"/api/v1/agent/intent/proposals/{intent['run_id']}")
    assert recovered.status_code == 200, recovered.text
    assert recovered.headers["cache-control"] == "no-store"
    assert recovered.json()["role"] == ROLE
    assert recovered.json()["preview_requested"] is True
    assert recovered.json()["needs_confirmation"] is True
    assert recovered.json()["executed"] is False

    reviewed = confirmation(intent)
    approved = confirm(client, reviewed)
    assert approved.status_code == 200, approved.text
    assert approved.json()["status"] == "ready"
    assert approved.json()["query"] == ROLE
    assert approved.json()["plan"] == ["job.search", "job.assess", "application.preview"]
    assert approved.json()["profile_revision"] == 1
    assert sources == []
    assert confirm(client, reviewed).json() == approved.json()
    assert len(store.get(approved.json()["run_id"]).events) == 1

    finished = client.post(f"/api/v1/agent/runs/{intent['run_id']}/execute", headers=ORIGIN)
    assert finished.status_code == 200, finished.text
    assert finished.json()["status"] == "needs_review"
    assert finished.json()["next_step"] == 3
    assert finished.json()["external_submission"] is False
    assert len(store.get_previews(approved.json()["run_id"]).previews) == 1
    assert sources == [ROLE]
    assert fake.calls == 1
    assert (
        client.post(f"/api/v1/agent/runs/{intent['run_id']}/execute", headers=ORIGIN).status_code
        == 200
    )
    assert sources == [ROLE]


def test_confirmation_requires_exact_server_saved_role(tmp_path, monkeypatch):
    client, store, fake, calls, intent = harness(tmp_path, monkeypatch)
    assert propose(client, intent).status_code == 200
    altered = confirm(client, confirmation(intent, confirmed_role="Desenvolvedor Go"))
    assert altered.status_code == 409
    assert confirm(client, confirmation(intent, confirmed_role="")).status_code == 422
    assert confirm(client, confirmation(intent, search_authorized=False)).status_code == 422
    assert confirm(client, confirmation(intent, submit=True)).status_code == 422
    assert confirm(client, confirmation(intent, run_id=str(uuid4()))).status_code == 409
    assert store.get_intent_proposal(intent["run_id"]).role == ROLE
    assert not calls and fake.calls == 1


def test_one_proposal_is_consumed_by_one_run_only(tmp_path, monkeypatch):
    client, store, fake, calls, intent = harness(tmp_path, monkeypatch, preview=False)
    assert propose(client, intent).status_code == 200
    first = confirmation(intent)
    created = confirm(client, first)
    assert created.status_code == 200
    assert created.json()["plan"] == ["job.search", "job.assess"]
    assert confirm(client, confirmation(intent)).status_code == 409
    assert (
        client.post(
            "/api/v1/agent/interpret", headers=ORIGIN, json={**intent, "request_id": str(uuid4())}
        ).status_code
        == 409
    )
    assert store.get(intent["run_id"]).status == "ready"
    assert fake.calls == 1 and calls == []


def test_second_successful_model_proposal_replaces_unconfirmed_title(tmp_path, monkeypatch):
    client, store, fake, calls, intent = harness(tmp_path, monkeypatch)
    assert propose(client, intent).status_code == 200
    fake.role = "Analista de Dados"
    again = propose(client, {**intent, "request_id": str(uuid4())})
    assert again.status_code == 200
    assert again.json()["query"] == "Analista de Dados"
    assert store.get_intent_proposal(intent["run_id"]).role == "Analista de Dados"
    assert confirm(client, confirmation(intent)).status_code == 409
    accepted = confirm(client, confirmation(intent, confirmed_role="Analista de Dados"))
    assert accepted.status_code == 200
    assert accepted.json()["query"] == "Analista de Dados"
    assert not calls


def test_no_model_run_and_expired_proposal_cannot_be_confirmed(tmp_path, monkeypatch):
    client, store, _fake, calls, intent = harness(tmp_path, monkeypatch)
    assert confirm(client, confirmation(intent)).status_code == 409
    assert propose(client, intent).status_code == 200
    with sqlite3.connect(store.path) as db:
        db.execute(
            "UPDATE agent_intent_proposals SET expires_at=? WHERE run_id=?",
            (int(time.time()) - 5, intent["run_id"]),
        )
    assert confirm(client, confirmation(intent)).status_code == 409
    assert client.get(f"/api/v1/agent/intent/proposals/{intent['run_id']}").status_code == 404
    assert not calls


def test_proposals_survive_sqlite_restart_without_raw_objective(tmp_path, monkeypatch):
    client, store, fake, calls, intent = harness(tmp_path, monkeypatch)
    assert propose(client, intent).status_code == 200
    monkeypatch.setattr(main, "journey_store", JourneyStore(store.path))
    assert client.get(f"/api/v1/agent/intent/proposals/{intent['run_id']}").status_code == 200
    assert confirm(client, confirmation(intent)).status_code == 200
    assert OBJECTIVE.encode() not in store.path.read_bytes()
    assert "access_token" not in str(store.path.read_bytes())
    assert fake.calls == 1 and not calls


def test_bad_model_role_cannot_be_persisted_for_execution(tmp_path, monkeypatch):
    client, _store, _fake, calls, intent = harness(tmp_path, monkeypatch)

    class UnsafeModel:
        def propose(self, _):
            return IntentSuggestion(role="123@example.test", reason="Risco")

    monkeypatch.setitem(main.MODELS, "gemini", UnsafeModel)
    assert propose(client, intent).status_code == 422
    assert client.get(f"/api/v1/agent/intent/proposals/{intent['run_id']}").status_code == 404
    assert confirm(client, confirmation(intent)).status_code == 409
    assert not calls


def test_failed_receipt_storage_must_not_authorize_execution(tmp_path, monkeypatch):
    client, store, fake, calls, intent = harness(tmp_path, monkeypatch)
    bad = tmp_path / "folder"
    bad.mkdir()
    store.path = bad
    assert propose(client, intent).status_code == 503
    assert fake.calls == 0 and not calls
    store.path = tmp_path / "intent-linked.sqlite3"
    assert confirm(client, confirmation(intent)).status_code == 409


def test_concurrent_confirms_bind_exactly_one_request(tmp_path, monkeypatch):
    from concurrent.futures import ThreadPoolExecutor

    client, store, _fake, calls, intent = harness(tmp_path, monkeypatch)
    assert propose(client, intent).status_code == 200
    a = confirmation(intent)
    b = confirmation(intent)
    with ThreadPoolExecutor(max_workers=2) as pool:
        result = list(pool.map(lambda payload: confirm(client, payload), [a, b]))
    assert sorted(r.status_code for r in result) == [200, 409]
    assert len(store.get(intent["run_id"]).events) == 1
    assert not calls

def test_failure_after_model_inference_cannot_create_usable_proposal(tmp_path, monkeypatch):
    from alinha_api.agent.journey_store import JourneyNotFound, JourneyStorageUnavailable

    client, store, fake, calls, intent = harness(tmp_path, monkeypatch)

    def unavailable(**kwargs):
        raise JourneyStorageUnavailable()

    monkeypatch.setattr(store, "save_intent_proposal", unavailable)
    assert propose(client, intent).status_code == 503
    assert fake.calls == 1 and not calls
    with pytest.raises(JourneyNotFound):
        JourneyStore(store.path).get_intent_proposal(intent["run_id"])
    assert confirm(client, confirmation(intent)).status_code == 409

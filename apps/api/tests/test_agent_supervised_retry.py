"""Supervised recovery after an interrupted tool lease; no automatic replay.

All search tools are mocked. A retry approval only changes local state; actual
execution still needs an independently authorized request.
"""

from __future__ import annotations

import sqlite3
import time
from concurrent.futures import ThreadPoolExecutor
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from alinha_api import main
from alinha_api.agent.discovery import DiscoveredJob, JobSearchResult
from alinha_api.agent.journey_store import JourneyConflict, JourneyStore, StartJourney
from alinha_api.agent.models import JobOpportunity
from alinha_api.resume_schema import ResumeProfile

ORIGIN = {"Origin": "http://localhost:3000"}


def source():
    return JobSearchResult(
        source_name="Somente anúncio de teste",
        jobs=[
            DiscoveredJob(
                opportunity=JobOpportunity(
                    source="gupy",
                    external_id="fake-resumed",
                    title="Python",
                    company="Exemplo de Teste",
                    work_mode="remote",
                    source_url="https://jobs.example.org/fake-resumed",
                ),
                excerpt="Python e FastAPI",
            )
        ],
    )


def setup(tmp_path, monkeypatch, *, preview=False):
    store = JourneyStore(tmp_path / "recovery.sqlite3")
    monkeypatch.setattr(main, "journey_store", store)
    monkeypatch.setattr(main, "get_mode", lambda: "community")
    monkeypatch.setattr(
        main,
        "get_record",
        lambda kind: ({"profile": ResumeProfile(skills=["Python"]).model_dump()}, 1),
    )
    calls = []

    def search(request, q, **kwargs):
        calls.append(q)
        return source()

    monkeypatch.setattr(main, "discover_jobs", search)
    client = TestClient(
        main.app,
        base_url="http://127.0.0.1:8000",
        client=("127.0.0.1", 51000),
    )
    payload = StartJourney(
        run_id=uuid4(),
        request_id=uuid4(),
        query="Python",
        search_authorized=True,
        profile_revision=1,
        prepare_preview=preview,
    )
    assert (
        client.post(
            "/api/v1/agent/runs", json=payload.model_dump(mode="json"), headers=ORIGIN
        ).status_code
        == 200
    )
    return client, store, payload.run_id, calls


def interrupt(store, run_id):
    lease = store.begin_step(run_id, store.get(run_id).next_step)
    with sqlite3.connect(store.path) as conn:
        conn.execute(
            "UPDATE agent_journeys SET step_started_at=? WHERE run_id=?",
            (int(time.time()) - 300, str(run_id)),
        )
    return lease


def approval(store, run_id, **changes):
    latest = store.get(run_id).events[-1]
    data = {
        "request_id": str(uuid4()),
        "expected_step": store.get(run_id).next_step,
        "observed_sequence": latest.sequence,
        "retry_authorized": True,
    }
    data.update(changes)
    return data


def retry(client, run_id, body):
    return client.post(f"/api/v1/agent/runs/{run_id}/retry", json=body, headers=ORIGIN)


def test_http_read_marks_stale_and_approved_retry_does_not_run_tool(tmp_path, monkeypatch):
    client, store, run_id, calls = setup(tmp_path, monkeypatch)
    lease = interrupt(store, run_id)
    state = client.get(f"/api/v1/agent/runs/{run_id}")
    assert state.status_code == 200
    assert state.json()["status"] == "needs_review"
    assert state.json()["next_step"] == 0
    assert state.json()["events"][-1]["status"] == "interrupted"
    assert not calls
    with pytest.raises(JourneyConflict):
        store.finish_search(lease, source())
    body = approval(store, run_id)
    approved = retry(client, run_id, body)
    assert approved.status_code == 200, approved.text
    assert approved.json()["status"] == "ready"
    assert approved.json()["next_step"] == 0
    assert approved.json()["events"][-1]["status"] == "created"
    assert not calls
    # Repeating the approval is read-only; it cannot restart the provider.
    assert retry(client, run_id, body).json() == approved.json()
    resumed = client.post(f"/api/v1/agent/runs/{run_id}/execute", headers=ORIGIN)
    assert resumed.status_code == 200, resumed.text
    assert resumed.json()["status"] == "needs_review"
    assert resumed.json()["next_step"] == 2
    assert calls == ["Python"]
    assert len(store.get_search_result(run_id).jobs) == 1
    assert retry(client, run_id, body).status_code == 200
    assert calls == ["Python"]


def test_rejects_stale_revision_wrong_step_and_missing_consent(tmp_path, monkeypatch):
    client, store, run_id, calls = setup(tmp_path, monkeypatch)
    interrupt(store, run_id)
    assert client.get(f"/api/v1/agent/runs/{run_id}").status_code == 200
    body = approval(store, run_id)
    assert retry(client, run_id, {**body, "retry_authorized": False}).status_code == 422
    assert retry(client, run_id, {**body, "retry_authorized": None}).status_code == 422
    assert retry(client, run_id, {**body, "expected_step": 1}).status_code == 409
    assert (
        retry(
            client, run_id, {**body, "observed_sequence": body["observed_sequence"] + 1}
        ).status_code
        == 409
    )
    assert retry(client, run_id, {**body, "tool": "application.submit"}).status_code == 422
    assert client.post(f"/api/v1/agent/runs/{run_id}/execute", headers=ORIGIN).status_code == 409
    assert not calls
    assert store.get(run_id).status == "needs_review"


def test_normal_completed_review_cannot_be_resumed(tmp_path, monkeypatch):
    client, store, run_id, _ = setup(tmp_path, monkeypatch)
    assert client.post(f"/api/v1/agent/runs/{run_id}/execute", headers=ORIGIN).status_code == 200
    body = approval(store, run_id)
    assert retry(client, run_id, body).status_code == 409
    assert store.get(run_id).status == "needs_review"


def test_concurrent_review_approvals_only_one_changes_status(tmp_path, monkeypatch):
    client, store, run_id, calls = setup(tmp_path, monkeypatch)
    interrupt(store, run_id)
    client.get(f"/api/v1/agent/runs/{run_id}")
    one, two = approval(store, run_id), approval(store, run_id)
    with ThreadPoolExecutor(max_workers=2) as executor:
        results = list(executor.map(lambda body: retry(client, run_id, body), (one, two)))
    assert sorted(r.status_code for r in results) == [200, 409]
    assert store.get(run_id).status == "ready"
    assert len([e for e in store.get(run_id).events if e.summary.startswith("Nova tentativa")]) == 1
    assert not calls


def test_cancellation_prevents_retry_reauthorization(tmp_path, monkeypatch):
    client, store, run_id, _ = setup(tmp_path, monkeypatch)
    interrupt(store, run_id)
    client.get(f"/api/v1/agent/runs/{run_id}")
    body = approval(store, run_id)
    assert client.post(f"/api/v1/agent/runs/{run_id}/cancel", headers=ORIGIN).status_code == 200
    assert retry(client, run_id, body).status_code == 409
    assert store.get(run_id).status == "cancelled"


def test_retry_is_bounded_two_explicit_approvals(tmp_path, monkeypatch):
    client, store, run_id, calls = setup(tmp_path, monkeypatch)
    for attempt in range(2):
        interrupt(store, run_id)
        assert client.get(f"/api/v1/agent/runs/{run_id}").json()["status"] == "needs_review"
        assert retry(client, run_id, approval(store, run_id)).status_code == 200
    interrupt(store, run_id)
    client.get(f"/api/v1/agent/runs/{run_id}")
    assert retry(client, run_id, approval(store, run_id)).status_code == 409
    assert store.get(run_id).status == "needs_review"
    assert not calls


def test_recent_running_lease_not_marked_stale(tmp_path, monkeypatch):
    client, store, run_id, calls = setup(tmp_path, monkeypatch)
    store.begin_step(run_id, 0)
    status = client.get(f"/api/v1/agent/runs/{run_id}")
    assert status.status_code == 200
    assert status.json()["status"] == "running"
    assert status.json()["events"][-1]["status"] == "running"
    assert not calls


def test_retry_origin_protection(tmp_path, monkeypatch):
    client, store, run_id, calls = setup(tmp_path, monkeypatch)
    interrupt(store, run_id)
    client.get(f"/api/v1/agent/runs/{run_id}")
    body = approval(store, run_id)
    path = f"/api/v1/agent/runs/{run_id}/retry"
    assert client.post(path, json=body).status_code == 403
    assert (
        client.post(path, json=body, headers={"Origin": "https://evil.invalid"}).status_code == 403
    )
    assert not calls
    assert store.get(run_id).status == "needs_review"

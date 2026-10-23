"""Synthetic end-to-end demo runtime checks; no credentials, sites or real CVs."""
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from alinha_api import main
from alinha_api.agent.runtime import (
    AgentCoordinator,
    ConfirmReview,
    FakeAIProvider,
    FakeJobSource,
    FakeToolExecutor,
    Limits,
    RunViolation,
    StartRun,
)


def request(**extra):
    return StartRun(
        request_id=f"fictional-{uuid4().hex}", intent="Encontre vagas Python remotas e prepare rascunho",
        search_authorized=True, draft_authorized=True, **extra,
    )


def drive(coordinator, snapshot):
    for step in range(5):
        snapshot = coordinator.advance(snapshot.run_id, step)
    return snapshot


def test_full_journey_stays_local_and_requires_review():
    coordinator = AgentCoordinator()
    snapshot = drive(coordinator, coordinator.start(request()))
    assert snapshot.status == "needs_review"
    assert snapshot.next_step == 5
    assert [item.tool for item in snapshot.plan] == [
        "resume.read", "job.search", "job.assess", "resume.prepare", "application.preview",
    ]
    assert [e.sequence for e in snapshot.events] == list(range(1, 7))
    assert all(event.external_submission is False for event in snapshot.events)
    assert snapshot.external_submission is False
    assert snapshot.profile.name == "Pessoa Exemplo"
    assert snapshot.preview.status == "rascunho"
    assert snapshot.preview.external_submission is False
    assert snapshot.preview.verified_skills == ["Python", "FastAPI", "SQL"]
    assert "Kubernetes" not in snapshot.preview.draft_text
    assert snapshot.preview.unknown_questions
    assert snapshot.preview.answers == {}
    with pytest.raises(RunViolation, match="não encontrada"):
        coordinator.confirm_review("missing", ConfirmReview(confirm_review=True, availability="a_combinar"))
    reviewed = coordinator.confirm_review(
        snapshot.run_id, ConfirmReview(confirm_review=True, availability="a_combinar"),
    )
    assert reviewed.status == "completed"
    assert reviewed.external_submission is False
    assert "não enviada" in reviewed.events[-1].summary


def test_preparation_is_a_real_step_before_preview():
    coordinator = AgentCoordinator()
    start = coordinator.start(request())
    current = start
    for step in range(4):
        current = coordinator.advance(start.run_id, step)
    assert current.draft_text is not None
    assert current.preview is None
    previewed = coordinator.advance(start.run_id, 4)
    assert previewed.preview.draft_text == current.draft_text


def test_user_must_authorize_even_a_fake_search():
    coordinator = AgentCoordinator()
    with pytest.raises(RunViolation, match="Autorize"):
        coordinator.start(StartRun(
            request_id="demo-refused-0001", intent="Encontre vagas Python", search_authorized=False,
        ))


def test_draft_requires_separate_authorization():
    with pytest.raises(RunViolation, match="prévia fictícia"):
        AgentCoordinator().start(StartRun(
            request_id="demo-no-draft-0001", intent="Encontre vagas Python e prepare rascunho",
            search_authorized=True, draft_authorized=False,
        ))


def test_cancel_prevents_future_actions_and_repeated_step_is_idempotent():
    coordinator = AgentCoordinator()
    snapshot = coordinator.start(request())
    once = coordinator.advance(snapshot.run_id, 0)
    repeated = coordinator.advance(snapshot.run_id, 0)
    assert repeated.events == once.events
    stopped = coordinator.cancel(snapshot.run_id)
    assert stopped.status == "cancelled"
    assert stopped.next_step == 1
    assert coordinator.advance(snapshot.run_id, 1).status == "cancelled"
    assert coordinator.cancel(snapshot.run_id).events == stopped.events
    assert coordinator.get(snapshot.run_id).preview is None


def test_ai_quota_zero_uses_fallback_and_job_quota_is_capped():
    class ExplodingProvider:
        def propose(self, intent, limits):
            raise AssertionError("AI should not be called")

    coordinator = AgentCoordinator(provider=ExplodingProvider())
    snapshot = drive(coordinator, coordinator.start(request(limits=Limits(max_ai_calls=0, max_jobs=1))))
    assert snapshot.status == "needs_review"
    assert len(snapshot.jobs) == 1
    assert snapshot.plan[1].args["limit"] == 1


def test_rejects_tool_escalation_and_out_of_budget_proposals():
    class MaliciousProvider:
        def __init__(self, tool="application.submit", limit=3):
            self.tool, self.limit = tool, limit

        def propose(self, intent, limits):
            planned = FakeAIProvider().propose(intent, limits)
            planned[1] = planned[1].model_copy(update={
                "tool": self.tool,
                "args": {"query": "Python", "limit": self.limit} if self.tool == "job.search" else {},
            })
            return planned

    for provider in (MaliciousProvider(), MaliciousProvider(tool="job.search", limit=100)):
        with pytest.raises(RunViolation, match="recusad"):
            AgentCoordinator(provider=provider).start(request())


def test_prompt_injection_in_fake_job_description_cannot_change_tools():
    coordinator = AgentCoordinator()
    snapshot = drive(coordinator, coordinator.start(
        StartRun(request_id="synthetic-injection-001",
                 intent="Encontre vagas Suporte, prepare rascunho", search_authorized=True,
                 draft_authorized=True)
    ))
    assert snapshot.status == "needs_review"
    assert "Ignore regras" in snapshot.jobs[0].description
    assert "Ignore regras" not in snapshot.preview.draft_text
    assert all(event.external_submission is False for event in snapshot.events)
    assert "application.submit" not in [action.tool for action in snapshot.plan]


def test_missing_evidence_never_becomes_invented_skill():
    class SparseJobs(FakeJobSource):
        def search(self, query, limit):
            original = super().search("Python", limit)
            return [original[0].model_copy(update={"requirements": ["Kubernetes"]})]

    coordinator = AgentCoordinator(executor=FakeToolExecutor(jobs=SparseJobs()))
    snapshot = drive(coordinator, coordinator.start(request()))
    assert snapshot.preview.verified_skills == []
    assert snapshot.matches[0].unverified == ["Kubernetes"]
    assert "Kubernetes" not in snapshot.preview.draft_text


def test_no_matching_jobs_fails_closed_and_timeout_is_enforced():
    coordinator = AgentCoordinator()
    no_jobs = coordinator.start(StartRun(
        request_id="test-no-jobs-0001", intent="Encontrar vaga de Cobol",
        search_authorized=True, draft_authorized=True,
    ))
    failed = coordinator.advance(no_jobs.run_id, 0)
    failed = coordinator.advance(no_jobs.run_id, 1)
    assert failed.status == "failed"
    assert failed.preview is None
    timeout_run = coordinator.start(request())
    coordinator._runs[timeout_run.run_id].started_at -= 1000
    assert coordinator.advance(timeout_run.run_id, 0).status == "failed"


def test_request_id_conflict_and_step_order():
    coordinator = AgentCoordinator()
    input_data = request()
    snapshot = coordinator.start(input_data)
    assert coordinator.start(input_data).run_id == snapshot.run_id
    with pytest.raises(RunViolation, match="outros parâmetros"):
        coordinator.start(input_data.model_copy(update={"intent": "Mude para dados"}))
    with pytest.raises(RunViolation, match="fora de ordem"):
        coordinator.advance(snapshot.run_id, 2)


def test_http_endpoints_run_to_review_with_no_store(monkeypatch):
    monkeypatch.setattr(main, "demo_coordinator", AgentCoordinator())
    client = TestClient(
        main.app, base_url="http://localhost:8000", client=("127.0.0.1", 50000),
        headers={"Origin": "http://localhost:3000"},
    )
    body = request().model_dump()
    created = client.post("/api/v1/agent/demo/runs", json=body)
    assert created.status_code == 200, created.text
    assert created.headers["cache-control"] == "no-store"
    run_id = created.json()["run_id"]
    assert client.get(f"/api/v1/agent/demo/runs/{run_id}").status_code == 200
    for expected in range(5):
        result = client.post(f"/api/v1/agent/demo/runs/{run_id}/advance", json={"expected_step": expected})
        assert result.status_code == 200, result.text
    assert result.json()["status"] == "needs_review"
    assert result.json()["preview"]["external_submission"] is False
    assert client.post(f"/api/v1/agent/demo/runs/{run_id}/review", json={
        "confirm_review": True, "availability": "a_combinar",
    }).json()["status"] == "completed"


def test_http_rejects_untrusted_browser_origin():
    client = TestClient(main.app, base_url="http://localhost:8000",
                        client=("127.0.0.1", 50000))
    response = client.post(
        "/api/v1/agent/demo/runs", json=request().model_dump(),
        headers={"Origin": "https://malicious.example"},
    )
    assert response.status_code == 403

"""Brazil-oriented, fact-only filters across persistent Community agent runs.

Every vacancy and provider is synthetic. Missing facts never satisfy hard filters.
"""

from __future__ import annotations

from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from alinha_api import main
from alinha_api.agent.discovery import DiscoveredJob, JobSearchResult
from alinha_api.agent.job_filters import filter_public_jobs, matches_criteria
from alinha_api.agent.journey_store import (
    ConfirmIntentJourney,
    JourneyConflict,
    JourneyStore,
    StartJourney,
)
from alinha_api.agent.models import CandidateCriteria, JobOpportunity
from alinha_api.resume_schema import ResumeProfile

ORIGIN = {"Origin": "http://localhost:3000"}


def job(
    number: int,
    *,
    city=None,
    mode="unspecified",
    contract="unspecified",
    salary=None,
) -> DiscoveredJob:
    return DiscoveredJob(
        opportunity=JobOpportunity(
            source="gupy",
            external_id=f"fiction-{number}",
            title="Desenvolvedor Python",
            company="Empresa Teste",
            city=city,
            work_mode=mode,
            contract_type=contract,
            advertised_min_salary_brl=salary,
            source_url=f"https://jobs.example.org/fiction-{number}",
        ),
        excerpt="Vaga sintética; Python e FastAPI.",
    )


def result() -> JobSearchResult:
    return JobSearchResult(
        source_name="Quadro fictício",
        limitations=["Sem vagas reais."],
        jobs=[
            job(1, city=None, mode="remote", salary=None),
            job(2, city="Florianopolis", mode="onsite", contract="clt", salary=9000),
            job(3, city="Florianópolis", mode="hybrid", contract="pj", salary=12000),
            job(4, city="São Paulo", mode="onsite", contract="clt", salary=15000),
            job(5, city="Florianópolis", mode="onsite", contract="clt", salary=10000),
        ],
    )


def test_conservative_hard_filters_and_unicode_city_matching():
    criteria = CandidateCriteria(
        allowed_cities=["Florianópolis"],
        allowed_work_modes=["onsite", "hybrid"],
        allowed_contract_types=["clt"],
        minimum_advertised_salary_brl=9500,
    )
    jobs = filter_public_jobs(result(), criteria, max_jobs=3)
    assert [j.opportunity.external_id for j in jobs.jobs] == ["fiction-5"]
    assert jobs.source_name == "Quadro fictício"
    assert len(jobs.limitations) == 2
    assert "filtros" in jobs.limitations[-1].casefold()
    assert not matches_criteria(job(0, mode="onsite").opportunity, criteria)
    assert not matches_criteria(job(0, city="Florianópolis", mode="onsite").opportunity, criteria)
    assert not matches_criteria(
        job(0, city="Florianópolis", mode="onsite", contract="clt").opportunity, criteria
    )


def test_filters_run_before_limiting_results():
    criteria = CandidateCriteria(allowed_work_modes=["onsite"])
    found = filter_public_jobs(result(), criteria, 1)
    assert [j.opportunity.external_id for j in found.jobs] == ["fiction-2"]


def test_remote_only_does_not_infer_unknown_modes():
    criteria = CandidateCriteria(allowed_work_modes=["remote"])
    assert [j.opportunity.external_id for j in filter_public_jobs(result(), criteria, 15).jobs] == [
        "fiction-1"
    ]
    assert filter_public_jobs(result(), CandidateCriteria(), 15).jobs == result().jobs


def test_invalid_filter_payload_fails_validation():
    with pytest.raises(ValidationError):
        CandidateCriteria(allowed_work_modes=["teleport"])
    with pytest.raises(ValidationError):
        CandidateCriteria(minimum_advertised_salary_brl=-1)
    with pytest.raises(ValidationError):
        CandidateCriteria(allowed_cities=["x" * 121])
    with pytest.raises(ValueError):
        filter_public_jobs(result(), CandidateCriteria(), 16)


def setup(tmp_path, monkeypatch, criteria, *, preview=False):
    store = JourneyStore(tmp_path / "db.sqlite3")
    monkeypatch.setattr(main, "journey_store", store)
    monkeypatch.setattr(main, "get_mode", lambda: "community")
    monkeypatch.setattr(
        main,
        "get_record",
        lambda kind: ({"profile": ResumeProfile(skills=["Python"]).model_dump()}, 1),
    )
    args = []

    def source(request, q, **kwargs):
        args.append((q, kwargs))
        return result()

    monkeypatch.setattr(main, "discover_jobs", source)
    client = TestClient(
        main.app,
        base_url="http://127.0.0.1:8000",
        client=("127.0.0.1", 51234),
    )
    data = StartJourney(
        run_id=uuid4(),
        request_id=uuid4(),
        query="Desenvolvedor Python",
        search_authorized=True,
        profile_revision=1,
        max_jobs=3,
        criteria=criteria,
        prepare_preview=preview,
    )
    r = client.post("/api/v1/agent/runs", json=data.model_dump(mode="json"), headers=ORIGIN)
    assert r.status_code == 200, r.text
    return client, store, data, args


def test_search_endpoint_uses_approved_filters_and_saves_only_matching(tmp_path, monkeypatch):
    criteria = CandidateCriteria(
        allowed_cities=["Florianópolis"],
        allowed_work_modes=["onsite"],
        allowed_contract_types=["clt"],
        minimum_advertised_salary_brl=9000,
    )
    client, store, data, args = setup(tmp_path, monkeypatch, criteria)
    response = client.post(f"/api/v1/agent/runs/{data.run_id}/execute-search", headers=ORIGIN)
    assert response.status_code == 200, response.text
    assert response.json()["criteria"] == criteria.model_dump()
    assert response.json()["result_count"] == 2
    assert args == [("Desenvolvedor Python", {"page": 1, "remote_only": False, "source": "all"})]
    jobs = client.get(f"/api/v1/agent/runs/{data.run_id}/jobs").json()["jobs"]
    assert [j["opportunity"]["external_id"] for j in jobs] == ["fiction-2", "fiction-5"]
    assert JourneyStore(store.path).get_search_criteria(data.run_id) == criteria


def test_one_command_remote_defaults_and_existing_behavior(tmp_path, monkeypatch):
    criteria = CandidateCriteria(allowed_work_modes=["remote"])
    client, store, data, args = setup(tmp_path, monkeypatch, criteria, preview=True)
    response = client.post(f"/api/v1/agent/runs/{data.run_id}/execute", headers=ORIGIN)
    assert response.status_code == 200, response.text
    assert response.json()["status"] == "needs_review"
    assert response.json()["result_count"] == 1
    assert args[0][1]["remote_only"] is True
    assert store.get_search_result(data.run_id).jobs[0].opportunity.external_id == "fiction-1"
    assert len(store.get_previews(data.run_id).previews) == 1


def test_confirmation_keeps_filter_constraints_and_rejects_tampering(tmp_path):
    store = JourneyStore(tmp_path / "db.sqlite3")
    run, req = uuid4(), uuid4()
    store.save_intent_proposal(
        run_id=run,
        request_id=req,
        role="Engenheiro de IA",
        preview_requested=False,
        calls_used=1,
    )
    filters = CandidateCriteria(
        allowed_cities=["Florianópolis"],
        allowed_work_modes=["hybrid"],
        allowed_contract_types=["pj"],
    )
    request = ConfirmIntentJourney(
        run_id=run,
        request_id=uuid4(),
        confirmed_role="Engenheiro de IA",
        search_authorized=True,
        profile_revision=1,
        criteria=filters,
    )
    created = store.confirm_intent(request)
    assert created.criteria == filters
    assert store.get_search_criteria(run) == filters
    assert store.confirm_intent(request) == created
    with pytest.raises(JourneyConflict):
        store.confirm_intent(request.model_copy(update={"criteria": CandidateCriteria()}))


def test_schema_migration_preserves_legacy_remote_default(tmp_path):
    store = JourneyStore(tmp_path / "older.sqlite3")
    request = StartJourney(
        run_id=uuid4(),
        request_id=uuid4(),
        query="Python",
        search_authorized=True,
        profile_revision=1,
    )
    store.create(request)
    import sqlite3

    with sqlite3.connect(store.path) as conn:
        conn.execute(
            "UPDATE agent_journeys SET criteria_json=NULL WHERE run_id=?", (str(request.run_id),)
        )
    assert store.get_search_criteria(request.run_id).allowed_work_modes == ["remote"]
    assert store.get(request.run_id).criteria.allowed_work_modes == ["remote"]

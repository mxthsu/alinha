"""Tests for multi-provider retrieval and graceful partial failure."""
from fastapi.testclient import TestClient

from alinha_api import main
from alinha_api.agent.discovery import DiscoveredJob, JobSearchResult, JobSearchUnavailable
from alinha_api.agent.models import JobOpportunity
from alinha_api.agent.multisource import merge_sources, search_multi_source
from alinha_api.services import community_storage as storage


def fixture_job(source: str, url: str) -> DiscoveredJob:
    return DiscoveredJob(
        opportunity=JobOpportunity(
            source=source, external_id="123", title="Desenvolvedor Python",
            company="Empresa Exemplo", source_url=url,
        ),
        excerpt="Python e FastAPI",
    )


def test_merge_dedupes_same_url_but_keeps_different_sources():
    first = JobSearchResult(source_name="Gupy", jobs=[
        fixture_job("gupy", "https://empresa.gupy.io/jobs/123")
    ])
    second = JobSearchResult(source_name="Himalayas", jobs=[
        fixture_job("himalayas", "https://empresa.gupy.io/jobs/123/"),
        fixture_job("himalayas", "https://himalayas.app/companies/empresa/jobs/dev"),
    ])
    combined = merge_sources([first, second])
    assert len(combined.jobs) == 2
    assert combined.jobs[0].opportunity.source == "gupy"


def test_one_provider_failure_keeps_the_other_results():
    result = search_multi_source({
        "Gupy": lambda: JobSearchResult(source_name="Gupy", jobs=[
            fixture_job("gupy", "https://empresa.gupy.io/jobs/123")
        ]),
        "Himalayas": lambda: (_ for _ in ()).throw(JobSearchUnavailable("Offline")),
    })
    assert len(result.jobs) == 1
    assert "Himalayas" in " ".join(result.limitations)


def test_all_fail_does_not_invent_jobs():
    try:
        search_multi_source({
            "Gupy": lambda: (_ for _ in ()).throw(JobSearchUnavailable("Offline")),
        })
    except JobSearchUnavailable:
        pass
    else:
        raise AssertionError("Total provider failure must propagate")


def test_endpoint_all_respects_enabled_sources(tmp_path, monkeypatch):
    monkeypatch.setattr(storage, "user_paths", lambda: (tmp_path / "config.jsonc", tmp_path / "db.sqlite3"))
    monkeypatch.setattr(main, "get_mode", lambda: "community")
    main.write_settings(storage.CommunitySettings(connectors=storage.Connectors(
        gupy=storage.ConnectorSettings(enabled=True),
        himalayas=storage.ConnectorSettings(enabled=False),
    )))
    monkeypatch.setattr(main, "search_jobs", lambda *a, **kw: (_ for _ in ()).throw(
        AssertionError("Himalayas disabled")))
    monkeypatch.setattr(main, "search_gupy", lambda *a, **kw: JobSearchResult(
        source_name="Gupy", jobs=[fixture_job("gupy", "https://empresa.gupy.io/jobs/123")]
    ))
    client = TestClient(main.app, base_url="http://localhost", client=("127.0.0.1", 12345))
    response = client.get("/api/v1/jobs/search",
                          params={"q": "Python", "source": "all", "remote_only": "false"})
    assert response.status_code == 200, response.text
    assert response.json()["jobs"][0]["opportunity"]["source"] == "gupy"

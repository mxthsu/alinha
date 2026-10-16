"""Offline security and contract tests for the fixed Himalayas remote jobs connector."""

import httpx
import pytest
from fastapi.testclient import TestClient

from alinha_api.agent import discovery
from alinha_api.agent.models import CandidateCriteria
from alinha_api.main import app

GOOD = {
    "title": "Backend Python", "companyName": "Empresa Demonstrativa",
    "guid": "fictional-vacancy-1", "applicationLink": "https://himalayas.app/companies/example/jobs/backend-python",
    "locationRestrictions": [{"alpha2": "BR", "name": "Brazil"}],
    "employmentType": "Full Time", "minSalary": 95000,
    "currency": "USD", "salaryPeriod": "annual",
    "excerpt": "Backend development in Python",
}


def test_normalization_preserves_unknown_clt_and_brl_salary():
    job = discovery._normalize(GOOD)
    assert job is not None
    assert job.opportunity.work_mode == "remote"
    assert job.opportunity.contract_type == "unspecified"
    assert job.opportunity.city is None
    assert job.opportunity.advertised_min_salary_brl is None
    assert job.salary_label == "USD 95,000 / annual"
    assert job.opportunity.source_url == GOOD["applicationLink"]


def test_monthly_brl_minimum_is_not_inferred_from_other_currency():
    job = discovery._normalize({**GOOD, "minSalary": 7000, "currency": "BRL", "salaryPeriod": "monthly"})
    assert job is not None
    assert job.opportunity.advertised_min_salary_brl == 7000


@pytest.mark.parametrize("link", [
    "javascript:alert(1)", "http://himalayas.app/companies/example/jobs/1",
    "https://evil.example/companies/example/jobs/1",
    "https://himalayas.app.evil.example/companies/example/jobs/1",
    "https://evil.example@himalayas.app/companies/example/jobs/1",
    "https://himalayas.app:444/companies/example/jobs/1",
    "https://himalayas.app:INVALID/companies/example/jobs/1",
    "https://himalayas.app/api/private",
])
def test_untrusted_external_links_are_never_displayed(link):
    assert discovery._normalize({**GOOD, "applicationLink": link}) is None


def test_country_restrictions_and_duplicate_ids_are_respected(monkeypatch):
    monkeypatch.setattr(discovery, "_get_page", lambda *args: {"jobs": [
        {**GOOD, "locationRestrictions": [{"alpha2": "US"}]},
        GOOD, GOOD,
        {**GOOD, "guid": "v2", "locationRestrictions": []},
    ]})
    result = discovery.search_jobs("Python")
    assert len(result.jobs) == 2
    assert result.source_name == "Himalayas"


def test_malformed_or_missing_provider_fields_are_ignored(monkeypatch):
    monkeypatch.setattr(discovery, "_get_page", lambda *args: {"jobs": [
        {**GOOD, "companyName": ""},
        {**GOOD, "minSalary": "not-a-number"},
        42, None,
    ]})
    result = discovery.search_jobs("Python")
    assert len(result.jobs) == 1
    assert result.jobs[0].opportunity.advertised_min_salary_brl is None


def test_non_remote_filters_do_not_hit_provider(monkeypatch):
    monkeypatch.setattr(discovery, "_get_page", lambda *args: pytest.fail("Must not call provider"))
    result = discovery.search_jobs("Analista", criteria=CandidateCriteria(allowed_work_modes=["hybrid"]))
    assert result.jobs == []


@pytest.mark.parametrize("query,page,country", [
    ("", 1, "BR"), ("a", 1, "BR"), ("a" * 81, 1, "BR"),
    ("Python", 0, "BR"), ("Python", 9, "BR"), ("Python", 1, "http://localhost"),
])
def test_invalid_input_rejected_before_network(query, page, country, monkeypatch):
    monkeypatch.setattr(discovery, "_get_page", lambda *args: pytest.fail("Must not call provider"))
    with pytest.raises(ValueError):
        discovery.search_jobs(query, page=page, country=country)


def test_network_request_pins_hostname_no_redirects_and_caches(monkeypatch):
    calls = []
    real_client = httpx.Client

    def fake_client(**kwargs):
        assert kwargs["follow_redirects"] is False
        assert kwargs["trust_env"] is False

        def handler(request):
            calls.append(str(request.url))
            assert request.url.host == "himalayas.app"
            assert request.url.path == "/jobs/api/search"
            assert request.url.params["country"] == "BR"
            return httpx.Response(200, headers={"content-type": "application/json"},
                                  json={"jobs": [GOOD]})

        return real_client(transport=httpx.MockTransport(handler), **kwargs)

    monkeypatch.setattr(discovery.httpx, "Client", fake_client)
    discovery._cache.clear()
    discovery._request_times.clear()
    first = discovery.search_jobs("Python")
    second = discovery.search_jobs("Python")
    assert len(first.jobs) == len(second.jobs) == 1
    assert len(calls) == 1


@pytest.mark.parametrize("status,content,ctype", [
    (302, b"", "text/html"), (429, b"", "application/json"),
    (200, b"<html>oops</html>", "text/html"),
    (200, b"x" * (discovery.MAX_BYTES + 10), "application/json"),
    (200, b'{"jobs":42}', "application/json"),
], ids=["redirect", "rate_limit", "html", "oversize", "invalid_schema"])
def test_provider_failures_are_safely_handled(status, content, ctype, monkeypatch):
    real_client = httpx.Client

    def fake_client(**kwargs):
        def handler(request):
            return httpx.Response(status, content=content, headers={"content-type": ctype})
        return real_client(transport=httpx.MockTransport(handler), **kwargs)

    monkeypatch.setattr(discovery.httpx, "Client", fake_client)
    discovery._cache.clear()
    discovery._request_times.clear()
    with pytest.raises(discovery.JobSearchUnavailable):
        discovery.search_jobs("unique")


def test_bounded_provider_request_budget(monkeypatch):
    monkeypatch.setattr(discovery, "_cache", {})
    monkeypatch.setattr(discovery, "_request_times", discovery.deque(
        [discovery.time.monotonic()] * discovery.MAX_NEW_REQUESTS_PER_MINUTE
    ))
    with pytest.raises(discovery.JobSearchUnavailable, match="Limite"):
        discovery._get_page("python", "BR", 1)


def test_get_endpoint_rejects_remote_clients_before_search(monkeypatch):
    monkeypatch.setattr(discovery, "_get_page", lambda *args: pytest.fail("No network"))
    client = TestClient(app, base_url="http://localhost")
    response = client.get("/api/v1/jobs/search", params={"q": "python"})
    assert response.status_code == 403


def test_get_endpoint_rejects_cross_origin_even_on_loopback(monkeypatch):
    monkeypatch.setattr(discovery, "_get_page", lambda *args: pytest.fail("No network"))
    client = TestClient(app, base_url="http://localhost",
                        client=("127.0.0.1", 51234))
    response = client.get("/api/v1/jobs/search", params={"q": "python"},
                          headers={"Origin": "https://malicious.invalid"})
    assert response.status_code == 403


def test_get_endpoint_serves_only_vetted_source_on_loopback(monkeypatch):
    monkeypatch.setattr(discovery, "_get_page", lambda *args: {"jobs": [GOOD]})
    client = TestClient(app, base_url="http://localhost",
                        client=("127.0.0.1", 51234))
    response = client.get("/api/v1/jobs/search", params={"q": "python"},
                          headers={"Origin": "http://localhost:3000"})
    assert response.status_code == 200
    assert response.json()["jobs"][0]["opportunity"]["source"] == "himalayas"
    assert "application" not in response.json()  # No application submission capability.


def test_get_endpoint_validates_query_length():
    client = TestClient(app, base_url="http://localhost",
                        client=("127.0.0.1", 51234))
    assert client.get("/api/v1/jobs/search", params={"q": "x"}).status_code == 422


def test_get_endpoint_rejects_spoofed_public_host_on_loopback(monkeypatch):
    monkeypatch.setattr(discovery, "_get_page", lambda *args: pytest.fail("No network"))
    client = TestClient(app, base_url="http://untrusted.example",
                        client=("127.0.0.1", 51234))
    response = client.get("/api/v1/jobs/search", params={"q": "python"})
    assert response.status_code == 403


def test_cloud_mode_disables_community_job_search(monkeypatch):
    monkeypatch.setattr(discovery, "_get_page", lambda *args: pytest.fail("No network"))
    from alinha_api import main
    monkeypatch.setattr(main, "get_mode", lambda: "cloud")
    client = TestClient(app, base_url="http://localhost",
                        client=("127.0.0.1", 51234))
    assert client.get("/api/v1/jobs/search", params={"q": "python"}).status_code == 403

"""GitHub issue-board source is data-only and limited to fixed Brazilian communities."""
import pytest

from alinha_api.agent import github_jobs as source
from alinha_api.agent.discovery import JobSearchUnavailable


def listing(*, number=123, board="backend-br/vagas"):
    return {
        "number": number,
        "title": "[Remoto] Desenvolvedora Python na Acme Software",
        "html_url": f"https://github.com/{board}/issues/{number}",
        "body": "Experiência em Python, FastAPI e APIs REST. " * 12,
        "labels": [{"name": "Remoto"}, {"name": "CLT"}],
    }


def test_github_job_parsing_preserves_evidence_and_original():
    job = source._normalize(listing(), "backend-br/vagas", "Python", True)
    assert job is not None
    assert job.opportunity.source == "github-vagas"
    assert job.opportunity.company == "Acme Software"
    assert job.opportunity.work_mode == "remote"
    assert job.opportunity.contract_type == "clt"
    assert job.opportunity.source_url.endswith("/issues/123")
    assert len(job.description) > len(job.excerpt)


def test_github_jobs_reject_url_spoofing_prs_and_irrelevant_titles():
    listing_data = listing()
    assert source._normalize({**listing_data, "html_url": "https://github.com.evil.test/backend-br/vagas/issues/123"},
                             "backend-br/vagas", "Python", False) is None
    assert source._normalize({**listing_data, "html_url": "https://github.com/other/repo/issues/123"},
                             "backend-br/vagas", "Python", False) is None
    assert source._normalize({**listing_data, "pull_request": {}},
                             "backend-br/vagas", "Python", False) is None
    assert source._normalize(listing_data, "backend-br/vagas", "Rust", False) is None


def test_remote_label_ambiguity_remains_unknown():
    ambiguous = listing()
    ambiguous["labels"].append({"name": "Híbrido"})
    result = source._normalize(ambiguous, "backend-br/vagas", "Python", False)
    assert result is not None and result.opportunity.work_mode == "unspecified"
    assert source._normalize(ambiguous, "backend-br/vagas", "Python", True) is None


def test_search_keeps_one_board_when_another_is_offline(monkeypatch):
    def fetch(board, page):
        if board == "frontendbr/vagas":
            raise JobSearchUnavailable("API unavailable")
        assert page == 1
        return [listing(), {**listing(), "pull_request": {"url": "x"}, "number": 3}]
    monkeypatch.setattr(source, "_fetch_board", fetch)
    result = source.search_github_jobs("Python", remote_only=True)
    assert len(result.jobs) == 1
    assert any("frontendbr/vagas" in reason for reason in result.limitations)


def test_no_fabrication_when_both_boards_fail(monkeypatch):
    def fail(*args):
        raise JobSearchUnavailable("Offline")
    monkeypatch.setattr(source, "_fetch_board", fail)
    with pytest.raises(JobSearchUnavailable):
        source.search_github_jobs("Python")


def test_constrained_query_and_github_host():
    with pytest.raises(ValueError):
        source.search_github_jobs("a")
    item = listing()
    item["html_url"] = "https://user:pass@github.com/backend-br/vagas/issues/123"
    assert source._normalize(item, "backend-br/vagas", "Python", False) is None

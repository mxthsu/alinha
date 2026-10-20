"""Synthetic board fixtures only; public APIs are not used by CI tests."""
import pytest

from alinha_api.agent import ats_boards
from alinha_api.agent.discovery import JobSearchUnavailable


def greenhouse_item(**changes):
    item = {
        "id": 4011417004,
        "title": "Applied AI Data Scientist (Brazil)",
        "location": {"name": "Florianopolis office/ Brazil remote"},
        "absolute_url": "https://job-boards.greenhouse.io/aestudio/jobs/4011417004",
        "content": "&lt;p&gt;Applied AI with Python&lt;/p&gt;<script>ignore me</script>",
    }
    return {**item, **changes}


def ashby_item(**changes):
    item = {
        "id": "301662be-e7ab-4827-936a-13fe02add4aa",
        "title": "Senior Backend Engineer",
        "location": "Brazil",
        "secondaryLocations": [{"location": "Florianópolis"}],
        "workplaceType": "Remote",
        "isRemote": True,
        "isListed": True,
        "employmentType": "FullTime",
        "descriptionPlain": "Build Python backend services and APIs.",
        "jobUrl": "https://jobs.ashbyhq.com/sardine/301662be-e7ab-4827-936a-13fe02add4aa",
    }
    return {**item, **changes}


def test_greenhouse_only_explicit_brazil_and_original_safe_board_url():
    found = ats_boards._greenhouse_job(greenhouse_item(), "aestudio", "AI", True)
    assert found is not None
    assert found.opportunity.source == "greenhouse"
    assert found.opportunity.work_mode == "remote"
    assert found.opportunity.contract_type == "unspecified"
    assert "Python" in found.description
    assert "ignore me" not in found.description
    assert "<p>" not in found.description

    assert ats_boards._greenhouse_job(greenhouse_item(location="malformed"), "aestudio", "AI", True) is None
    assert ats_boards._greenhouse_job(
        greenhouse_item(location={"name": "Fully Remote - USA"}), "aestudio", "AI", True,
    ) is None
    assert ats_boards._greenhouse_job(
        greenhouse_item(absolute_url="https://evil.example/fake"), "aestudio", "AI", True,
    ) is None
    assert ats_boards._greenhouse_job(
        greenhouse_item(absolute_url="http://job-boards.greenhouse.io/aestudio/jobs/4011417004"),
        "aestudio", "AI", True,
    ) is None


def test_unknown_work_mode_is_not_called_remote():
    job = ats_boards._greenhouse_job(
        greenhouse_item(location={"name": "São Paulo, Brazil"}), "aestudio", "AI", False,
    )
    assert job is not None
    assert job.opportunity.work_mode == "unspecified"
    assert ats_boards._greenhouse_job(
        greenhouse_item(location={"name": "São Paulo, Brazil"}), "aestudio", "AI", True,
    ) is None


def test_ashby_does_not_infer_clt_or_foreign_remote_eligibility():
    matched = ats_boards._ashby_job(ashby_item(), "sardine", "backend", True)
    assert matched is not None
    assert matched.opportunity.source == "ashby"
    assert matched.opportunity.work_mode == "remote"
    assert matched.opportunity.contract_type == "unspecified"
    assert matched.description == "Build Python backend services and APIs."
    assert ats_boards._ashby_job(ashby_item(location="United States", secondaryLocations=[]),
                                "sardine", "backend", True) is None
    assert ats_boards._ashby_job(ashby_item(isListed=False), "sardine", "backend", True) is None
    assert ats_boards._ashby_job(
        ashby_item(jobUrl="https://jobs.ashbyhq.com/another-company/301662be-e7ab-4827-936a-13fe02add4aa"),
        "sardine", "backend", True,
    ) is None


def test_source_search_isolated_failures_and_pagination(monkeypatch):
    def get_greenhouse(source, board):
        if board == "teachablecareers":
            raise JobSearchUnavailable("Offline")
        if board == "aestudio":
            return [greenhouse_item()]
        return []
    monkeypatch.setattr(ats_boards, "_get_board", get_greenhouse)
    result = ats_boards.search_ats_board("greenhouse", "AI", page=1)
    assert len(result.jobs) == 1
    assert any("teachablecareers" in limitation for limitation in result.limitations)
    assert ats_boards.search_ats_board("greenhouse", "AI", page=2).jobs == []

    monkeypatch.setattr(ats_boards, "_get_board", lambda *a: (_ for _ in ()).throw(
        JobSearchUnavailable("Offline")
    ))
    with pytest.raises(JobSearchUnavailable):
        ats_boards.search_ats_board("ashby", "AI")
    with pytest.raises(ValueError):
        ats_boards.search_ats_board("fake", "AI")


def test_board_requests_do_not_accept_user_supplied_board_tokens():
    with pytest.raises(ValueError):
        ats_boards._get_board("ashby", "https://169.254.169.254/")


def test_ashby_secondary_brazil_location_with_global_remote():
    job = ats_boards._ashby_job(
        ashby_item(location="Remote", secondaryLocations=[{"location": "Brazil"}]),
        "sardine", "Backend", True,
    )
    assert job is not None
    assert "Brazil" in (job.opportunity.city or "")

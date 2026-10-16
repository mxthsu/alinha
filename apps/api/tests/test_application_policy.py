"""Synthetic, offline application planning tests: no real people or portals."""

from datetime import UTC, datetime, timedelta

import pytest
from pydantic import ValidationError

from alinha_api.agent.models import (
    ApplicationConsent,
    CandidateCriteria,
    DispatchContext,
    JobOpportunity,
)
from alinha_api.agent.policy import evaluate_application

NOW = datetime(2026, 10, 16, 16, 0, tzinfo=UTC)


def fixtures():
    vacancy = JobOpportunity(
        source="example_jobs", external_id="vaga-001",
        title="Engenheira de Software", company="Empresa Fictícia",
        city="Florianópolis, SC", work_mode="hybrid", contract_type="clt",
        advertised_min_salary_brl=7500,
    )
    criteria = CandidateCriteria(
        allowed_cities=["florianópolis, sc"], allowed_work_modes=["hybrid", "remote"],
        allowed_contract_types=["clt"], minimum_advertised_salary_brl=7000,
    )
    consent = ApplicationConsent(
        subject_id="fictional-user", approved_resume_revision="revision-1",
        allowed_platforms=["example_jobs"], expires_at=NOW + timedelta(days=4),
        max_submissions_per_day=3, autonomy="bounded_auto",
    )
    context = DispatchContext(
        subject_id="fictional-user", resume_revision="revision-1",
        submissions_today=1, connector_supports_submission=True,
        connector_authorized=True, resume_approved=True, answers_confirmed=True,
    )
    return vacancy, criteria, consent, context


def decision(**overrides):
    vacancy, criteria, consent, context = fixtures()
    vacancy = vacancy.model_copy(update=overrides.get("vacancy", {}))
    criteria = criteria.model_copy(update=overrides.get("criteria", {}))
    consent = consent.model_copy(update=overrides.get("consent", {}))
    context = context.model_copy(update=overrides.get("context", {}))
    return evaluate_application(
        opportunity=vacancy, criteria=criteria, consent=consent, context=context,
        now=overrides.get("now", NOW),
    )


def test_bounded_auto_authorizes_preflight_but_not_a_submission():
    response = decision()
    assert response.status == "authorized_for_dispatch"
    assert response.reasons == []
    assert response.opportunity_id == "vaga-001"


@pytest.mark.parametrize(
    ("overrides", "reason"),
    [
        ({"context": {"already_submitted": True}}, "already_submitted"),
        ({"consent": {"enabled": False}}, "consent_paused"),
        ({"consent": {"expires_at": NOW}}, "consent_expired"),
        ({"context": {"subject_id": "another-user"}}, "consent_subject_mismatch"),
        ({"context": {"resume_revision": "revision-2"}}, "resume_version_changed"),
        ({"vacancy": {"source": "unauthorized_board"}}, "platform_not_authorized"),
        ({"context": {"submissions_today": 3}}, "daily_limit_reached"),
    ],
)
def test_hard_guards_block_submission(overrides, reason):
    response = decision(**overrides)
    assert response.status == "blocked"
    assert reason in response.reasons


@pytest.mark.parametrize(
    ("overrides", "reason"),
    [
        ({"context": {"connector_supports_submission": False}}, "connector_unavailable"),
        ({"context": {"connector_authorized": False}}, "connector_not_authorized"),
        ({"context": {"human_verification_required": True}}, "human_verification_required"),
        ({"context": {"answers_confirmed": False}}, "unconfirmed_answers"),
        ({"context": {"resume_approved": False}}, "resume_not_approved"),
        ({"vacancy": {"advertised_min_salary_brl": None}}, "insufficient_job_information"),
        ({"vacancy": {"contract_type": "unspecified"}}, "insufficient_job_information"),
        ({"vacancy": {"city": None}}, "insufficient_job_information"),
    ],
)
def test_review_gates_never_auto_authorize(overrides, reason):
    response = decision(**overrides)
    assert response.status == "approval_required"
    assert reason in response.reasons


def test_assisted_mode_requires_individual_approval():
    response = decision(consent={"autonomy": "assisted"})
    assert response.status == "approval_required"
    assert "explicit_approval_required" in response.reasons
    approved = decision(
        consent={"autonomy": "assisted"},
        context={"explicit_approval_for_this_job": True},
    )
    assert approved.status == "authorized_for_dispatch"


@pytest.mark.parametrize(
    "patch",
    [
        {"work_mode": "onsite"},
        {"contract_type": "pj"},
        {"city": "Curitiba, PR"},
        {"advertised_min_salary_brl": 5000},
    ],
)
def test_candidate_hard_filters_reject_unwanted_jobs(patch):
    response = decision(vacancy=patch)
    assert response.status == "filtered"


def test_remote_work_not_filtered_by_city():
    response = decision(vacancy={"work_mode": "remote", "city": "São Paulo, SP"})
    assert response.status == "authorized_for_dispatch"


def test_comparisons_are_case_insensitive():
    response = decision(vacancy={"source": "EXAMPLE_JOBS", "city": "FLORIANÓPOLIS, SC"})
    assert response.status == "authorized_for_dispatch"


def test_missing_salary_does_not_look_like_a_salary_below_threshold():
    response = decision(vacancy={"advertised_min_salary_brl": None})
    assert response.status == "approval_required"
    assert "criteria_mismatch" not in response.reasons


def test_consent_rejects_duplicate_platforms_and_naive_expiry():
    _, _, consent, _ = fixtures()
    with pytest.raises(ValidationError):
        consent.model_copy().model_validate({
            **consent.model_dump(), "allowed_platforms": ["EXAMPLE_JOBS", "example_jobs"]
        })
    with pytest.raises(ValidationError):
        ApplicationConsent(
            subject_id="fictional-user", approved_resume_revision="revision-1",
            allowed_platforms=["example_jobs"], expires_at=datetime(2026, 10, 20),
            max_submissions_per_day=5,
        )


def test_naive_runtime_clock_fails_closed():
    vacancy, criteria, consent, context = fixtures()
    with pytest.raises(ValueError, match="timezone"):
        evaluate_application(
            opportunity=vacancy, criteria=criteria,
            consent=consent, context=context, now=datetime(2026, 10, 16),
        )

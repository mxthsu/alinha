"""Conservative preflight for user-authorized applications.

This module does not browse, submit, persist, or call providers. A future vetted
connector may dispatch only after the server re-evaluates these trusted gates.
"""

from datetime import UTC, datetime

from alinha_api.agent.models import (
    ApplicationConsent,
    ApplicationDecision,
    CandidateCriteria,
    DecisionReason,
    DispatchContext,
    JobOpportunity,
)


def _matches(value: str, options: list[str]) -> bool:
    return not options or value.strip().casefold() in {
        option.strip().casefold() for option in options
    }


def evaluate_application(
    *,
    opportunity: JobOpportunity,
    criteria: CandidateCriteria,
    consent: ApplicationConsent,
    context: DispatchContext,
    now: datetime | None = None,
) -> ApplicationDecision:
    """Check filters, identity, authorization, safety and review requirements."""
    now = now if now is not None else datetime.now(UTC)
    if now.tzinfo is None or now.utcoffset() is None:
        raise ValueError("now must have a timezone")

    def result(status: str, reasons: list[DecisionReason]) -> ApplicationDecision:
        return ApplicationDecision(
            status=status,
            reasons=reasons,
            opportunity_source=opportunity.source,
            opportunity_id=opportunity.external_id,
        )

    if context.already_submitted:
        return result("blocked", ["already_submitted"])

    if (
        (criteria.allowed_work_modes
         and opportunity.work_mode != "unspecified"
         and not _matches(opportunity.work_mode, criteria.allowed_work_modes))
        or (
            criteria.allowed_contract_types
            and opportunity.contract_type != "unspecified"
            and not _matches(opportunity.contract_type, criteria.allowed_contract_types)
        )
        or (
            criteria.allowed_cities
            and opportunity.work_mode != "remote"
            and opportunity.city is not None
            and not _matches(opportunity.city, criteria.allowed_cities)
        )
        or (
            criteria.minimum_advertised_salary_brl is not None
            and opportunity.advertised_min_salary_brl is not None
            and opportunity.advertised_min_salary_brl < criteria.minimum_advertised_salary_brl
        )
    ):
        return result("filtered", ["criteria_mismatch"])

    blockers: list[DecisionReason] = []
    if not consent.enabled:
        blockers.append("consent_paused")
    if now >= consent.expires_at:
        blockers.append("consent_expired")
    if context.subject_id != consent.subject_id:
        blockers.append("consent_subject_mismatch")
    if context.resume_revision != consent.approved_resume_revision:
        blockers.append("resume_version_changed")
    if not _matches(opportunity.source, consent.allowed_platforms):
        blockers.append("platform_not_authorized")
    if context.submissions_today >= consent.max_submissions_per_day:
        blockers.append("daily_limit_reached")
    if blockers:
        return result("blocked", blockers)

    review: list[DecisionReason] = []
    if (
        (criteria.allowed_cities and opportunity.work_mode != "remote" and not opportunity.city)
        or (criteria.allowed_work_modes and opportunity.work_mode == "unspecified")
        or (criteria.allowed_contract_types and opportunity.contract_type == "unspecified")
        or (
            criteria.minimum_advertised_salary_brl is not None
            and opportunity.advertised_min_salary_brl is None
        )
    ):
        review.append("insufficient_job_information")

    if consent.autonomy == "assisted" and not context.explicit_approval_for_this_job:
        review.extend(["assisted_mode", "explicit_approval_required"])
    if not context.connector_supports_submission:
        review.append("connector_unavailable")
    if not context.connector_authorized:
        review.append("connector_not_authorized")
    if context.human_verification_required:
        review.append("human_verification_required")
    if not context.answers_confirmed:
        review.append("unconfirmed_answers")
    if not context.resume_approved:
        review.append("resume_not_approved")

    if review:
        return result("approval_required", review)
    return result("authorized_for_dispatch", [])

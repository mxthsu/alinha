"""Public, provider-independent contracts for Brazilian job applications."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator

WorkMode = Literal["remote", "hybrid", "onsite", "unspecified"]
ContractType = Literal["clt", "pj", "internship", "trainee", "temporary", "other", "unspecified"]
AutonomyMode = Literal["assisted", "bounded_auto"]
DecisionStatus = Literal["filtered", "blocked", "approval_required", "authorized_for_dispatch"]
DecisionReason = Literal[
    "criteria_mismatch", "insufficient_job_information", "already_submitted",
    "consent_paused", "consent_expired", "consent_subject_mismatch", "resume_version_changed",
    "platform_not_authorized", "daily_limit_reached", "assisted_mode",
    "connector_unavailable", "connector_not_authorized", "human_verification_required",
    "unconfirmed_answers", "resume_not_approved", "explicit_approval_required",
]


class JobOpportunity(BaseModel):
    """Normalized facts from a vacancy. Never infer missing values."""

    source: str = Field(min_length=2, max_length=80)
    external_id: str = Field(min_length=1, max_length=200)
    title: str = Field(min_length=2, max_length=180)
    company: str = Field(min_length=2, max_length=180)
    city: str | None = Field(default=None, max_length=120)
    work_mode: WorkMode = "unspecified"
    contract_type: ContractType = "unspecified"
    advertised_min_salary_brl: int | None = Field(default=None, ge=0)
    # Source URLs do not confer permission to automate a third-party website.
    source_url: str | None = Field(default=None, max_length=2048)


class CandidateCriteria(BaseModel):
    """User-defined hard filters. Empty lists mean no filter for that dimension."""

    allowed_cities: list[str] = Field(default_factory=list, max_length=30)
    allowed_work_modes: list[WorkMode] = Field(default_factory=list, max_length=4)
    allowed_contract_types: list[ContractType] = Field(default_factory=list, max_length=7)
    minimum_advertised_salary_brl: int | None = Field(default=None, ge=0)

    @field_validator("allowed_cities")
    @classmethod
    def check_cities(cls, value: list[str]) -> list[str]:
        if any(not city.strip() or len(city) > 120 for city in value):
            raise ValueError("Informe cidades válidas com até 120 caracteres.")
        return value


class ApplicationConsent(BaseModel):
    """Explicit prior authorization scoped to applicant, résumé revision and platforms."""

    subject_id: str = Field(min_length=1, max_length=128)
    approved_resume_revision: str = Field(min_length=1, max_length=128)
    allowed_platforms: list[str] = Field(min_length=1, max_length=20)
    expires_at: datetime
    max_submissions_per_day: int = Field(ge=1, le=50)
    autonomy: AutonomyMode = "assisted"
    enabled: bool = True

    @field_validator("expires_at")
    @classmethod
    def require_timezone(cls, value: datetime) -> datetime:
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError("A autorização precisa de data e fuso horário.")
        return value

    @field_validator("allowed_platforms")
    @classmethod
    def check_platforms(cls, value: list[str]) -> list[str]:
        if any(not item.strip() or len(item) > 80 for item in value):
            raise ValueError("Identifique cada plataforma permitida.")
        if len({item.strip().casefold() for item in value}) != len(value):
            raise ValueError("Plataformas duplicadas não são permitidas.")
        return value


class DispatchContext(BaseModel):
    """Server-verified facts, NEVER derived from job descriptions or model assertions."""

    subject_id: str = Field(min_length=1, max_length=128)
    resume_revision: str = Field(min_length=1, max_length=128)
    submissions_today: int = Field(ge=0)
    already_submitted: bool = False
    connector_supports_submission: bool = False
    connector_authorized: bool = False
    human_verification_required: bool = False
    resume_approved: bool = False
    answers_confirmed: bool = False
    explicit_approval_for_this_job: bool = False


class ApplicationDecision(BaseModel):
    """Planning decision only. Even 'authorized_for_dispatch' never sends anything."""

    status: DecisionStatus
    reasons: list[DecisionReason] = Field(default_factory=list)
    opportunity_source: str
    opportunity_id: str

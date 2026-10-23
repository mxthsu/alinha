"""Literal, review-first vacancy evidence from a locally stored résumé.

Public job descriptions are untrusted data; they never drive tool policy or model
prompts. Shared skill terms are *signals*, not evidence of hiring eligibility.
"""

from __future__ import annotations

import re
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from alinha_api.agent.discovery import JobSearchResult
from alinha_api.resume_schema import ResumeProfile


class AssessedJob(BaseModel):
    model_config = ConfigDict(extra="forbid")
    source: str
    external_id: str
    title: str
    company: str
    matched_declared_skills: list[str] = Field(default_factory=list, max_length=50)
    review_required: Literal[True] = True


class AssessmentReport(BaseModel):
    model_config = ConfigDict(extra="forbid")
    profile_revision: int = Field(ge=1)
    jobs: list[AssessedJob] = Field(max_length=15)
    limitations: list[str] = Field(
        default_factory=lambda: [
            "Coincidências literais não comprovam qualificação ou requisitos da vaga.",
            "Competências são declaradas no currículo e exigem revisão humana.",
            "Texto de anúncios não concede permissões a ferramentas nem autoriza candidatura.",
        ]
    )
    external_submission: Literal[False] = False


def assess_listings(
    profile: ResumeProfile, listings: JobSearchResult, revision: int
) -> AssessmentReport:
    """Deterministic, bounded search for explicitly declared terms only."""
    declared: list[str] = []
    seen: set[str] = set()
    for value in profile.skills:
        term = value.strip()
        normalized = term.casefold()
        if (
            not term
            or normalized in seen
            or re.search(r"https?://|[@<>\r\n{}]", term, re.IGNORECASE)
            or any(ord(ch) < 32 for ch in term)
        ):
            continue
        seen.add(normalized)
        declared.append(term)

    output: list[AssessedJob] = []
    for listing in listings.jobs[:15]:
        opportunity = listing.opportunity
        text = " ".join(
            value for value in (opportunity.title, listing.description, listing.excerpt) if value
        )[:15000]
        matches = [
            term
            for term in declared
            if re.search(r"(?<!\w)" + re.escape(term) + r"(?!\w)", text, re.IGNORECASE)
        ]
        output.append(
            AssessedJob(
                source=opportunity.source,
                external_id=opportunity.external_id,
                title=opportunity.title,
                company=opportunity.company,
                matched_declared_skills=matches,
            )
        )
    return AssessmentReport(profile_revision=revision, jobs=output)

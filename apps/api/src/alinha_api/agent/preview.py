"""Bounded, evidence-based local application drafts; no submission connector."""

from __future__ import annotations

from ipaddress import ip_address
from typing import Literal
from urllib.parse import urlsplit

from pydantic import BaseModel, ConfigDict, Field

from alinha_api.agent.assessment import AssessmentReport
from alinha_api.agent.discovery import JobSearchResult


class PreviewItem(BaseModel):
    model_config = ConfigDict(extra="forbid")
    source: str
    external_id: str
    title: str
    company: str
    source_url: str
    matched_declared_skills: list[str] = Field(max_length=50)
    draft_text: str = Field(max_length=1100)
    unknown_questions: list[str] = Field(default_factory=list, max_length=5)
    status: Literal["needs_review"] = "needs_review"
    external_submission: Literal[False] = False


class PreviewBatch(BaseModel):
    model_config = ConfigDict(extra="forbid")
    profile_revision: int = Field(ge=1)
    previews: list[PreviewItem] = Field(max_length=3)
    limitations: list[str] = Field(
        default_factory=lambda: [
            "Textos gerados localmente a partir de competências declaradas no currículo.",
            "Coincidências literais não comprovam experiência ou adequação à vaga.",
            "Nenhuma candidatura foi preenchida ou enviada. Revisão humana obrigatória.",
        ]
    )
    external_submission: Literal[False] = False


def _safe_link(value: str | None) -> bool:
    if not value or len(value) > 1600:
        return False
    try:
        parsed = urlsplit(value)
        host = (parsed.hostname or "").casefold()
        try:
            if not ip_address(host).is_global:
                return False
        except ValueError:
            pass  # Public DNS hostname, not an IP address.
        return (
            parsed.scheme == "https"
            and bool(host)
            and "." in host
            and not parsed.username
            and not parsed.password
            and parsed.port in (None, 443)
            and host != "localhost"
            and not host.endswith((".local", ".localhost", ".internal", ".test", ".invalid"))
        )
    except ValueError:
        return False


def prepare_local_previews(
    assessment: AssessmentReport,
    listings: JobSearchResult,
) -> PreviewBatch:
    """Prefer the strongest literal overlaps, never infer unsupported details."""
    jobs = {(item.opportunity.source, item.opportunity.external_id): item for item in listings.jobs}
    candidates = sorted(
        enumerate(assessment.jobs),
        key=lambda indexed: (-len(indexed[1].matched_declared_skills), indexed[0]),
    )
    previews: list[PreviewItem] = []
    for _, result in candidates:
        if len(previews) == 3:
            break
        job = jobs.get((result.source, result.external_id))
        if job is None or not _safe_link(job.opportunity.source_url):
            continue
        # Each included claim is sourced from *both* the local declared skills and
        # a literal mention in the public vacancy. Not a semantic fit judgement.
        if result.matched_declared_skills:
            skills = ", ".join(result.matched_declared_skills[:8])
            evidence = (
                f"No meu currículo, declaro competências em {skills}. "
                "Gostaria de entender melhor como esses conhecimentos se relacionam "
                "com os requisitos da vaga."
            )
        else:
            evidence = (
                "Gostaria de conhecer melhor os requisitos da vaga para avaliar "
                "como minha trajetória profissional pode contribuir."
            )
        # Never echo untrusted advertisement titles/companies into the message.
        # The source identity remains available as reviewed metadata on the card.
        draft = f"Olá! Tenho interesse nesta oportunidade. {evidence}"
        previews.append(
            PreviewItem(
                source=result.source,
                external_id=result.external_id,
                title=result.title,
                company=result.company,
                source_url=job.opportunity.source_url,
                matched_declared_skills=result.matched_declared_skills,
                draft_text=draft,
                unknown_questions=[
                    "Confirme sua experiência e conhecimentos antes de usar o texto.",
                    "Verifique no anúncio os requisitos, a disponibilidade e a forma de candidatura.",
                ],
            )
        )
    return PreviewBatch(profile_revision=assessment.profile_revision, previews=previews)

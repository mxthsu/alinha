"""Deterministic, conservative career-job filtering using declared listing facts.

Never infer missing salary, city, contract or working arrangement. All constraints
are confirmed by the user and applied after allowlisted provider normalization.
"""

from __future__ import annotations

import unicodedata

from alinha_api.agent.discovery import JobSearchResult
from alinha_api.agent.models import CandidateCriteria, JobOpportunity


def _normalize_city(value: str) -> str:
    return "".join(
        char
        for char in unicodedata.normalize("NFKD", value.strip().casefold())
        if not unicodedata.combining(char)
    )


def matches_criteria(job: JobOpportunity, criteria: CandidateCriteria) -> bool:
    if criteria.allowed_work_modes and job.work_mode not in criteria.allowed_work_modes:
        return False
    if criteria.allowed_contract_types and job.contract_type not in criteria.allowed_contract_types:
        return False
    if criteria.allowed_cities:
        if job.city is None:
            return False
        city = _normalize_city(job.city)
        if not any(city == _normalize_city(allowed) for allowed in criteria.allowed_cities):
            return False
    minimum = criteria.minimum_advertised_salary_brl
    return not (
        minimum is not None
        and (job.advertised_min_salary_brl is None or job.advertised_min_salary_brl < minimum)
    )


def filter_public_jobs(
    result: JobSearchResult,
    criteria: CandidateCriteria,
    max_jobs: int,
) -> JobSearchResult:
    """Filter before limiting count; retain source attribution and caveats."""
    if not 1 <= max_jobs <= 15:
        raise ValueError("Limite de vagas inválido.")
    jobs = [job for job in result.jobs if matches_criteria(job.opportunity, criteria)]
    limitations = list(result.limitations)
    if len(jobs) < len(result.jobs):
        limitations.append(
            "Filtros rígidos aplicados: vagas sem informações verificadas para "
            "cidade, modalidade, vínculo ou salário foram excluídas quando exigidas."
        )
    return result.model_copy(
        update={
            "jobs": jobs[:max_jobs],
            "limitations": limitations,
        }
    )

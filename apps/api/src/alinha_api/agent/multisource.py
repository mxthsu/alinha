"""Merge supported job sources without making one provider a single point of failure."""
from __future__ import annotations

from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor, as_completed
from urllib.parse import urlsplit

from alinha_api.agent.discovery import JobSearchResult, JobSearchUnavailable


def _job_key(job: object) -> tuple[str, ...]:
    opportunity = job.opportunity
    url = opportunity.source_url
    if url:
        parts = urlsplit(url)
        return ("url", parts.netloc.casefold(), parts.path.rstrip("/").casefold())
    return ("id", opportunity.source.casefold(), opportunity.external_id.casefold())

def merge_sources(results: list[JobSearchResult], failed: list[str] | None = None) -> JobSearchResult:
    """Preserve source provenance; dedupe identical canonical links only."""
    jobs = []
    seen = set()
    names = []
    for result in results:
        names.append(result.source_name)
        for job in result.jobs:
            key = _job_key(job)
            if key in seen:
                continue
            seen.add(key)
            jobs.append(job)
    errors = failed or []
    return JobSearchResult(
        jobs=jobs[:40],
        source_name=" e ".join(names) or "Fontes de vagas",
        source_url="https://portal.gupy.io/",
        description="Oportunidades encontradas nas fontes selecionadas.",
        limitations=[
            "Requisitos e disponibilidade devem ser verificados no anúncio original.",
            *[f"A fonte {name} não respondeu nesta consulta." for name in errors],
        ],
    )

def search_multi_source(
    sources: dict[str, Callable[[], JobSearchResult]],
) -> JobSearchResult:
    """Only caller-supplied allowlisted connectors. Fail open per provider, never fabricate jobs."""
    if not sources:
        raise JobSearchUnavailable("Nenhuma fonte de vagas está habilitada.")
    successes: list[tuple[str, JobSearchResult]] = []
    failures: list[str] = []
    with ThreadPoolExecutor(max_workers=min(2, len(sources))) as pool:
        futures = {pool.submit(callback): name for name, callback in sources.items()}
        for future in as_completed(futures):
            name = futures[future]
            try:
                successes.append((name, future.result()))
            except (JobSearchUnavailable, ValueError):
                failures.append(name)
    if not successes:
        raise JobSearchUnavailable("As fontes de vagas estão temporariamente indisponíveis.")
    # Stable ordering independent of network response time.
    order = {name: i for i, name in enumerate(sources)}
    successes.sort(key=lambda item: order[item[0]])
    return merge_sources([value for _, value in successes], failures)

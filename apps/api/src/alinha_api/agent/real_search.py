"""Trusted server-side search dispatcher for persisted Alinha journeys.

The browser can request execution, but cannot select providers, URLs, tools or
claim completion. The real provider search follows configured local connectors.
"""

from __future__ import annotations

from collections.abc import Callable
from uuid import UUID

from alinha_api.agent.discovery import JobSearchResult
from alinha_api.agent.journey_store import JourneyConflict, JourneySnapshot, JourneyStore


class SearchToolUnavailable(Exception):
    """Provider failed after the search lease was reserved."""


def execute_authorized_search(
    store: JourneyStore,
    run_id: UUID,
    search: Callable[[str], JobSearchResult],
) -> JourneySnapshot:
    """Exactly one search per run, bounded and never automatically retried."""
    lease = store.begin_step(run_id, 0)
    # An already-cancelled run fails before reaching any external connector.
    try:
        result = JobSearchResult.model_validate(search(lease.query))
        # Allowlisted connectors may return up to 40; authorized limit is <=15.
        trimmed = result.model_copy(update={"jobs": result.jobs[: lease.max_jobs]})
    except Exception as exc:
        # If cancelled concurrently, fail_step refuses the stale lease.
        store.fail_step(lease)
        raise SearchToolUnavailable("Busca não concluída. Consulte o estado da jornada.") from exc
    try:
        return store.finish_search(lease, trimmed)
    except JourneyConflict as exc:
        # Invalid provider output cannot leave an in-flight run forever.
        # A concurrent cancellation also rejects the failure transition.
        store.fail_step(lease)
        raise SearchToolUnavailable("Os resultados não puderam ser validados.") from exc

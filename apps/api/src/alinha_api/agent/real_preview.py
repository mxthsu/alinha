"""Backend-only preview execution from immutable, reviewable evidence."""

from __future__ import annotations

from collections.abc import Callable
from uuid import UUID

from alinha_api.agent.journey_store import JourneyConflict, JourneySnapshot, JourneyStore
from alinha_api.agent.preview import prepare_local_previews


class PreviewUnavailable(Exception):
    """A local draft could not safely be completed."""


def execute_authorized_previews(
    store: JourneyStore,
    run_id: UUID,
    current_resume_revision: Callable[[], int],
) -> JourneySnapshot:
    """Generate, verify and persist up to three drafts, without browser/ATS submission."""
    lease = store.begin_step(run_id, 2)
    try:
        if lease.profile_revision is None or current_resume_revision() != lease.profile_revision:
            raise PreviewUnavailable("Currículo alterado depois de iniciar a jornada.")
        batch = prepare_local_previews(
            store.get_assessment(run_id),
            store.get_search_result(run_id),
        )
        if current_resume_revision() != lease.profile_revision:
            raise PreviewUnavailable("Currículo alterado durante a preparação.")
    except Exception as exc:
        store.fail_step(lease)
        raise PreviewUnavailable("Não foi possível preparar os rascunhos locais.") from exc
    try:
        return store.finish_previews(lease, batch)
    except JourneyConflict as exc:
        # If a concurrent cancellation wins, the lease is invalidated.
        store.fail_step(lease)
        raise PreviewUnavailable("Prévia inconsistente ou não autorizada.") from exc

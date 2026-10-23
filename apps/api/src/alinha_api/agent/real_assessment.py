"""Trusted local skill-term assessment of persisted search results."""

from __future__ import annotations

from collections.abc import Callable
from uuid import UUID

from alinha_api.agent.assessment import assess_listings
from alinha_api.agent.journey_store import (
    JourneyConflict,
    JourneySnapshot,
    JourneyStore,
)
from alinha_api.services.community_storage import SavedResume


class AssessmentUnavailable(Exception):
    """No safe, revision-consistent local comparison is available."""


def execute_authorized_assessment(
    store: JourneyStore,
    run_id: UUID,
    read_profile: Callable[[], tuple[object | None, int]],
) -> JourneySnapshot:
    """Use only locally saved skills and previously stored job announcements."""
    lease = store.begin_step(run_id, 1)
    try:
        record, revision = read_profile()
        if lease.profile_revision is None or revision != lease.profile_revision or record is None:
            raise AssessmentUnavailable(
                "Importe e confirme a versão do currículo para esta jornada."
            )
        profile = SavedResume.model_validate(record).profile
        source = store.get_search_result(run_id)
        report = assess_listings(profile, source, revision)
        # Reject concurrent CV edits before persisting a report.
        _, current_revision = read_profile()
        if current_revision != revision:
            raise AssessmentUnavailable("Currículo atualizado durante a análise.")
    except Exception as exc:
        store.fail_step(lease)
        raise AssessmentUnavailable(
            "Comparação indisponível. Verifique currículo e versão."
        ) from exc
    try:
        return store.finish_assessment(lease, report)
    except JourneyConflict as exc:
        # A concurrent cancel also invalidates fail_step, leaving the cancellation intact.
        store.fail_step(lease)
        raise AssessmentUnavailable("A comparação não pôde ser persistida.") from exc

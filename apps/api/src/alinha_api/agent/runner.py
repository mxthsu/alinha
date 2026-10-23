"""One-command, restart-aware execution of the authorized Community career plan.

Only fixed server-owned steps are dispatched. A model cannot add tools, request
more quotas or trigger external application submissions.
"""

from __future__ import annotations

from collections.abc import Callable
from uuid import UUID

from pydantic import ValidationError

from alinha_api.agent.discovery import JobSearchResult
from alinha_api.agent.journey_store import JourneyConflict, JourneySnapshot, JourneyStore
from alinha_api.agent.real_assessment import execute_authorized_assessment
from alinha_api.agent.real_preview import execute_authorized_previews
from alinha_api.agent.real_search import execute_authorized_search
from alinha_api.services.community_storage import SavedResume


def run_authorized_journey(
    store: JourneyStore,
    run_id: UUID,
    *,
    search: Callable[[str], JobSearchResult],
    read_profile: Callable[[], tuple[object | None, int]],
) -> JourneySnapshot:
    """Advance saved steps at most once each; never replay ambiguous operations."""
    snapshot = store.get(run_id)
    if snapshot.status == "needs_review":
        if snapshot.next_step != len(snapshot.plan):
            raise JourneyConflict(
                "Jornada interrompida: revisão manual necessária antes de continuar."
            )
        return snapshot
    if snapshot.status != "ready":
        raise JourneyConflict("Jornada não está pronta para executar.")
    # Avoid consuming connector quota for an invalid or changed local profile.
    try:
        profile, revision = read_profile()
    except Exception as exc:
        raise JourneyConflict("Currículo local indisponível para a jornada.") from exc
    if (
        profile is None
        or snapshot.profile_revision is None
        or revision != snapshot.profile_revision
    ):
        raise JourneyConflict("Confirme uma versão atual do currículo antes de iniciar.")
    try:
        SavedResume.model_validate(profile)
    except ValidationError as exc:
        raise JourneyConflict("Currículo local inválido; revise antes da busca.") from exc
    for _ in range(3):
        if snapshot.status == "needs_review":
            if snapshot.next_step != len(snapshot.plan):
                raise JourneyConflict(
                    "Jornada interrompida: revisão manual necessária antes de continuar."
                )
            return snapshot
        if snapshot.status != "ready" or snapshot.next_step >= len(snapshot.plan):
            raise JourneyConflict("Jornada interrompida ou plano inconsistente.")
        tool = snapshot.plan[snapshot.next_step]
        if tool == "job.search":
            snapshot = execute_authorized_search(store, run_id, search)
        elif tool == "job.assess":
            snapshot = execute_authorized_assessment(store, run_id, read_profile)
        elif tool == "application.preview":
            snapshot = execute_authorized_previews(
                store,
                run_id,
                lambda: read_profile()[1],
            )
        else:
            raise JourneyConflict("Ferramenta fora da lista permitida.")
    if snapshot.status != "needs_review":
        raise JourneyConflict("Jornada não concluiu as etapas previstas.")
    return snapshot

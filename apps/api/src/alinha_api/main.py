"""HTTP interface with local-only provider OAuth and evidence-checked analysis."""
import os
import sqlite3
from typing import Annotated
from uuid import UUID

from fastapi import FastAPI, File, Form, HTTPException, Query, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse, Response
from pydantic import BaseModel, Field, ValidationError
from pypdf.errors import PdfReadError

from alinha_api.agent.assessment import AssessmentReport
from alinha_api.agent.ats_boards import search_ats_board
from alinha_api.agent.call_budget import (
    CallBudgetExhausted,
    CallBudgetUnavailable,
    DuplicateIntentRequest,
    reserve_call,
)
from alinha_api.agent.discovery import JobSearchResult, JobSearchUnavailable, search_jobs
from alinha_api.agent.github_jobs import search_github_jobs
from alinha_api.agent.gupy import search_gupy
from alinha_api.agent.intent_model import (
    MODELS,
    IntentRequest,
    ReviewedIntentPlan,
    build_reviewed_plan,
    validated_proposal,
)
from alinha_api.agent.journey_store import (
    JourneyConflict,
    JourneyNotFound,
    JourneySnapshot,
    JourneyStorageUnavailable,
    JourneyStore,
    StartJourney,
)
from alinha_api.agent.lever import search_lever
from alinha_api.agent.models import CandidateCriteria
from alinha_api.agent.multisource import search_multi_source
from alinha_api.agent.preview import PreviewBatch
from alinha_api.agent.real_assessment import AssessmentUnavailable, execute_authorized_assessment
from alinha_api.agent.real_preview import PreviewUnavailable, execute_authorized_previews
from alinha_api.agent.real_search import SearchToolUnavailable, execute_authorized_search
from alinha_api.agent.runner import run_authorized_journey
from alinha_api.agent.runtime import (
    AdvanceRun,
    AgentCoordinator,
    ConfirmReview,
    RunSnapshot,
    RunViolation,
    StartRun,
)
from alinha_api.resume_schema import (
    ResumeProfile,
    ResumeReviewRequest,
    ResumeReviewResult,
    StructuredExportRequest,
)
from alinha_api.schemas import (
    AnalysisRequest,
    AnalysisResult,
    ProviderKeyDelete,
    ProviderKeyInput,
    ProviderName,
)
from alinha_api.services.analysis import NoVerifiedRequirements
from alinha_api.services.api_key_store import ConnectionError, api_key, connect, disconnect
from alinha_api.services.ats import AtsReport, check_document, check_text
from alinha_api.services.chatgpt_auth import AuthError, chatgpt_auth, enabled
from alinha_api.services.community_storage import (
    CommunitySettings,
    RevisionConflict,
    clear_record,
    get_record,
    read_settings,
    save_record,
    write_settings,
)
from alinha_api.services.deployment import get_mode, hosted_analysis_ready, local_ollama_allowed
from alinha_api.services.document_reader import MAX_UPLOAD_BYTES, extract_resume
from alinha_api.services.migration import atomic_import, export_records, restore_export
from alinha_api.services.model_output import ModelOutputError
from alinha_api.services.provider import (
    AnthropicProvider,
    ChatGPTPlanProvider,
    GeminiProvider,
    GeminiRateLimited,
    OllamaProvider,
    OpenAIKeyProvider,
    ProviderError,
    provider_status,
)
from alinha_api.services.resume_editor import export_resume_docx
from alinha_api.services.structured_import import ProfileImportPreview, draft_profile
from alinha_api.services.structured_resume import export_structured_docx, render_profile_text
from alinha_api.workflows.analysis import build_workflow
from alinha_api.workflows.resume_review import build_resume_review_workflow

FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "http://localhost:3000")
FRONTEND_ORIGINS = sorted({FRONTEND_ORIGIN, "http://127.0.0.1:3000", "http://localhost:3000"})

app = FastAPI(
    title="Alinha API",
    description="Análise de currículos e vagas com evidências verificáveis.",
    version="0.2.0",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=FRONTEND_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Content-Type"],
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


def _local_only(request: Request, *, mutation: bool = False, require_oauth: bool = True) -> None:
    """Fail closed if installed behind a remote proxy or remote host."""
    if require_oauth and not enabled():
        raise HTTPException(status_code=403, detail="Conexão ChatGPT disponível apenas localmente.")
    if get_mode() != "community":
        raise HTTPException(status_code=403, detail="As credenciais pessoais exigem modo Community.")
    if request.url.hostname not in ("localhost", "127.0.0.1"):
        raise HTTPException(status_code=403, detail="Esta operação só funciona no computador local.")
    if request.client and request.client.host not in ("127.0.0.1", "::1"):
        raise HTTPException(status_code=403, detail="Esta operação só funciona no computador local.")
    if mutation and request.headers.get("origin") not in FRONTEND_ORIGINS:
        raise HTTPException(status_code=403, detail="Origem não autorizada para esta operação.")


class CommunityDataWrite(BaseModel):
    expected_revision: int = Field(ge=0)
    value: object


def _community_api_only(request: Request, *, mutation: bool = False) -> None:
    _local_only(request, mutation=mutation, require_oauth=False)
    origin = request.headers.get("origin")
    if origin is not None and origin not in FRONTEND_ORIGINS:
        raise HTTPException(status_code=403, detail="Origem não autorizada.")
    if request.headers.get("sec-fetch-site") == "cross-site":
        raise HTTPException(status_code=403, detail="Acesso não autorizado.")


@app.post("/api/v1/agent/interpret", response_model=ReviewedIntentPlan)
def interpret_agent_objective(request: Request, response: Response, body: IntentRequest) -> ReviewedIntentPlan:
    """One explicit BYOK/local model request, for a review-only job.search proposal.

    Never accepts a resume, job description, credentials or an executable tool instruction.
    The model cannot trigger a job search or application submission.
    """
    _community_api_only(request, mutation=True)
    response.headers["Cache-Control"] = "no-store"
    # Reserve atomically before inference, so concurrent requests cannot overspend.
    # The ledger stores only opaque UUIDs, never objective, CV or provider credentials.
    try:
        reservation = reserve_call(body.run_id, body.request_id)
    except DuplicateIntentRequest as exc:
        raise HTTPException(status_code=409, detail="Esta solicitação de IA já foi processada.") from exc
    except CallBudgetExhausted as exc:
        raise HTTPException(
            status_code=429, detail="Limite de duas chamadas de IA atingido nesta jornada."
        ) from exc
    except CallBudgetUnavailable as exc:
        raise HTTPException(status_code=503, detail="Limite de IA indisponível. Nenhuma chamada feita.") from exc
    try:
        suggestion = validated_proposal(MODELS[body.provider](), body.objective)
        return build_reviewed_plan(
            suggestion,
            run_id=body.run_id,
            calls_used=reservation.calls_used,
            calls_remaining=reservation.calls_remaining,
            preview_requested=body.preview_requested,
        )
    except ProviderError as exc:
        # Provider adapters report only static, non-sensitive messages.
        raise HTTPException(status_code=422, detail=str(exc)) from exc


# Durable execution control plane. UI integrations and tool dispatch come later;
# never expose begin_step or finish_step to untrusted browser requests.
journey_store = JourneyStore()


@app.post("/api/v1/agent/runs", response_model=JourneySnapshot)
def create_agent_run(request: Request, response: Response, body: StartJourney) -> JourneySnapshot:
    _community_api_only(request, mutation=True)
    response.headers["Cache-Control"] = "no-store"
    try:
        return journey_store.create(body)
    except JourneyConflict as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except JourneyStorageUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@app.get("/api/v1/agent/runs/{run_id}", response_model=JourneySnapshot)
def get_agent_run(request: Request, response: Response, run_id: UUID) -> JourneySnapshot:
    _community_api_only(request)
    response.headers["Cache-Control"] = "no-store"
    try:
        return journey_store.get(run_id)
    except JourneyNotFound as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except JourneyStorageUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@app.post("/api/v1/agent/runs/{run_id}/cancel", response_model=JourneySnapshot)
def cancel_agent_run(request: Request, response: Response, run_id: UUID) -> JourneySnapshot:
    _community_api_only(request, mutation=True)
    response.headers["Cache-Control"] = "no-store"
    try:
        return journey_store.cancel(run_id)
    except JourneyNotFound as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except JourneyStorageUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@app.post("/api/v1/agent/runs/{run_id}/execute-search", response_model=JourneySnapshot)
def execute_agent_search(request: Request, response: Response, run_id: UUID) -> JourneySnapshot:
    """Run the allowed real job.search step, once, using existing configured connectors."""
    _community_api_only(request, mutation=True)
    response.headers["Cache-Control"] = "no-store"
    try:
        return execute_authorized_search(
            journey_store, run_id,
            lambda query: discover_jobs(request, q=query, page=1, remote_only=True, source="all"),
        )
    except JourneyNotFound as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except JourneyConflict as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except JourneyStorageUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except SearchToolUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@app.get("/api/v1/agent/runs/{run_id}/jobs", response_model=JobSearchResult)
def get_agent_search_result(request: Request, response: Response, run_id: UUID) -> JobSearchResult:
    """Read a previously stored public listing snapshot; never rerun a connector."""
    _community_api_only(request)
    response.headers["Cache-Control"] = "no-store"
    try:
        return journey_store.get_search_result(run_id)
    except JourneyNotFound as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except JourneyConflict as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except JourneyStorageUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@app.post("/api/v1/agent/runs/{run_id}/execute-assess", response_model=JourneySnapshot)
def execute_agent_assessment(request: Request, response: Response, run_id: UUID) -> JourneySnapshot:
    """Read a revision-pinned Community résumé and assess persisted public jobs."""
    _community_api_only(request, mutation=True)
    response.headers["Cache-Control"] = "no-store"
    try:
        return execute_authorized_assessment(
            journey_store, run_id, lambda: get_record("resume"),
        )
    except JourneyNotFound as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except JourneyConflict as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except JourneyStorageUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except AssessmentUnavailable as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@app.get("/api/v1/agent/runs/{run_id}/assessment", response_model=AssessmentReport)
def get_agent_assessment(request: Request, response: Response, run_id: UUID) -> AssessmentReport:
    """Read durable literal evidence without reprocessing personal data."""
    _community_api_only(request)
    response.headers["Cache-Control"] = "no-store"
    try:
        return journey_store.get_assessment(run_id)
    except JourneyNotFound as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except JourneyConflict as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except JourneyStorageUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@app.post("/api/v1/agent/runs/{run_id}/execute-preview", response_model=JourneySnapshot)
def execute_agent_preview(request: Request, response: Response, run_id: UUID) -> JourneySnapshot:
    """Generate review-only local drafts from previously verified literal signals."""
    _community_api_only(request, mutation=True)
    response.headers["Cache-Control"] = "no-store"
    try:
        return execute_authorized_previews(
            journey_store, run_id, lambda: get_record("resume")[1],
        )
    except JourneyNotFound as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except JourneyConflict as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except JourneyStorageUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except PreviewUnavailable as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@app.get("/api/v1/agent/runs/{run_id}/previews", response_model=PreviewBatch)
def get_agent_previews(request: Request, response: Response, run_id: UUID) -> PreviewBatch:
    """Read saved drafts; no tools or remote systems are contacted."""
    _community_api_only(request)
    response.headers["Cache-Control"] = "no-store"
    try:
        return journey_store.get_previews(run_id)
    except JourneyNotFound as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except JourneyConflict as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except JourneyStorageUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@app.post("/api/v1/agent/runs/{run_id}/execute", response_model=JourneySnapshot)
def execute_agent_journey(request: Request, response: Response, run_id: UUID) -> JourneySnapshot:
    """One backend call dispatches the remaining authorized, checkpointed steps."""
    _community_api_only(request, mutation=True)
    response.headers["Cache-Control"] = "no-store"
    try:
        return run_authorized_journey(
            journey_store, run_id,
            search=lambda query: discover_jobs(
                request, q=query, page=1, remote_only=True, source="all",
            ),
            read_profile=lambda: get_record("resume"),
        )
    except JourneyNotFound as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except JourneyConflict as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except JourneyStorageUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except SearchToolUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except (AssessmentUnavailable, PreviewUnavailable) as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


# Ephemeral demo only: isolated synthetic data and no submission connector.
demo_coordinator = AgentCoordinator()


@app.post("/api/v1/agent/demo/runs", response_model=RunSnapshot)
def start_demo_run(request: Request, response: Response, body: StartRun) -> RunSnapshot:
    _community_api_only(request, mutation=True)
    response.headers["Cache-Control"] = "no-store"
    try:
        return demo_coordinator.start(body)
    except RunViolation as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@app.get("/api/v1/agent/demo/runs/{run_id}", response_model=RunSnapshot)
def get_demo_run(request: Request, response: Response, run_id: str) -> RunSnapshot:
    _community_api_only(request)
    response.headers["Cache-Control"] = "no-store"
    try:
        return demo_coordinator.get(run_id)
    except RunViolation as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.post("/api/v1/agent/demo/runs/{run_id}/advance", response_model=RunSnapshot)
def advance_demo_run(
    request: Request, response: Response, run_id: str, body: AdvanceRun,
) -> RunSnapshot:
    _community_api_only(request, mutation=True)
    response.headers["Cache-Control"] = "no-store"
    try:
        return demo_coordinator.advance(run_id, body.expected_step)
    except RunViolation as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@app.post("/api/v1/agent/demo/runs/{run_id}/cancel", response_model=RunSnapshot)
def cancel_demo_run(request: Request, response: Response, run_id: str) -> RunSnapshot:
    _community_api_only(request, mutation=True)
    response.headers["Cache-Control"] = "no-store"
    try:
        return demo_coordinator.cancel(run_id)
    except RunViolation as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.post("/api/v1/agent/demo/runs/{run_id}/review", response_model=RunSnapshot)
def review_demo_run(
    request: Request, response: Response, run_id: str, body: ConfirmReview,
) -> RunSnapshot:
    _community_api_only(request, mutation=True)
    response.headers["Cache-Control"] = "no-store"
    try:
        return demo_coordinator.confirm_review(run_id, body)
    except RunViolation as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@app.get("/api/v1/community/settings", response_model=CommunitySettings)
def community_get_settings(request: Request) -> CommunitySettings:
    _community_api_only(request)
    try:
        return read_settings()
    except (ValueError, OSError, ValidationError) as exc:
        raise HTTPException(status_code=500, detail="Configuração local inválida ou inacessível.") from exc


@app.put("/api/v1/community/settings", response_model=CommunitySettings)
def community_put_settings(request: Request, body: CommunitySettings) -> CommunitySettings:
    _community_api_only(request, mutation=True)
    try:
        write_settings(body)
        return body
    except OSError as exc:
        raise HTTPException(status_code=500, detail="Não foi possível salvar a configuração local.") from exc


@app.get("/api/v1/community/data/{kind}")
def community_get_data(request: Request, kind: str) -> dict:
    _community_api_only(request)
    if kind not in ("resume", "opportunities", "resume_versions"):
        raise HTTPException(status_code=404, detail="Recurso não encontrado.")
    try:
        value, revision = get_record(kind)
        return {"value": value, "revision": revision}
    except (ValueError, OSError) as exc:
        raise HTTPException(status_code=500, detail="Armazenamento local inacessível.") from exc


@app.put("/api/v1/community/data/{kind}")
def community_put_data(request: Request, kind: str, body: CommunityDataWrite) -> dict:
    _community_api_only(request, mutation=True)
    if kind not in ("resume", "opportunities", "resume_versions"):
        raise HTTPException(status_code=404, detail="Recurso não encontrado.")
    try:
        revision = save_record(kind, body.value, body.expected_revision)
        return {"revision": revision}
    except RevisionConflict as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except (ValueError, ValidationError) as exc:
        raise HTTPException(status_code=422, detail="Dados locais inválidos.") from exc
    except OSError as exc:
        raise HTTPException(status_code=500, detail="Não foi possível salvar os dados locais.") from exc


@app.get("/api/v1/jobs/search", response_model=JobSearchResult)
def discover_jobs(
    request: Request,
    q: str = Query(min_length=2, max_length=80),
    page: int = Query(default=1, ge=1, le=5),
    remote_only: bool = Query(default=True),
    source: str = Query(default="himalayas", pattern="^(all|himalayas|gupy|lever|github|greenhouse|ashby)$"),
) -> JobSearchResult:
    """Community-only remote job search through a single vetted public source.

    No credentials or arbitrary URLs, and no application submission. The
    Community desktop service must not become a publicly exposed free proxy.
    """
    _local_only(request, mutation=False, require_oauth=False)
    if request.headers.get("origin") not in (None, *FRONTEND_ORIGINS):
        raise HTTPException(status_code=403, detail="Origem não autorizada.")
    try:
        connectors = read_settings().connectors
        if source != "all" and not getattr(connectors, source).enabled:
            raise HTTPException(status_code=409, detail="Esta fonte está desativada nas configurações.")
        if source == "all" and not any((connectors.gupy.enabled, connectors.himalayas.enabled, connectors.lever.enabled,
                                      connectors.github.enabled, connectors.greenhouse.enabled, connectors.ashby.enabled)):
            raise HTTPException(status_code=409, detail="Ative uma fonte de vagas em Meu Alinha.")
    except (ValueError, OSError, ValidationError) as exc:
        raise HTTPException(status_code=503, detail="Configuração local inválida.") from exc
    try:
        if source == "all":
            sources = {}
            if connectors.gupy.enabled:
                sources["Gupy"] = lambda: search_gupy(q, page=page, remote_only=remote_only)
            if connectors.lever.enabled:
                sources["Lever"] = lambda: search_lever(q, page=page, remote_only=remote_only)
            if connectors.himalayas.enabled:
                sources["Himalayas"] = lambda: search_jobs(q, page=page)
            if connectors.github.enabled:
                sources["GitHub"] = lambda: search_github_jobs(q, page=page, remote_only=remote_only)
            if connectors.greenhouse.enabled:
                sources["Greenhouse"] = lambda: search_ats_board("greenhouse", q, page=page, remote_only=remote_only)
            if connectors.ashby.enabled:
                sources["Ashby"] = lambda: search_ats_board("ashby", q, page=page, remote_only=remote_only)
            return search_multi_source(sources)
        if source == "github":
            return search_github_jobs(q, page=page, remote_only=remote_only)
        if source in ("greenhouse", "ashby"):
            return search_ats_board(source, q, page=page, remote_only=remote_only)
        if source == "lever":
            return search_lever(q, page=page, remote_only=remote_only)
        if source == "gupy":
            return search_gupy(q, page=page, remote_only=remote_only)
        return search_jobs(
            q,
            page=page,
            criteria=CandidateCriteria(
                allowed_work_modes=["remote"] if remote_only else ["onsite"],
            ),
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail="Busca inválida.") from exc
    except JobSearchUnavailable as exc:
        raise HTTPException(
            status_code=503,
            detail="A fonte de vagas está temporariamente indisponível. Tente novamente mais tarde.",
        ) from exc


class CommunityImportRequest(BaseModel):
    expected_revisions: dict[str, int]
    resume: object | None = None
    opportunities: object | None = None
    resume_versions: object | None = None


@app.delete("/api/v1/community/data/{kind}")
def community_clear_data(request: Request, kind: str, expected_revision: int = Query(ge=0)) -> dict:
    _community_api_only(request, mutation=True)
    if kind not in ("resume", "opportunities", "resume_versions"):
        raise HTTPException(status_code=404, detail="Recurso não encontrado.")
    try:
        return {"revision": clear_record(kind, expected_revision)}
    except RevisionConflict as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except (ValueError, ValidationError) as exc:
        raise HTTPException(status_code=422, detail="Revisão inválida.") from exc
    except (OSError, sqlite3.DatabaseError) as exc:
        raise HTTPException(status_code=500, detail="Falha ao apagar dados locais.") from exc


class CommunityRestoreRequest(BaseModel):
    expected_revisions: dict[str, int]
    backup: object


@app.get("/api/v1/community/backup")
def community_export_backup(request: Request, response: Response) -> dict:
    _community_api_only(request)
    response.headers["Cache-Control"] = "no-store"
    try:
        return export_records()
    except (ValueError, OSError, sqlite3.DatabaseError) as exc:
        raise HTTPException(status_code=500, detail="Não foi possível exportar os dados locais.") from exc


@app.post("/api/v1/community/migration")
def community_import_browser_data(request: Request, body: CommunityImportRequest) -> dict:
    _community_api_only(request, mutation=True)
    values = {}
    if body.resume is not None:
        values["resume"] = body.resume
    if body.opportunities is not None:
        values["opportunities"] = body.opportunities
    if body.resume_versions is not None:
        values["resume_versions"] = body.resume_versions
    try:
        return atomic_import(values, body.expected_revisions)
    except RevisionConflict as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except (ValueError, ValidationError) as exc:
        raise HTTPException(status_code=422, detail="Dados da migração inválidos.") from exc
    except (OSError, sqlite3.DatabaseError) as exc:
        raise HTTPException(status_code=500, detail="Não foi possível migrar os dados locais.") from exc


@app.post("/api/v1/community/restore")
def community_restore_backup(request: Request, body: CommunityRestoreRequest) -> dict:
    _community_api_only(request, mutation=True)
    try:
        return restore_export(body.backup, body.expected_revisions)
    except RevisionConflict as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except (ValueError, ValidationError) as exc:
        raise HTTPException(status_code=422, detail="Backup inválido.") from exc
    except (OSError, sqlite3.DatabaseError) as exc:
        raise HTTPException(status_code=500, detail="Não foi possível restaurar os dados locais.") from exc


@app.get("/api/v1/providers/status")
def providers_status() -> dict:
    try:
        return provider_status()
    except AuthError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@app.post("/api/v1/providers/keys/connect")
def provider_key_connect(request: Request, body: ProviderKeyInput) -> dict[str, bool]:
    _local_only(request, mutation=True, require_oauth=False)
    try:
        connect(body.provider, body.api_key)
        return {"connected": True}
    except ConnectionError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@app.post("/api/v1/providers/keys/disconnect")
def provider_key_disconnect(request: Request, body: ProviderKeyDelete) -> dict[str, bool]:
    _local_only(request, mutation=True, require_oauth=False)
    try:
        disconnect(body.provider)
        return {"disconnected": True}
    except ConnectionError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@app.post("/api/v1/providers/chatgpt/login")
def chatgpt_login(request: Request) -> dict[str, str]:
    _local_only(request, mutation=True)
    try:
        return {"authorization_url": chatgpt_auth.begin()}
    except AuthError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@app.get("/auth/callback", include_in_schema=False)
def chatgpt_callback(
    request: Request,
    state: str | None = None,
    code: str | None = None,
    client_id: str | None = None,
    error: str | None = None,
):
    _local_only(request)
    # Run uvicorn with --no-access-log to avoid OAuth codes in URL access logs.
    try:
        chatgpt_auth.finish(state=state, code=code, issued_client_id=client_id, error=error)
        return RedirectResponse(f"{FRONTEND_ORIGIN}/conexoes?chatgpt=connected", status_code=303)
    except AuthError:
        return RedirectResponse(f"{FRONTEND_ORIGIN}/conexoes?chatgpt=error", status_code=303)


@app.get("/api/v1/providers/chatgpt/models")
def chatgpt_models(request: Request) -> dict:
    _local_only(request)
    try:
        return {"models": chatgpt_auth.models()}
    except AuthError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@app.post("/api/v1/providers/chatgpt/logout")
def chatgpt_logout(request: Request) -> dict:
    _local_only(request, mutation=True)
    try:
        revoked = chatgpt_auth.sign_out()
        return {"disconnected": True, "remote_revocation_confirmed": revoked}
    except AuthError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


def run_analysis(payload: AnalysisRequest) -> AnalysisResult:
    if get_mode() == "cloud" and not hosted_analysis_ready():
        raise HTTPException(
            503,
            "O Alinha Cloud ainda não está disponível. Use uma instalação Community.",
        )
    if payload.provider == "gemini":
        if not api_key("gemini"):
            raise HTTPException(503, "Conecte uma chave de API do Gemini.")
        provider = GeminiProvider()
    elif payload.provider == "anthropic":
        if not api_key("anthropic"):
            raise HTTPException(503, "Conecte uma chave Anthropic para Claude.")
        provider = AnthropicProvider()
    elif payload.provider == "openai_api":
        if not api_key("openai_api"):
            raise HTTPException(503, "Conecte uma chave de API da OpenAI.")
        provider = OpenAIKeyProvider()
    elif payload.provider == "ollama":
        if not local_ollama_allowed():
            raise HTTPException(403, "Ollama disponível apenas no Alinha Community.")
        provider = OllamaProvider()
    else:
        if not enabled():
            raise HTTPException(403, "O uso do plano ChatGPT exige execução local autorizada.")
        provider = ChatGPTPlanProvider(payload.model)

    try:
        state = build_workflow(provider).invoke(
            {"resume_text": payload.resume_text, "job_description": payload.job_description}
        )
        return AnalysisResult.model_validate(state["result"])
    except GeminiRateLimited as exc:
        raise HTTPException(
            status_code=429,
            detail=str(exc),
            headers={"Retry-After": str(exc.retry_after)},
        ) from exc
    except (AuthError, ProviderError, ConnectionError) as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except ModelOutputError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except NoVerifiedRequirements as exc:
        raise HTTPException(
            status_code=422,
            detail=(
                "O modelo retornou requisitos, mas as citações não puderam ser "
                "confirmadas na descrição da vaga. Nenhuma evidência foi inventada. "
                "Tente novamente mais tarde ou escolha outro provedor de IA."
            ),
        ) from exc
    except (ValueError, ValidationError) as exc:
        raise HTTPException(
            status_code=422,
            detail="O modelo não retornou um relatório estruturado válido. Tente outro provedor de IA.",
        ) from exc
    except Exception as exc:
        # No user content, tokens, provider response bodies or stack traces in HTTP output.
        raise HTTPException(
            status_code=502,
            detail="Não foi possível concluir a análise. Tente novamente mais tarde.",
        ) from exc


@app.post("/api/v1/analyses/text", response_model=AnalysisResult)
def analyze_text(payload: AnalysisRequest) -> AnalysisResult:
    return run_analysis(payload)


@app.post("/api/v1/analyses/upload", response_model=AnalysisResult)
def analyze_upload(
    file: Annotated[UploadFile, File()],
    job_description: Annotated[str, Form()],
    provider: Annotated[ProviderName, Form()] = "gemini",
    model: Annotated[str | None, Form()] = None,
) -> AnalysisResult:
    content = file.file.read(MAX_UPLOAD_BYTES + 1)
    try:
        resume_text = extract_resume(file.filename, content)
        payload = AnalysisRequest(
            resume_text=resume_text,
            job_description=job_description,
            provider=provider,
            model=model,
        )
    except (ValueError, ValidationError) as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    finally:
        file.file.close()
    return run_analysis(payload)


class AtsTextRequest(BaseModel):
    resume_text: str = Field(min_length=1, max_length=22000)


@app.post("/api/v1/ats/check/text", response_model=AtsReport)
def ats_check_text(payload: AtsTextRequest) -> AtsReport:
    """Check basic parseability without calling any model."""
    return check_text(payload.resume_text)


@app.post("/api/v1/ats/check/upload", response_model=AtsReport)
def ats_check_upload(file: Annotated[UploadFile, File()]) -> AtsReport:
    """Local, in-memory PDF/DOCX/TXT inspection. No persistence."""
    content = file.file.read(MAX_UPLOAD_BYTES + 1)
    try:
        return check_document(file.filename, content)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    finally:
        file.file.close()



@app.post("/api/v1/ats/editor/import")
def ats_editor_import(file: Annotated[UploadFile, File()]) -> dict[str, str]:
    """Recover text for explicit candidate editing; never persist the file."""
    content = file.file.read(MAX_UPLOAD_BYTES + 1)
    try:
        return {"resume_text": extract_resume(file.filename, content)}
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except PdfReadError as exc:
        raise HTTPException(status_code=422, detail="N?o foi poss?vel ler o PDF enviado.") from exc
    finally:
        file.file.close()


@app.post("/api/v1/ats/editor/export/docx")
def ats_editor_export_docx(payload: AtsTextRequest) -> Response:
    """Export exactly the approved text to a simple, readable DOCX."""
    try:
        output = export_resume_docx(payload.resume_text)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return Response(
        output,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={
            "Content-Disposition": 'attachment; filename="alinha-curriculo.docx"',
            "Cache-Control": "no-store",
        },
    )


@app.post("/api/v1/resumes/structured/import/upload", response_model=ProfileImportPreview)
def import_structured_resume(file: Annotated[UploadFile, File()]) -> ProfileImportPreview:
    """Draft editable sections from PDF/DOCX/TXT, with no AI or persistence."""
    content = file.file.read(MAX_UPLOAD_BYTES + 1)
    try:
        text = extract_resume(file.filename, content)
        return draft_profile(text)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except ValidationError as exc:
        raise HTTPException(status_code=422, detail="Não foi possível estruturar o currículo. Confira o documento.") from exc
    except PdfReadError as exc:
        raise HTTPException(status_code=422, detail="Não foi possível ler o PDF enviado.") from exc
    finally:
        file.file.close()


@app.post("/api/v1/resumes/structured/preview/text")
def preview_structured_resume(profile: ResumeProfile) -> dict:
    """Preview human-editable plain text; does not store profile information."""
    return {"resume_text": render_profile_text(profile), "profile": profile.model_dump()}


@app.post("/api/v1/resumes/structured/export/docx")
def export_structured_resume(payload: StructuredExportRequest) -> Response:
    try:
        content = export_structured_docx(payload.profile, payload.template)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return Response(
        content,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={
            "Content-Disposition": 'attachment; filename="alinha-studio-curriculo.docx"',
            "Cache-Control": "no-store",
        },
    )


@app.post("/api/v1/resumes/structured/review", response_model=ResumeReviewResult)
def review_structured_resume(payload: ResumeReviewRequest) -> ResumeReviewResult:
    """One provider analysis -> deterministic evidence check -> human review.

    No automatic edits and no second inference request. Provider quota remains
    enforced in run_analysis, including the Gemini rolling rate limiter.
    """
    resume = render_profile_text(payload.profile)
    if len(resume) < 50 or len(resume) > 22000:
        raise HTTPException(422, "Preencha seu perfil antes de solicitar melhorias com IA.")

    def analyze(text: str, job: str) -> AnalysisResult:
        return run_analysis(AnalysisRequest(
            resume_text=text, job_description=job,
            provider=payload.provider, model=payload.model,
        ))

    review = build_resume_review_workflow(analyze).invoke(
        {"resume_text": resume, "job_description": payload.job_description}
    )["review"]
    return ResumeReviewResult.model_validate(review)

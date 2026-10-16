"""HTTP interface with local-only provider OAuth and evidence-checked analysis."""
import os
from typing import Annotated

from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse, Response
from pydantic import BaseModel, Field, ValidationError
from pypdf.errors import PdfReadError

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
from alinha_api.services.deployment import get_mode, hosted_analysis_ready, local_ollama_allowed
from alinha_api.services.document_reader import MAX_UPLOAD_BYTES, extract_resume
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
from alinha_api.workflows.analysis import build_workflow

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
    allow_methods=["GET", "POST"],
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
        return RedirectResponse(f"{FRONTEND_ORIGIN}/?chatgpt=connected", status_code=303)
    except AuthError:
        return RedirectResponse(f"{FRONTEND_ORIGIN}/?chatgpt=error", status_code=303)


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

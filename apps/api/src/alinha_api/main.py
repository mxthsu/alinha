"""HTTP interface with local-only provider OAuth and evidence-checked analysis."""
import os
from typing import Annotated

from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from pydantic import ValidationError

from alinha_api.schemas import AnalysisRequest, AnalysisResult, ProviderName
from alinha_api.services.chatgpt_auth import AuthError, chatgpt_auth, enabled
from alinha_api.services.document_reader import MAX_UPLOAD_BYTES, extract_resume
from alinha_api.services.provider import (
    ChatGPTPlanProvider,
    GeminiProvider,
    OllamaProvider,
    ProviderError,
    provider_status,
)
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


def _local_only(request: Request, *, mutation: bool = False) -> None:
    """Fail closed if installed behind a remote proxy or remote host."""
    if not enabled():
        raise HTTPException(status_code=403, detail="Conexão ChatGPT disponível apenas localmente.")
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
    if payload.provider == "gemini":
        if not os.getenv("GEMINI_API_KEY"):
            raise HTTPException(503, "A chave Gemini não está configurada.")
        provider = GeminiProvider()
    elif payload.provider == "ollama":
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
    except (AuthError, ProviderError) as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except (ValueError, ValidationError) as exc:
        raise HTTPException(
            status_code=422,
            detail="A análise não apresentou evidências válidas. Revise os textos e tente novamente.",
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

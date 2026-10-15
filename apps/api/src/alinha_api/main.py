"""HTTP interface for resume-to-job evidence analysis."""
import os
from typing import Annotated

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import ValidationError

from alinha_api.schemas import AnalysisRequest, AnalysisResult
from alinha_api.services.document_reader import MAX_UPLOAD_BYTES, extract_resume
from alinha_api.services.provider import GeminiProvider
from alinha_api.workflows.analysis import build_workflow

app = FastAPI(
    title="Alinha API",
    description="Análise de currículos e vagas com evidências verificáveis.",
    version="0.1.0",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("FRONTEND_ORIGIN", "http://localhost:3000")],
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


def run_analysis(payload: AnalysisRequest) -> AnalysisResult:
    if not os.getenv("GEMINI_API_KEY"):
        raise HTTPException(
            status_code=503,
            detail="A análise por IA não está configurada neste ambiente.",
        )
    try:
        state = build_workflow(GeminiProvider()).invoke(payload.model_dump())
        return AnalysisResult.model_validate(state["result"])
    except (ValueError, ValidationError) as exc:
        raise HTTPException(
            status_code=422,
            detail="A análise não apresentou evidências válidas. Revise os textos e tente novamente.",
        ) from exc
    except Exception as exc:
        # Avoid leaking candidate content, credentials, or provider internals.
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
) -> AnalysisResult:
    content = file.file.read(MAX_UPLOAD_BYTES + 1)
    try:
        resume_text = extract_resume(file.filename, content)
        payload = AnalysisRequest(
            resume_text=resume_text,
            job_description=job_description,
        )
    except (ValueError, ValidationError) as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    finally:
        file.file.close()
    return run_analysis(payload)

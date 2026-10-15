"""Contracts shared by the API and the analysis pipeline."""
from typing import Literal

from pydantic import BaseModel, Field

MatchStatus = Literal["evidenciado", "parcial", "nao_identificado"]


class AnalysisRequest(BaseModel):
    resume_text: str = Field(min_length=50, max_length=22000)
    job_description: str = Field(min_length=60, max_length=14000)


class RequirementDraft(BaseModel):
    requirement: str = Field(min_length=3, max_length=180)
    job_evidence: str = Field(min_length=3, max_length=300)
    status: MatchStatus
    resume_evidence: str | None = Field(default=None, max_length=350)
    recommendation: str = Field(min_length=5, max_length=450)


class AnalysisDraft(BaseModel):
    job_title: str = Field(min_length=2, max_length=130)
    requirements: list[RequirementDraft] = Field(min_length=1, max_length=20)


class AnalysisResult(BaseModel):
    job_title: str
    summary: str
    requirements: list[RequirementDraft]
    limitations: list[str]
    analysis_mode: Literal["ai"] = "ai"

"""Versioned, portable resume document schema for the Alinha Community Studio.

No external lookup, implicit persistence, or automatic AI-written experience.
"""
from typing import Literal

from pydantic import BaseModel, Field, field_validator

TemplateName = Literal["classico", "compacto"]


class Contact(BaseModel):
    name: str = Field(default="", max_length=120)
    headline: str = Field(default="", max_length=120)
    email: str = Field(default="", max_length=180)
    phone: str = Field(default="", max_length=60)
    city: str = Field(default="", max_length=110)
    links: list[str] = Field(default_factory=list, max_length=4)


class Experience(BaseModel):
    role: str = Field(default="", max_length=150)
    organization: str = Field(default="", max_length=150)
    period: str = Field(default="", max_length=100)
    highlights: list[str] = Field(default_factory=list, max_length=10)


class Education(BaseModel):
    course: str = Field(default="", max_length=150)
    institution: str = Field(default="", max_length=150)
    period: str = Field(default="", max_length=100)


class Project(BaseModel):
    title: str = Field(default="", max_length=150)
    description: str = Field(default="", max_length=750)
    link: str = Field(default="", max_length=260)


class ResumeProfile(BaseModel):
    schema_version: Literal[1] = 1
    contact: Contact = Field(default_factory=Contact)
    summary: str = Field(default="", max_length=1600)
    experiences: list[Experience] = Field(default_factory=list, max_length=12)
    education: list[Education] = Field(default_factory=list, max_length=10)
    projects: list[Project] = Field(default_factory=list, max_length=12)
    skills: list[str] = Field(default_factory=list, max_length=50)
    languages: list[str] = Field(default_factory=list, max_length=15)

    @field_validator("skills", "languages")
    @classmethod
    def bound_list_items(cls, values: list[str]) -> list[str]:
        if any(len(value) > 110 for value in values):
            raise ValueError("Uma das competências ou línguas ultrapassou 110 caracteres.")
        return values


class StructuredExportRequest(BaseModel):
    profile: ResumeProfile
    template: TemplateName = "classico"


class ResumeReviewRequest(BaseModel):
    profile: ResumeProfile
    job_description: str = Field(min_length=60, max_length=14000)
    provider: Literal["gemini", "anthropic", "openai_api", "ollama", "chatgpt"] = "gemini"
    model: str | None = Field(default=None, max_length=100)


class ReviewSuggestion(BaseModel):
    requirement: str
    job_evidence: str
    resume_evidence: str | None
    status: Literal["evidenciado", "parcial", "nao_identificado"]
    guidance: str
    approval_required: bool = True


class ResumeReviewResult(BaseModel):
    summary: str
    suggestions: list[ReviewSuggestion]
    limitations: list[str]

"""Adapt imperfect LLM JSON into a strict, evidence-checkable draft.

This stage never synthesizes source citations. Every claimed citation is still
checked against the original document before a report is returned.
"""
from pydantic import ValidationError

from alinha_api.schemas import (
    AnalysisDraft,
    ModelAnalysisResponse,
    RequirementDraft,
)


class ModelOutputError(ValueError):
    """Malformed/incomplete structured output, without revealing input documents."""


def _trim(value: str | None, maximum: int) -> str:
    if not isinstance(value, str):
        return ""
    return value.strip()[:maximum].strip()


def parse_model_output(value: ModelAnalysisResponse | dict | str) -> AnalysisDraft:
    """Validate the wire shape, discard incomplete entries, preserve literal quotes."""
    try:
        if isinstance(value, str):
            raw = ModelAnalysisResponse.model_validate_json(value)
        else:
            raw = ModelAnalysisResponse.model_validate(value)
    except (ValidationError, ValueError, TypeError) as exc:
        raise ModelOutputError(
            "O Gemini enviou uma resposta em formato inválido. "
            "Nenhuma informação foi assumida."
        ) from exc

    requirements: list[RequirementDraft] = []
    for item in raw.requirements[:20]:
        requirement = _trim(item.requirement, 180)
        evidence = _trim(item.job_evidence, 300)
        if len(requirement) < 3 or len(evidence) < 3:
            # No substantive vacancy citation: never manufacture one.
            continue

        status = (
            item.status
            if item.status in ("evidenciado", "parcial", "nao_identificado")
            else "nao_identificado"
        )
        resume = _trim(item.resume_evidence, 350) or None
        if status == "nao_identificado":
            resume = None
        elif not resume:
            status = "nao_identificado"

        recommendation = _trim(item.recommendation, 450)
        if len(recommendation) < 5:
            recommendation = (
                "Revise este requisito e descreva apenas experiências "
                "verdadeiras que possam ser comprovadas."
            )

        requirements.append(
            RequirementDraft(
                requirement=requirement,
                job_evidence=evidence,
                status=status,
                resume_evidence=resume,
                recommendation=recommendation,
            )
        )

    if not requirements:
        raise ModelOutputError(
            "O Gemini não forneceu requisitos com citações aproveitáveis. "
            "Nenhum requisito foi inventado."
        )

    job_title = _trim(raw.job_title, 130)
    if len(job_title) < 2:
        job_title = "Oportunidade analisada"

    return AnalysisDraft(job_title=job_title, requirements=requirements)

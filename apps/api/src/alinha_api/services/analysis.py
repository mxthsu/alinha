"""Validate model output against literal evidence from supplied documents."""
import re
import unicodedata

from alinha_api.schemas import AnalysisDraft, AnalysisResult, RequirementDraft


def normalize(value: str) -> str:
    decomposed = unicodedata.normalize("NFKD", value)
    without_accents = "".join(ch for ch in decomposed if not unicodedata.combining(ch))
    return re.sub(r"\s+", " ", without_accents.casefold()).strip()


def evidence_exists(evidence: str | None, source: str) -> bool:
    return bool(evidence and normalize(evidence) in normalize(source))


def validate_draft(
    draft: AnalysisDraft, resume_text: str, job_description: str
) -> AnalysisResult:
    verified: list[RequirementDraft] = []
    for item in draft.requirements:
        # A requirement without an actual quote from the job is not publishable.
        if not evidence_exists(item.job_evidence, job_description):
            continue

        if item.status != "nao_identificado" and not evidence_exists(
            item.resume_evidence, resume_text
        ):
            verified.append(
                item.model_copy(
                    update={
                        "status": "nao_identificado",
                        "resume_evidence": None,
                        "recommendation": (
                            "Não foi localizada evidência verificável no currículo. "
                            "Inclua uma experiência real, caso a possua."
                        ),
                    }
                )
            )
        else:
            verified.append(
                item.model_copy(
                    update={
                        "resume_evidence": (
                            item.resume_evidence if item.status != "nao_identificado" else None
                        )
                    }
                )
            )

    if not verified:
        raise ValueError("Nenhum requisito da vaga pôde ser verificado.")

    matched = sum(item.status == "evidenciado" for item in verified)
    partial = sum(item.status == "parcial" for item in verified)
    summary = (
        f"Foram analisados {len(verified)} requisitos: {matched} com evidências no "
        f"currículo, {partial} com evidências parciais e "
        f"{len(verified) - matched - partial} sem evidência identificada."
    )
    return AnalysisResult(
        job_title=draft.job_title,
        summary=summary,
        requirements=verified,
        limitations=[
            "A análise não representa a pontuação de nenhum sistema ATS ou empresa.",
            "Ausência de evidência no currículo não significa ausência da competência.",
            "Confira as recomendações antes de alterar seu currículo.",
        ],
    )

"""Recover exact source excerpts when a model paraphrases a citation.

A candidate must contain the discriminating vocabulary of the REQUIREMENT and
the generated evidence. We never manufacture quotes or use a language model to
recover them, and fail closed when there is no sufficiently grounded source.
"""

from __future__ import annotations

import re
import unicodedata

# High-frequency Portuguese/English words are not proof of a skill.
STOP_WORDS = frozenset(
    [
        "a",
        "as",
        "o",
        "os",
        "um",
        "uma",
        "uns",
        "umas",
        "ao",
        "aos",
        "da",
        "das",
        "de",
        "do",
        "dos",
        "e",
        "em",
        "no",
        "na",
        "nos",
        "nas",
        "com",
        "por",
        "para",
        "sem",
        "que",
        "se",
        "é",
        "são",
        "ser",
        "ter",
        "deve",
        "deverá",
        "desejável",
        "obrigatório",
        "necessário",
        "necessária",
        "requerido",
        "requisitos",
        "requisito",
        "experiência",
        "conhecimento",
        "conhecimentos",
        "habilidade",
        "habilidades",
        "capacidade",
        "prática",
        "atuação",
        "profissional",
        "vaga",
        "cargo",
        "empresa",
        "candidato",
        "candidata",
        "possuir",
        "trabalhar",
        "trabalho",
        "vivência",
        "familiaridade",
        "preferencial",
        "diferenciais",
        "the",
        "and",
        "with",
        "for",
        "an",
        "in",
        "of",
        "on",
        "to",
        "is",
        "are",
        "required",
        "skill",
        "skills",
        "conhecer",
        "utilização",
        "uso",
        "usando",
        "usando-se",
    ]
)
WORD_RE = re.compile(r"[^\W_]+(?:[-+.#][^\W_]+)*", re.UNICODE)
SPLIT_RE = re.compile(r"\n+|(?<=[.!?;])\s+(?=[A-ZÀ-Ú0-9•\-*])")
MIN_EXCERPT = 4
MAX_EXCERPT = 300


def _canonical(value: str) -> str:
    value = unicodedata.normalize("NFKD", value.casefold())
    value = "".join(ch for ch in value if not unicodedata.combining(ch))
    return re.sub(r"\s+", " ", value).strip()


def _keywords(text: str) -> set[str]:
    return {
        token
        for token in WORD_RE.findall(_canonical(text))
        if len(token) >= 2 and token not in STOP_WORDS and not token.isdigit()
    }


def _chunks(source: str) -> list[str]:
    """Extract bounded verbatim spans. No fabricated punctuation/whitespace."""
    chunks: list[str] = []
    for paragraph in SPLIT_RE.split(source):
        span = paragraph.strip(" \t\r\n")
        if not span or span.startswith(("http://", "https://")):
            continue
        if len(span) <= MAX_EXCERPT:
            if len(span) >= MIN_EXCERPT:
                chunks.append(span)
            continue
        # Find smaller natural boundaries for unusually long vacancy paragraphs.
        for part in re.split(r"(?<=,)\s+|\s+[|•]\s+|\s+[-–]\s+", span):
            segment = part.strip()
            if MIN_EXCERPT <= len(segment) <= MAX_EXCERPT:
                chunks.append(segment)
    return chunks


def literal_or_recovered(
    evidence: str | None,
    requirement: str,
    source: str,
) -> str | None:
    """Return only a direct excerpt copied from source.

    Exact citations are preferred. Recovery is restricted to one identifiable
    vacancy clause that overlaps both the job requirement and model citation.
    """
    if not evidence:
        return None

    # The model may introduce diacritics/case differences: normalized checking
    # validates those without creating any new text.
    evidence_normalized = _canonical(evidence)
    if evidence_normalized and evidence_normalized in _canonical(source):
        return evidence.strip()

    clue_terms = _keywords(evidence)
    requirement_terms = _keywords(requirement)
    if not clue_terms or not requirement_terms:
        return None

    candidates = []
    for chunk in _chunks(source):
        content_terms = _keywords(chunk)
        clue_overlap = clue_terms & content_terms
        req_overlap = requirement_terms & content_terms

        # Require at least two distinctive terms between the evidence and the
        # requirement and a strong mapping to both claims.
        if len(clue_overlap | req_overlap) < 2:
            continue
        clue_ratio = len(clue_overlap) / len(clue_terms)
        req_ratio = len(req_overlap) / len(requirement_terms)
        if clue_ratio < 0.55 or req_ratio < 0.7:
            continue
        # Short, unrelated evidence such as "Kubernetes" cannot be attached to
        # an unrelated requirement via generic words from another sentence.
        confidence = 0.6 * clue_ratio + 0.4 * req_ratio
        candidates.append((confidence, len(clue_overlap & req_overlap), -len(chunk), chunk))

    if not candidates:
        return None
    candidates.sort(reverse=True)
    best = candidates[0]
    # Do not guess between two unrelated but equally plausible source clauses.
    if len(candidates) > 1 and candidates[1][0] == best[0] and candidates[1][1] == best[1]:
        return None
    return best[3]

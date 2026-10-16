"""Conservative local extraction of resume sections. Never infer absent qualifications."""
import re
import unicodedata

from pydantic import BaseModel, Field

from alinha_api.resume_schema import ResumeProfile

_EMAIL = re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b")
_HEADINGS = {
    "resumo": "summary",
    "resumo profissional": "summary",
    "perfil profissional": "summary",
    "sobre mim": "summary",
    "experiencia": "experiences",
    "experiencia profissional": "experiences",
    "experiencias profissionais": "experiences",
    "historico profissional": "experiences",
    "formacao": "education",
    "formacao academica": "education",
    "educacao": "education",
    "escolaridade": "education",
    "projetos": "projects",
    "projetos pessoais": "projects",
    "projetos relevantes": "projects",
    "competencias": "skills",
    "habilidades": "skills",
    "habilidades tecnicas": "skills",
    "conhecimentos": "skills",
    "tecnologias": "skills",
    "idiomas": "languages",
    "linguas": "languages",
}
_SPLIT = re.compile(r"\s*[|•;,]\s*")
_BULLET = re.compile(r"^\s*[-*•]\s*")
_SPACED_DASH = re.compile(r"\s+(?:[—–-]|\|)\s+")
_PERIOD = re.compile(r"\b(?:19|20)\d{2}\b|\b(?:atual|presente)\b", re.IGNORECASE)


def normalized(text: str) -> str:
    text = unicodedata.normalize("NFKD", text.strip().lower())
    return "".join(ch for ch in text if not unicodedata.combining(ch)).rstrip(":").strip()


class ProfileImportPreview(BaseModel):
    profile: ResumeProfile
    source_text: str
    unassigned_lines: list[str] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
    requires_confirmation: bool = True


def _split_items(lines: list[str], max_items: int) -> list[str]:
    values: list[str] = []
    for line in lines:
        line = _BULLET.sub("", line).strip()
        for piece in _SPLIT.split(line):
            if piece and piece not in values and len(piece) <= 110:
                values.append(piece)
    return values[:max_items]


def draft_profile(text: str) -> ProfileImportPreview:
    """Suggest ONLY literal sections and fields; keep leftovers visible for review."""
    profile = ResumeProfile()
    sections: dict[str, list[str]] = {"unassigned": []}
    current = "unassigned"
    for line in text.splitlines():
        stripped = line.strip()
        if not stripped:
            continue
        header = _HEADINGS.get(normalized(stripped))
        if header:
            current = header
            sections.setdefault(current, [])
        else:
            sections.setdefault(current, []).append(stripped)

    preamble = sections["unassigned"]
    if preamble and len(preamble[0]) <= 120 and not _EMAIL.search(preamble[0]) and not any(c.isdigit() for c in preamble[0]):
        first = preamble.pop(0)
        profile.contact.name = first.split(":", 1)[-1].strip() if normalized(first).startswith("nome:") else first
    for line in preamble[:]:
        match = _EMAIL.search(line)
        if match and not profile.contact.email and len(match.group(0)) <= 180:
            profile.contact.email = match.group(0)
            preamble.remove(line)
            continue
        if ":" not in line:
            continue
        label, value = line.split(":", 1)
        label, value = normalized(label), value.strip()
        if not value:
            continue
        if label in {"telefone", "celular", "whatsapp"} and len(value) <= 60:
            profile.contact.phone = value
            preamble.remove(line)
        elif label in {"cidade", "localizacao", "cidade/uf"} and len(value) <= 110:
            profile.contact.city = value
            preamble.remove(line)
        elif label in {"linkedin", "github", "portfolio", "site"} and len(value) <= 260:
            if len(profile.contact.links) < 4:
                profile.contact.links.append(value)
                preamble.remove(line)

    if sections.get("summary"):
        profile.summary = "\n".join(sections["summary"])[:1600]
        if len("\n".join(sections["summary"])) > 1600:
            sections["unassigned"].extend(sections["summary"])
            profile.summary = ""
    if sections.get("skills"):
        profile.skills = _split_items(sections["skills"], 50)
    if sections.get("languages"):
        profile.languages = _split_items(sections["languages"], 15)

    # Do not manufacture job titles, organizations, dates or metrics from free text.
    # Preserve full literal entries when record boundaries are not explicit.
    from alinha_api.resume_schema import Education, Experience, Project
    exp_lines = sections.get("experiences", [])
    current_exp: Experience | None = None
    for line in exp_lines:
        bits = _SPACED_DASH.split(line, maxsplit=2)
        if len(bits) >= 2 and not _BULLET.match(line) and not _PERIOD.fullmatch(line):
            if current_exp:
                profile.experiences.append(current_exp)
            current_exp = Experience(
                role=bits[0][:150],
                organization=bits[1][:150],
                period=bits[2][:100] if len(bits) > 2 else "",
            )
        elif current_exp and _BULLET.match(line):
            if len(current_exp.highlights) < 10 and len(line) <= 600:
                current_exp.highlights.append(_BULLET.sub("", line))
            else:
                sections["unassigned"].append(line)
        elif current_exp and _PERIOD.search(line) and not current_exp.period:
            current_exp.period = line[:100]
        else:
            sections["unassigned"].append(line)
    if current_exp:
        profile.experiences.append(current_exp)

    education = sections.get("education", [])
    for line in education:
        bits = _SPACED_DASH.split(line, maxsplit=2)
        if len(bits) >= 2:
            profile.education.append(Education(
                course=bits[0][:150], institution=bits[1][:150],
                period=bits[2][:100] if len(bits) > 2 else "",
            ))
        else:
            sections["unassigned"].append(line)

    projects = sections.get("projects", [])
    for line in projects:
        if ":" in line:
            title, description = line.split(":", 1)
            if title.strip() and description.strip():
                if len(title.strip()) <= 150 and len(description.strip()) <= 750:
                    profile.projects.append(Project(title=title.strip(), description=description.strip()))
                else:
                    sections["unassigned"].append(line)
            else:
                sections["unassigned"].append(line)
        else:
            sections["unassigned"].append(line)

    if len(profile.experiences) > 12 or len(profile.education) > 10 or len(profile.projects) > 12:
        raise ValueError("O arquivo contém mais seções do que o editor suporta. Revise o texto manualmente.")

    # Any lines that couldn't be mapped remain available and are never dropped silently.
    warnings = ["Revise todos os campos importados antes de utilizá-los."]
    if sections["unassigned"]:
        warnings.append("Alguns trechos não puderam ser classificados; confira o texto não atribuído.")
    if not profile.experiences and sections.get("experiences"):
        warnings.append("As experiências não tinham separação explícita entre cargo e empresa.")
    if not profile.contact.name:
        warnings.append("Não foi possível reconhecer o nome com segurança.")

    return ProfileImportPreview(
        profile=profile,
        source_text=text,
        unassigned_lines=sections["unassigned"],
        warnings=warnings,
    )

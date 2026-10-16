"""Conservative, deterministic extraction of structured fields from a resume.

Never invent qualifications or persist input. Unmapped text is returned for review.
"""
import re
import unicodedata

from pydantic import BaseModel, Field

from alinha_api.resume_schema import Education, Experience, Project, ResumeProfile

_EMAIL = re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b")
_PHONE = re.compile(r"(?:\+\d{1,3}\s*)?(?:\(?\d{2,3}\)?[\s.-]*)?\d{4,5}[\s.-]?\d{4}")
_LINK = re.compile(r"(?:https?://)?(?:www\.)?(?:linkedin\.com|github\.com|gitlab\.com|behance\.net|medium\.com|[\w-]+\.(?:dev|io))[/\w.%?=&+#-]*", re.IGNORECASE)
_BULLET = re.compile(r"^\s*(?:[•●▪◦*]|\-(?=\s))\s*")
_DIVIDER = re.compile(r"\s+[—–-]\s+")
_PERIOD = re.compile(r"\b(?:19|20)\d{2}\b|\b(?:atual|presente|current|present)\b", re.IGNORECASE)
_PERIOD_LINE = re.compile(r"^(?:[a-zà-ú]{3,12}/)?(?:19|20)\d{2}\s*[—–-]\s*(?:(?:[a-zà-ú]{3,12}/)?(?:19|20)\d{2}|atual|presente|current|present)", re.IGNORECASE)
_CITY = re.compile(r"^[^|]{2,70},\s*[A-Z]{2}$")
_SPLIT_ITEMS = re.compile(r"\s*[,;|]\s*")
_HEADINGS = {
    "resumo": "summary", "resumo profissional": "summary", "perfil profissional": "summary",
    "perfil": "summary", "sobre mim": "summary", "objetivo profissional": "summary",
    "professional summary": "summary", "summary": "summary", "profile": "summary",
    "experiencia": "experiences", "experiencias": "experiences",
    "experiencia profissional": "experiences", "experiencias profissionais": "experiences",
    "historico profissional": "experiences", "experiencia de trabalho": "experiences",
    "professional experience": "experiences", "work experience": "experiences", "experience": "experiences",
    "formacao": "education", "formacao academica": "education", "educacao": "education",
    "escolaridade": "education", "formacao e educacao": "education",
    "education": "education", "academic background": "education",
    "projetos": "projects", "projetos pessoais": "projects",
    "projetos relevantes": "projects", "projetos selecionados": "projects",
    "principais projetos": "projects", "projects": "projects", "selected projects": "projects",
    "competencias": "skills", "competencias tecnicas": "skills",
    "habilidades": "skills", "habilidades tecnicas": "skills",
    "conhecimentos": "skills", "conhecimentos tecnicos": "skills",
    "tecnologias": "skills", "skills": "skills", "technical skills": "skills",
    "idiomas": "languages", "linguas": "languages", "languages": "languages",
}
_OTHER_HEADINGS = {
    "certificacoes", "certificados", "premios", "publicacoes", "atividades",
    "informacoes adicionais", "referencias", "voluntariado", "cursos complementares",
    "certifications", "awards", "references", "additional information",
}


def normalized(value: str) -> str:
    value = unicodedata.normalize("NFKD", value.strip().lower())
    value = "".join(char for char in value if not unicodedata.combining(char))
    return re.sub(r"\s+", " ", value).strip(" :.-\t")


class ProfileImportPreview(BaseModel):
    profile: ResumeProfile
    source_text: str
    unassigned_lines: list[str] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
    requires_confirmation: bool = True


def _add_unassigned(remaining: list[str], line: str) -> None:
    line = line.strip()
    if line and line not in remaining:
        remaining.append(line)


def _period_line(line: str) -> str | None:
    first = line.split("|", 1)[0].strip()
    if _PERIOD_LINE.search(first) or (
        _PERIOD.search(first) and normalized(first).startswith(("periodo:", "period:"))
    ):
        return first[:100] if len(first) <= 100 else None
    return None


def _record_header(line: str) -> tuple[str, str, str] | None:
    """Parse explicit delimited headings only, avoiding speculative job detection."""
    if _BULLET.match(line) or _period_line(line):
        return None
    parts = [part.strip() for part in line.split("|")] if "|" in line else _DIVIDER.split(line, maxsplit=2)
    parts = [part for part in parts if part]
    if len(parts) < 2:
        return None
    if len(parts) >= 3 and _PERIOD.search(parts[-1]):
        role, organization = parts[0], parts[1]
        period = parts[-1]
        if len(parts) > 3:
            role = " | ".join(parts[:-2])
    elif len(parts) >= 3 and "|" in line:
        role, organization, period = " | ".join(parts[:-1]), parts[-1], ""
    else:
        role, organization, period = parts[0], parts[1], parts[2] if len(parts) > 2 else ""
    if not role or not organization or len(role) > 150 or len(organization) > 150 or len(period) > 100:
        return None
    return role, organization, period


def _append_highlight(exp: Experience, value: str, remaining: list[str]) -> None:
    value = value.strip()
    if not value:
        return
    if len(value) > 700 or len(exp.highlights) >= 10:
        _add_unassigned(remaining, value)
    else:
        exp.highlights.append(value)


def _parse_experiences(lines: list[str], profile: ResumeProfile, remaining: list[str]) -> None:
    current: Experience | None = None
    for line in lines:
        candidate = _record_header(line)
        if candidate:
            if current:
                if len(profile.experiences) < 12:
                    profile.experiences.append(current)
                else:
                    _add_unassigned(remaining, f"{current.role} | {current.organization}")
            current = Experience(role=candidate[0], organization=candidate[1], period=candidate[2])
        elif current and (period := _period_line(line)) and not current.period:
            current.period = period
        elif current and _BULLET.match(line):
            _append_highlight(current, _BULLET.sub("", line), remaining)
        elif current and current.highlights and not _PERIOD.search(line):
            # PDFs often wrap bullets across physical lines.
            previous = current.highlights[-1]
            combined = previous.rstrip() + " " + line.strip()
            if len(combined) <= 700:
                current.highlights[-1] = combined
            else:
                _add_unassigned(remaining, line)
        elif current and current.organization.rstrip().lower().endswith((" do", " da", " de", " dos", " das", " -")) and len(current.organization) + len(line) < 150:
            # Wrapped employer name, e.g. "Empresa do" + "Brasil Ltda."
            current.organization = current.organization.rstrip() + " " + line
        else:
            _add_unassigned(remaining, line)
    if current:
        if len(profile.experiences) < 12:
            profile.experiences.append(current)
        else:
            _add_unassigned(remaining, f"{current.role} | {current.organization}")


def _parse_education(lines: list[str], profile: ResumeProfile, remaining: list[str]) -> None:
    for line in lines:
        parts = _record_header(line)
        if parts and len(profile.education) < 10:
            profile.education.append(Education(course=parts[0], institution=parts[1], period=parts[2]))
        elif profile.education and _period_line(line) and not profile.education[-1].period:
            profile.education[-1].period = _period_line(line) or ""
        else:
            _add_unassigned(remaining, line)


def _parse_projects(lines: list[str], profile: ResumeProfile, remaining: list[str]) -> None:
    current: Project | None = None

    def flush() -> None:
        if current is None:
            return
        if len(profile.projects) < 12:
            profile.projects.append(current)
        else:
            _add_unassigned(remaining, current.title + ": " + current.description)

    for line in lines:
        if _BULLET.match(line):
            detail = _BULLET.sub("", line).strip()
            if current is None:
                _add_unassigned(remaining, line)
            elif len(current.description) + len(detail) + 1 <= 750:
                current.description = (current.description + " " + detail).strip()
            else:
                _add_unassigned(remaining, line)
            continue
        if "|" in line or (":" in line and not re.match(r"^(https?://|www\.)", line, re.IGNORECASE)):
            flush()
            if ":" in line and "|" not in line:
                title, description = line.split(":", 1)
            else:
                title, description = line, ""
            title, description = title.strip(), description.strip()
            if title and len(title) <= 150 and len(description) <= 750:
                current = Project(title=title, description=description)
            else:
                _add_unassigned(remaining, line)
                current = None
        elif current and current.description and len(current.description) + len(line) + 1 <= 750:
            current.description += " " + line
        elif current and not current.description and len(line) <= 750:
            current.description = line
        else:
            _add_unassigned(remaining, line)
    flush()


def _parse_items(lines: list[str], max_items: int, remaining: list[str], labels: bool) -> list[str]:
    values: list[str] = []
    for line in lines:
        stripped = _BULLET.sub("", line).strip()
        if not stripped:
            continue
        if labels and ":" in stripped:
            prefix, rest = stripped.split(":", 1)
            # Skills group labels are not themselves skills.
            if rest and len(prefix) <= 45 and not any(char.isdigit() for char in prefix):
                stripped = rest.strip()
        for item in _SPLIT_ITEMS.split(stripped):
            item = item.strip(" •\t")
            if not item:
                continue
            if len(item) > 110 or len(values) >= max_items:
                _add_unassigned(remaining, item)
            elif item.casefold() not in {value.casefold() for value in values}:
                values.append(item)
    return values


def _parse_contact(lines: list[str], profile: ResumeProfile, remaining: list[str]) -> None:
    if not lines:
        return
    lines = list(lines)
    first = lines[0]
    if normalized(first).startswith("nome:"):
        first = first.split(":", 1)[1].strip()
    if first and len(first) <= 120 and not _EMAIL.search(first) and not any(c.isdigit() for c in first):
        profile.contact.name = first
        lines.pop(0)
    if lines and len(lines[0]) <= 120 and not _EMAIL.search(lines[0]) and not _PHONE.search(lines[0]) and (
        "|" in lines[0] or normalized(lines[0]).startswith(("cargo:", "titulo:"))
    ):
        profile.contact.headline = lines.pop(0).split(":", 1)[-1].strip()[:120]

    # Reconnect wrapped URLs before tokenization.
    consolidated: list[str] = []
    for line in lines:
        if consolidated and consolidated[-1].endswith("-") and re.search(r"(?:linkedin|github)\.com", consolidated[-1], re.IGNORECASE):
            consolidated[-1] += line.strip()
        else:
            consolidated.append(line)
    for line in consolidated:
        consumed = False
        for chunk in [piece.strip() for piece in line.split("|")]:
            if not chunk:
                continue
            key, colon, val = chunk.partition(":")
            label = normalized(key) if colon else ""
            if label in {"telefone", "celular", "whatsapp", "fone"} and val:
                profile.contact.phone = val.strip()[:60]
                consumed = True
            elif label in {"cidade", "localizacao", "cidade/uf", "endereco"} and val:
                profile.contact.city = val.strip()[:110]
                consumed = True
            elif label in {"linkedin", "github", "portfolio", "site"} and val:
                if len(profile.contact.links) < 4:
                    profile.contact.links.append(val.strip()[:260])
                consumed = True
            elif _EMAIL.search(chunk):
                if not profile.contact.email:
                    profile.contact.email = _EMAIL.search(chunk).group(0)
                consumed = True
            elif _LINK.search(chunk):
                link = _LINK.search(chunk).group(0)
                if link not in profile.contact.links and len(profile.contact.links) < 4:
                    profile.contact.links.append(link)
                consumed = True
            elif _CITY.fullmatch(chunk):
                profile.contact.city = chunk[:110]
                consumed = True
            elif _PHONE.fullmatch(chunk) and len(chunk) <= 60:
                profile.contact.phone = chunk
                consumed = True
            elif not consumed:
                _add_unassigned(remaining, chunk)
        if not consumed and "|" not in line:
            _add_unassigned(remaining, line)


def draft_profile(text: str) -> ProfileImportPreview:
    """Generate a reviewed, editable draft using only literal content."""
    profile = ResumeProfile()
    sections: dict[str, list[str]] = {"unassigned": [], "other": []}
    current = "unassigned"
    for raw in text.splitlines():
        line = re.sub(r"\s+", " ", raw).strip()
        if not line:
            continue
        heading = normalized(line)
        if heading in _HEADINGS:
            current = _HEADINGS[heading]
            sections.setdefault(current, [])
        elif heading in _OTHER_HEADINGS:
            current = "other"
            sections["other"].append(line)
        else:
            sections.setdefault(current, []).append(line)

    remaining: list[str] = []
    _parse_contact(sections["unassigned"], profile, remaining)
    summary = " ".join(sections.get("summary", []))
    if len(summary) <= 1600:
        profile.summary = summary
    else:
        remaining.extend(sections.get("summary", []))
    _parse_experiences(sections.get("experiences", []), profile, remaining)
    _parse_education(sections.get("education", []), profile, remaining)
    _parse_projects(sections.get("projects", []), profile, remaining)
    profile.skills = _parse_items(sections.get("skills", []), 50, remaining, labels=True)
    profile.languages = _parse_items(sections.get("languages", []), 15, remaining, labels=False)
    remaining.extend(sections["other"])

    warnings = []
    if remaining:
        warnings.append("Alguns trechos não foram associados aos campos; revise-os se necessário.")
    if sections.get("experiences") and not profile.experiences:
        warnings.append("As experiências não puderam ser separadas com segurança.")
    if not profile.contact.name:
        warnings.append("Não foi possível identificar o nome com segurança.")
    return ProfileImportPreview(
        profile=profile, source_text=text, unassigned_lines=remaining, warnings=warnings
    )

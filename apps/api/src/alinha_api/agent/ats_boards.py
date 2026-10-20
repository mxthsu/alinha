"""Read-only Brazilian vacancies from allowlisted Greenhouse and Ashby public job boards.

Official documented endpoints only; never follow redirects, fetch user-provided
URLs, submit applications, or infer eligibility from "Remote" alone.
"""
from __future__ import annotations

import html
import json
import re
import threading
import time
import unicodedata
from html.parser import HTMLParser
from urllib.parse import urlsplit

import httpx

from alinha_api.agent.discovery import (
    DiscoveredJob,
    JobSearchResult,
    JobSearchUnavailable,
    _safe_str,
)
from alinha_api.agent.models import JobOpportunity

GREENHOUSE = {
    "teachablecareers": "Teachable",
    "aestudio": "AE Studio",
    "doordashinternational": "DoorDash Brasil",
}
ASHBY = {"sardine": "Sardine", "withclutch": "Clutch"}
API_HOST = {"greenhouse": "boards-api.greenhouse.io", "ashby": "api.ashbyhq.com"}
MAX_RESPONSE_BYTES = 1_000_000
CACHE_SECONDS = 600
_lock = threading.Lock()
_cache: dict[tuple[str, str], tuple[float, list[dict]]] = {}


class _Text(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.text: list[str] = []
        self.skip = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag in ("style", "script"):
            self.skip += 1
        if tag in ("p", "br", "li", "h1", "h2", "h3"):
            self.text.append(" ")

    def handle_endtag(self, tag: str) -> None:
        if tag in ("style", "script") and self.skip:
            self.skip -= 1

    def handle_data(self, data: str) -> None:
        if not self.skip:
            self.text.append(data)


def _plain(value: object) -> str:
    if not isinstance(value, str):
        return ""
    # Greenhouse may return escaped markup as text. It is never rendered as HTML.
    decoded = html.unescape(html.unescape(value))
    parser = _Text()
    parser.feed(decoded[:90_000])
    return _safe_str(" ".join(parser.text), 14_000)


def _normalize(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value.casefold())
    return "".join(c for c in normalized if not unicodedata.combining(c))


def _br_location(value: str) -> bool:
    text = _normalize(value)
    return any(loc in text for loc in (
        "brazil", "brasil", "sao paulo", "campinas", "florianopolis",
        "belo horizonte", "curitiba", "rio de janeiro", "recife",
        "porto alegre", "brasilia", "sao jose dos campos",
    ))


def _match(term: str, title: str, description: str) -> bool:
    words = [word for word in re.findall(r"[a-z0-9]{2,}", _normalize(term))
             if word not in {"de", "da", "do", "dos", "das", "para", "com", "em", "and"}]
    def contains(text: str, word: str) -> bool:
        return bool(re.search(r"\b" + re.escape(word) + r"\b", _normalize(text)))
    return bool(words) and (
        any(contains(title, word) for word in words)
        or all(contains(description, word) for word in words)
    )


def _mode(location: str, workplace: str = "") -> str:
    value = _normalize(f"{location} {workplace}")
    if any(word in value for word in ("hybrid", "hibrido")):
        return "hybrid"
    if any(word in value for word in ("onsite", "on-site", "presencial")):
        return "onsite"
    if any(word in value for word in ("remote", "remoto", "fully remote")):
        return "remote"
    return "unspecified"


def _trusted_url(source: str, board: str, identifier: str, candidate: object) -> str | None:
    if not isinstance(candidate, str) or len(candidate) > 1500:
        return None
    try:
        url = urlsplit(candidate)
        if url.scheme != "https" or url.username or url.password or url.port not in (None, 443):
            return None
        if url.fragment:
            return None
        if source == "greenhouse":
            if url.hostname not in ("job-boards.greenhouse.io", "boards.greenhouse.io"):
                return None
            if not re.fullmatch(rf"/{re.escape(board)}/jobs/{re.escape(identifier)}/?", url.path):
                return None
        else:
            if url.hostname != "jobs.ashbyhq.com":
                return None
            if not re.fullmatch(rf"/{re.escape(board)}/{re.escape(identifier)}/?", url.path):
                return None
        return candidate
    except ValueError:
        return None


def _get_board(source: str, board: str) -> list[dict]:
    if board not in (GREENHOUSE if source == "greenhouse" else ASHBY):
        raise ValueError("Empresa fora do catálogo.")
    cache_key = (source, board)
    with _lock:
        saved = _cache.get(cache_key)
        if saved and saved[0] > time.monotonic():
            return saved[1]
    url = (f"https://boards-api.greenhouse.io/v1/boards/{board}/jobs"
           if source == "greenhouse"
           else f"https://api.ashbyhq.com/posting-api/job-board/{board}")
    params = {"content": "true"} if source == "greenhouse" else {}
    try:
        with (
            httpx.Client(timeout=httpx.Timeout(8.0, connect=3.0),
                         follow_redirects=False, trust_env=False) as client,
            client.stream("GET", url, params=params,
                          headers={"Accept": "application/json"}) as response,
        ):
            if response.status_code != 200 or "json" not in response.headers.get("content-type", "").lower():
                raise JobSearchUnavailable("Fonte ATS indisponível.")
            content = bytearray()
            for chunk in response.iter_bytes():
                content.extend(chunk)
                if len(content) > MAX_RESPONSE_BYTES:
                    raise JobSearchUnavailable("Resposta de vagas acima do limite.")
            parsed = json.loads(content)
    except (httpx.HTTPError, ValueError, TypeError) as exc:
        raise JobSearchUnavailable("Falha na consulta à fonte ATS.") from exc
    if not isinstance(parsed, dict) or not isinstance(parsed.get("jobs"), list):
        raise JobSearchUnavailable("Formato de catálogo inesperado.")
    jobs = [item for item in parsed["jobs"][:400] if isinstance(item, dict)]
    with _lock:
        if len(_cache) > 10:
            _cache.clear()
        _cache[cache_key] = (time.monotonic() + CACHE_SECONDS, jobs)
    return jobs


def _greenhouse_job(job: dict, board: str, query: str, remote_only: bool) -> DiscoveredJob | None:
    identifier = str(job.get("id") or "")
    title = _safe_str(job.get("title"), 180)
    location_data = job.get("location")
    location = _safe_str(location_data.get("name") if isinstance(location_data, dict) else None, 150)
    description = _plain(job.get("content"))
    if not (identifier.isdecimal() and len(title) >= 2 and
            _br_location(location) and _match(query, title, description)):
        return None
    mode = _mode(location)
    if remote_only and mode != "remote":
        return None
    url = _trusted_url("greenhouse", board, identifier, job.get("absolute_url"))
    if not url:
        return None
    return DiscoveredJob(
        opportunity=JobOpportunity(source="greenhouse", external_id=f"{board}-{identifier}",
            title=title, company=GREENHOUSE[board], city=location,
            work_mode=mode, contract_type="unspecified", source_url=url),
        excerpt=description[:350], description=description or None,
        missing_information=[
            "Contrato CLT/PJ não confirmado", "Salário mensal em reais não confirmado",
        ],
    )


def _ashby_job(job: dict, board: str, query: str, remote_only: bool) -> DiscoveredJob | None:
    if job.get("isListed") is False:
        return None
    identifier = _safe_str(job.get("id"), 100)
    title = _safe_str(job.get("title"), 180)
    location = _safe_str(job.get("location"), 150)
    secondary = job.get("secondaryLocations")
    locations = [location]
    if isinstance(secondary, list):
        locations.extend(
            _safe_str(other.get("location"), 150) for other in secondary
            if isinstance(other, dict)
        )
    joined = "; ".join(filter(None, locations))
    description = _safe_str(job.get("descriptionPlain"), 14_000)
    if not (identifier and len(title) >= 2 and _br_location(joined)
            and _match(query, title, description)):
        return None
    mode = _mode(joined, _safe_str(job.get("workplaceType"), 40))
    if job.get("isRemote") is True and mode == "unspecified":
        mode = "remote"
    if remote_only and mode != "remote":
        return None
    url = _trusted_url("ashby", board, identifier, job.get("jobUrl"))
    if not url:
        return None
    employment = _safe_str(job.get("employmentType"), 80)
    return DiscoveredJob(
        opportunity=JobOpportunity(source="ashby", external_id=f"{board}-{identifier}"[:200],
            title=title, company=ASHBY[board], city=joined[:150],
            work_mode=mode, contract_type="unspecified", source_url=url),
        excerpt=description[:350], description=description or None,
        employment_label=employment or None,
        missing_information=[
            "Contrato CLT/PJ não confirmado", "Salário mensal em reais não confirmado",
        ],
    )


def search_ats_board(
    source: str, query: str, *, page: int = 1, remote_only: bool = False,
) -> JobSearchResult:
    if source not in ("greenhouse", "ashby") or not 2 <= len(query.strip()) <= 80 or not 1 <= page <= 5:
        raise ValueError("Parâmetros de busca inválidos.")
    boards = GREENHOUSE if source == "greenhouse" else ASHBY
    jobs: list[DiscoveredJob] = []
    failed: list[str] = []
    for board in boards:
        try:
            for record in _get_board(source, board):
                matched = (_greenhouse_job(record, board, query, remote_only)
                           if source == "greenhouse" else _ashby_job(record, board, query, remote_only))
                if matched:
                    jobs.append(matched)
        except JobSearchUnavailable:
            failed.append(board)
    if len(failed) == len(boards):
        raise JobSearchUnavailable("Nenhuma empresa ATS pôde ser consultada.")
    return JobSearchResult(
        jobs=jobs[(page - 1) * 20:page * 20],
        source_name="Greenhouse" if source == "greenhouse" else "Ashby",
        source_url="https://www.greenhouse.com/" if source == "greenhouse" else "https://www.ashbyhq.com/",
        description="Vagas publicadas em boards ATS oficiais de empresas com atuação no Brasil.",
        limitations=[
            "O catálogo é limitado a empresas previamente verificadas.",
            "Uma vaga publicada pode encerrar sem aviso; confirme no anúncio original.",
            *[f"O board {board} não respondeu." for board in failed],
        ],
    )

"""Brazilian job postings published as open GitHub Issues by developer communities."""
from __future__ import annotations

import html
import json
import re
import threading
import time
from urllib.parse import urlsplit

import httpx

from alinha_api.agent.discovery import (
    DiscoveredJob,
    JobSearchResult,
    JobSearchUnavailable,
    _safe_str,
)
from alinha_api.agent.models import JobOpportunity

# Only fixed, known Brazilian community boards. No arbitrary user URLs or tokens.
BOARDS = ("backend-br/vagas", "frontendbr/vagas")
GITHUB_API = "https://api.github.com/repos/"
MAX_RESPONSE_BYTES = 3_000_000
CACHE_SECONDS = 600
_lock = threading.Lock()
_cache: dict[tuple[str, int], tuple[float, list[dict]]] = {}


def _job_link(item: dict, board: str) -> str | None:
    raw = item.get("html_url")
    if not isinstance(raw, str) or len(raw) > 1500:
        return None
    try:
        parsed = urlsplit(raw)
        if (
            parsed.scheme != "https"
            or parsed.hostname != "github.com"
            or parsed.port not in (None, 443)
            or parsed.username
            or parsed.password
            or not re.fullmatch(
                rf"/{re.escape(board)}/issues/[0-9]+/?", parsed.path
            )
        ):
            return None
    except ValueError:
        return None
    return raw


def _labels(item: dict) -> set[str]:
    labels = item.get("labels")
    if not isinstance(labels, list):
        return set()
    return {
        str(label.get("name") or "").strip().casefold()
        for label in labels
        if isinstance(label, dict)
    }


def _mode(title: str, labels: set[str]) -> str:
    text = (title + " " + " ".join(labels)).casefold()
    flags = {
        "remote": "remoto" in text or "remote" in text or "home office" in text,
        "hybrid": "híbrido" in text or "hibrido" in text or "hybrid" in text,
        "onsite": "presencial" in text or "on-site" in text or "onsite" in text,
    }
    found = [mode for mode, enabled in flags.items() if enabled]
    return found[0] if len(found) == 1 else "unspecified"


def _contract(labels: set[str]) -> str:
    found = set()
    for label in labels:
        if label == "clt":
            found.add("clt")
        if label == "pj":
            found.add("pj")
        if label == "estágio" or label == "estagio":
            found.add("internship")
    return next(iter(found)) if len(found) == 1 else "unspecified"


def _company(title: str) -> str:
    for pattern in (r"\b(?:na|no|at)\s+([^|\[\]]+)$", r"\s[-|]\s([^|\[\]]+)$"):
        match = re.search(pattern, title, flags=re.IGNORECASE)
        if match:
            candidate = _safe_str(match.group(1), 180).strip(" -.[]")
            if 2 <= len(candidate) <= 180:
                return candidate
    return "Empresa não informada"


def _normalize(item: dict, board: str, query: str, remote_only: bool) -> DiscoveredJob | None:
    if not isinstance(item, dict) or "pull_request" in item:
        return None
    url = _job_link(item, board)
    title = _safe_str(item.get("title"), 180)
    if not url or len(title) < 2:
        return None
    terms = [x.casefold() for x in re.findall(r"[^\W_]{3,}", query)]
    body = item.get("body") if isinstance(item.get("body"), str) else ""
    # A title match takes priority: don't surface unrelated postings solely on boilerplate.
    if terms and not any(term in title.casefold() for term in terms):
        if not all(term in body.casefold() for term in terms):
            return None
    labels = _labels(item)
    work_mode = _mode(title, labels)
    if remote_only and work_mode != "remote":
        return None
    identifier = item.get("number")
    if type(identifier) is not int or identifier <= 0:
        return None
    cleaned = html.unescape(re.sub(r"\s+", " ", body)).strip()[:14000]
    location_match = re.match(r"^\[([^\]]{2,120})\]", title)
    location = location_match.group(1) if location_match else None
    if location and any(k in location.casefold() for k in ("remoto", "remote", "híbrido", "hibrido", "presencial")):
        location = None
    return DiscoveredJob(
        opportunity=JobOpportunity(
            source="github-vagas", external_id=f"{board}#{identifier}",
            title=title, company=_company(title), city=location,
            work_mode=work_mode, contract_type=_contract(labels),
            source_url=url,
        ),
        excerpt=cleaned[:350],
        description=cleaned if len(cleaned) >= 60 else None,
        missing_information=[
            "Verifique a disponibilidade atual diretamente na issue",
            *([] if location else ["Cidade não informada"]),
        ],
    )


def _fetch_board(board: str, page: int) -> list[dict]:
    cache_key = (board, page)
    with _lock:
        cached = _cache.get(cache_key)
        if cached and cached[0] > time.monotonic():
            return cached[1]
    try:
        with (
            httpx.Client(
                timeout=httpx.Timeout(8.0, connect=3.0),
                trust_env=False,
                follow_redirects=False,
            ) as client,
            client.stream(
                "GET", GITHUB_API + board + "/issues",
                params={
                    "state": "open", "sort": "created", "direction": "desc",
                    "per_page": 100, "page": page,
                },
                headers={
                    "Accept": "application/vnd.github+json",
                    "User-Agent": "Alinha-Community-Job-Discovery",
                },
            ) as response,
        ):
            if response.status_code != 200 or "json" not in response.headers.get("content-type", "").lower():
                raise JobSearchUnavailable("Comunidade GitHub indisponível.")
            body = bytearray()
            for chunk in response.iter_bytes():
                body.extend(chunk)
                if len(body) > MAX_RESPONSE_BYTES:
                    raise JobSearchUnavailable("A resposta de vagas excede o limite.")
            parsed = json.loads(body)
    except (httpx.HTTPError, ValueError, TypeError) as exc:
        raise JobSearchUnavailable("Não foi possível consultar as comunidades GitHub.") from exc
    if not isinstance(parsed, list):
        raise JobSearchUnavailable("A fonte retornou dados inválidos.")
    items = [item for item in parsed if isinstance(item, dict)]
    with _lock:
        if len(_cache) >= 12:
            _cache.clear()
        _cache[cache_key] = (time.monotonic() + CACHE_SECONDS, items)
    return items


def search_github_jobs(query: str, *, page: int = 1, remote_only: bool = False) -> JobSearchResult:
    if not 2 <= len(query.strip()) <= 80 or not 1 <= page <= 5:
        raise ValueError("Parâmetros de busca inválidos.")
    jobs: list[DiscoveredJob] = []
    failed: list[str] = []
    for board in BOARDS:
        try:
            for item in _fetch_board(board, page):
                result = _normalize(item, board, query.strip(), remote_only)
                if result:
                    jobs.append(result)
        except JobSearchUnavailable:
            failed.append(board)
    if len(failed) == len(BOARDS):
        raise JobSearchUnavailable("Comunidades de vagas temporariamente indisponíveis.")
    return JobSearchResult(
        jobs=jobs[:40],
        source_name="Comunidades GitHub",
        source_url="https://github.com/backend-br/vagas",
        description="Oportunidades anunciadas em comunidades abertas de tecnologia no Brasil.",
        limitations=[
            "As vagas são anúncios de terceiros e podem já estar preenchidas, mesmo com issue aberta.",
            "Empresa, contrato e localização desconhecidos não são inferidos.",
            *[f"Não foi possível consultar {board}." for board in failed],
        ],
    )

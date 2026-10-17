"""Allowlisted public remote job discovery; no generic URL fetching or application submission.

Source: https://himalayas.app/docs/remote-jobs-api
Attribution and original applicationLink are mandatory when displaying listings.
"""
from __future__ import annotations

import json
import re
import threading
import time
from collections import deque
from dataclasses import dataclass
from urllib.parse import urlsplit

import httpx
from pydantic import BaseModel, Field

from alinha_api.agent.models import CandidateCriteria, JobOpportunity

SEARCH_URL = "https://himalayas.app/jobs/api/search"
MAX_BYTES = 450_000
CACHE_SECONDS = 600
CACHE_ITEMS = 30
MAX_NEW_REQUESTS_PER_MINUTE = 12
MAX_RESULTS = 20


class JobSearchUnavailable(Exception):
    """Provider unavailable, rate-limited, or returned invalid data."""


class DiscoveredJob(BaseModel):
    opportunity: JobOpportunity
    excerpt: str = Field(max_length=350)
    description: str | None = Field(default=None, max_length=14000)
    employment_label: str | None = Field(default=None, max_length=80)
    salary_label: str | None = Field(default=None, max_length=100)
    missing_information: list[str] = Field(default_factory=list)


class JobSearchResult(BaseModel):
    jobs: list[DiscoveredJob] = Field(default_factory=list)
    source_name: str = "Himalayas"
    source_url: str = "https://himalayas.app"
    description: str = "Vagas remotas, com possibilidade de trabalho a partir do Brasil."
    limitations: list[str] = Field(default_factory=lambda: [
        "Esta fonte não representa todas as vagas disponíveis no Brasil.",
        "Vínculo CLT/PJ e salário mensal em reais só são exibidos quando confirmados.",
        "Nenhuma candidatura é enviada pelo Alinha nesta etapa.",
    ])


@dataclass
class _CacheEntry:
    expires_at: float
    value: dict


_cache: dict[tuple[str, str, int], _CacheEntry] = {}
_lock = threading.Lock()
_request_times: deque[float] = deque()


def _trusted_listing_url(value: object) -> str | None:
    """External links are data, not fetch targets. Permit only provider application links."""
    if not isinstance(value, str) or len(value) > 1500:
        return None
    try:
        url = urlsplit(value)
        if (
            url.scheme != "https"
            or url.hostname != "himalayas.app"
            or url.port not in (None, 443)
            or url.username is not None
            or url.password is not None
            or not url.path.startswith("/companies/")
        ):
            return None
    except ValueError:
        return None
    return value


def _safe_str(value: object, maximum: int) -> str:
    if not isinstance(value, str):
        return ""
    return re.sub(r"\s+", " ", value).strip()[:maximum]


def _br_eligible(item: dict) -> bool:
    restrictions = item.get("locationRestrictions")
    if not isinstance(restrictions, list):
        return False
    if not restrictions:
        return True
    return any(
        isinstance(loc, dict)
        and str(loc.get("alpha2", "")).upper() == "BR"
        for loc in restrictions
    )


def _normalize(item: dict) -> DiscoveredJob | None:
    url = _trusted_listing_url(item.get("applicationLink"))
    if not url or not _br_eligible(item):
        return None
    title = _safe_str(item.get("title"), 180)
    company = _safe_str(item.get("companyName"), 180)
    identifier = _safe_str(item.get("guid"), 200)
    if not (len(title) >= 2 and len(company) >= 2):
        return None
    if not identifier:
        identifier = url[-200:]
    # Full Time/Contractor is NOT equivalent to CLT/PJ. Do not infer labor contract.
    salary = None
    min_salary = item.get("minSalary")
    if (
        item.get("currency") == "BRL"
        and item.get("salaryPeriod") == "monthly"
        and type(min_salary) in (int, float)
        and 0 <= min_salary <= 10_000_000
    ):
        salary = int(min_salary)
    salary_label = None
    if (
        type(min_salary) in (int, float)
        and 0 <= min_salary <= 10_000_000
        and isinstance(item.get("currency"), str)
        and isinstance(item.get("salaryPeriod"), str)
    ):
        salary_label = f"{item['currency'][:3]} {min_salary:,.0f} / {item['salaryPeriod'][:20]}"
    return DiscoveredJob(
        opportunity=JobOpportunity(
            source="himalayas",
            external_id=identifier,
            title=title,
            company=company,
            city=None,
            work_mode="remote",
            contract_type="unspecified",
            advertised_min_salary_brl=salary,
            source_url=url,
        ),
        excerpt=_safe_str(item.get("excerpt"), 350),
        description=_safe_str(item.get("description"), 14000) or None,
        employment_label=_safe_str(item.get("employmentType"), 80) or None,
        salary_label=salary_label,
        missing_information=[
            "Vínculo CLT/PJ não confirmado",
            *([] if salary is not None else ["Salário mensal em reais não confirmado"]),
        ],
    )


def _get_page(query: str, country: str, page: int) -> dict:
    """Use a fixed provider URL only. No redirects or user-supplied URLs/headers."""
    key = (query.casefold(), country, page)
    with _lock:
        cache = _cache.get(key)
        now = time.monotonic()
        if cache and cache.expires_at > now:
            return cache.value
        while _request_times and _request_times[0] <= now - 60:
            _request_times.popleft()
        if len(_request_times) >= MAX_NEW_REQUESTS_PER_MINUTE:
            raise JobSearchUnavailable("Limite de consultas atingido. Aguarde um minuto.")
        _request_times.append(now)
    try:
        with httpx.Client(
            timeout=httpx.Timeout(8.0, connect=3.0),
            follow_redirects=False,
            trust_env=False,
        ) as client, client.stream(
            "GET", SEARCH_URL,
            params={"q": query, "country": country, "page": page, "sort": "recent"},
            headers={"Accept": "application/json"},
        ) as response:
            if response.status_code != 200:
                raise JobSearchUnavailable("Fonte de vagas indisponível.")
            if "application/json" not in response.headers.get("content-type", "").lower():
                raise JobSearchUnavailable("A fonte retornou um formato inesperado.")
            content = bytearray()
            for part in response.iter_bytes():
                content.extend(part)
                if len(content) > MAX_BYTES:
                    raise JobSearchUnavailable("A resposta excedeu o limite permitido.")
            parsed = json.loads(content)
    except (httpx.HTTPError, ValueError, TypeError) as exc:
        raise JobSearchUnavailable("Não foi possível consultar a fonte de vagas.") from exc
    if not isinstance(parsed, dict) or not isinstance(parsed.get("jobs"), list):
        raise JobSearchUnavailable("A fonte retornou dados inválidos.")
    with _lock:
        if len(_cache) >= CACHE_ITEMS:
            _cache.clear()
        _cache[key] = _CacheEntry(time.monotonic() + CACHE_SECONDS, parsed)
    return parsed


def search_jobs(query: str, *, country: str = "BR", page: int = 1, criteria: CandidateCriteria | None = None) -> JobSearchResult:
    """Search remote job listings available in Brazil; never submit applications."""
    if not 2 <= len(query.strip()) <= 80 or not re.fullmatch(r"[a-zA-Z]{2}", country) or not 1 <= page <= 5:
        raise ValueError("Parâmetros de busca inválidos.")
    # Do not silently show irrelevant locations or pretend Full Time means CLT.
    if criteria and criteria.allowed_work_modes and "remote" not in criteria.allowed_work_modes:
        return JobSearchResult(jobs=[])
    data = _get_page(query.strip(), country.upper(), page)
    results: list[DiscoveredJob] = []
    seen: set[tuple[str, str]] = set()
    for item in data["jobs"][:MAX_RESULTS]:
        if not isinstance(item, dict):
            continue
        result = _normalize(item)
        if not result:
            continue
        key = (result.opportunity.source, result.opportunity.external_id)
        if key not in seen:
            seen.add(key)
            results.append(result)
    return JobSearchResult(jobs=results)

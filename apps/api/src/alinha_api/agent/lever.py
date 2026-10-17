"""Lever public board adapter with a small, allowlisted Brazil-enabled company catalog."""
from __future__ import annotations

import json
import re
from urllib.parse import urlsplit

import httpx

from alinha_api.agent.discovery import (
    DiscoveredJob,
    JobSearchResult,
    JobSearchUnavailable,
    _safe_str,
)
from alinha_api.agent.models import JobOpportunity

# A curated board whose Brazil postings were verified at integration time.
BOARDS = ("Flex",)
LEVER_MAX_BYTES = 2_000_000
BASE = "https://api.lever.co/v0/postings/"
ALLOWED_JOB_HOST = "jobs.lever.co"

def _parse(item: dict, board: str, term: str, remote_only: bool) -> DiscoveredJob | None:
    if not isinstance(item, dict):
        return None
    title = _safe_str(item.get("text"), 180)
    description = _safe_str(item.get("descriptionPlain"), 9000)
    if term.casefold() not in f"{title} {description}".casefold():
        return None
    location = _safe_str((item.get("categories") or {}).get("location"), 150)
    country = str(item.get("country") or "").upper()
    if country not in ("", "BR") or not (
        country == "BR" or "brazil" in location.casefold() or "brasil" in location.casefold()
    ):
        return None
    mode = str(item.get("workplaceType") or "").lower()
    mapped_mode = {"remote": "remote", "hybrid": "hybrid", "on-site": "onsite"}.get(mode, "unspecified")
    if remote_only and mapped_mode != "remote":
        return None
    url = item.get("hostedUrl")
    try:
        parts = urlsplit(url if isinstance(url, str) else "")
        if parts.scheme != "https" or parts.hostname != ALLOWED_JOB_HOST or parts.port not in (None, 443) or parts.username or parts.password:
            return None
        if not parts.path.startswith(f"/{board}/"):
            return None
    except ValueError:
        return None
    identifier = str(item.get("id") or "")
    if len(title) < 2 or not identifier or len(identifier) > 200:
        return None
    commitment = _safe_str((item.get("categories") or {}).get("commitment"), 80)
    return DiscoveredJob(
        opportunity=JobOpportunity(
            source="lever", external_id=f"{board}-{identifier}"[:200],
            title=title, company=board, city=location or None,
            work_mode=mapped_mode, contract_type="unspecified", source_url=url,
        ),
        excerpt=re.sub(r"\s+", " ", description)[:350],
        description=description if len(description) >= 60 else None,
        employment_label=commitment or None,
        missing_information=["Vínculo CLT/PJ não confirmado", "Salário mensal em reais não confirmado"],
    )

def search_lever(query: str, *, page: int = 1, remote_only: bool = False) -> JobSearchResult:
    if not 2 <= len(query.strip()) <= 80 or not 1 <= page <= 5:
        raise ValueError("Parâmetros de busca inválidos.")
    jobs: list[DiscoveredJob] = []
    try:
        with httpx.Client(timeout=httpx.Timeout(8.0, connect=3.0), trust_env=False, follow_redirects=False) as client:
            for board in BOARDS:
                with client.stream("GET", BASE + board, params={"mode": "json"},
                                   headers={"Accept": "application/json"}) as response:
                    if response.status_code != 200 or "application/json" not in response.headers.get("content-type", "").lower():
                        raise JobSearchUnavailable("Fonte Lever indisponível.")
                    body = bytearray()
                    for chunk in response.iter_bytes():
                        body.extend(chunk)
                        if len(body) > LEVER_MAX_BYTES:
                            raise JobSearchUnavailable("Resposta da fonte excedeu o limite.")
                    items = json.loads(body)
                    if not isinstance(items, list):
                        raise JobSearchUnavailable("Resposta da fonte inválida.")
                    for item in items[:200]:
                        parsed = _parse(item, board, query.strip(), remote_only)
                        if parsed:
                            jobs.append(parsed)
    except (httpx.HTTPError, ValueError, TypeError) as exc:
        raise JobSearchUnavailable("Não foi possível consultar a Lever.") from exc
    return JobSearchResult(
        jobs=jobs[(page - 1) * 20 : page * 20], source_name="Lever",
        source_url="https://jobs.lever.co/Flex",
        description="Vagas de empresas no Brasil publicadas em boards Lever.",
        limitations=["A fonte cobre somente empresas cadastradas no catálogo.", "Confirme sempre os requisitos na vaga original."],
    )

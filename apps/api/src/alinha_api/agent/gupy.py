"""Brazilian public Gupy portal connector. Keep isolated from the Himalayas adapter."""
from __future__ import annotations

import html
import re
from urllib.parse import urlsplit

import httpx

from alinha_api.agent.discovery import (
    MAX_BYTES,
    DiscoveredJob,
    JobSearchResult,
    JobSearchUnavailable,
    _safe_str,
)
from alinha_api.agent.models import JobOpportunity

GUPY_API = "https://employability-portal.gupy.io/api/v1/jobs"
CONTRACTS = {
    "vacancy_type_effective": "clt",
    "vacancy_type_legal_entity": "pj",
    "vacancy_legal_entity": "pj",
    "vacancy_type_internship": "internship",
    "vacancy_type_temporary": "temporary",
}

def _job_url(raw: object) -> str | None:
    if not isinstance(raw, str) or len(raw) > 1500:
        return None
    try:
        parsed = urlsplit(raw)
        if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password:
            return None
        host = parsed.hostname.lower()
        if host != "gupy.io" and not host.endswith(".gupy.io"):
            return None
        if parsed.port not in (None, 443):
            return None
    except ValueError:
        return None
    return raw

def _parse(item: dict) -> DiscoveredJob | None:
    url = _job_url(item.get("jobUrl"))
    title = _safe_str(item.get("name"), 180)
    company = _safe_str(item.get("careerPageName"), 180)
    identifier = _safe_str(str(item.get("id", "")), 200)
    if not url or len(title) < 2 or len(company) < 2 or not identifier:
        return None
    if str(item.get("country", "Brasil")).casefold() not in ("brasil", "brazil", "br"):
        return None
    text = re.sub(r"<[^>]*>", " ", str(item.get("description") or ""))
    text = _safe_str(html.unescape(text), 350)
    workplace = str(item.get("workplaceType") or "").lower()
    mode = "remote" if workplace == "remote" or item.get("isRemoteWork") is True else (
        "hybrid" if workplace == "hybrid" else "onsite" if workplace in ("on-site", "onsite") else "unspecified"
    )
    city = _safe_str(item.get("city"), 120) or None
    return DiscoveredJob(
        opportunity=JobOpportunity(
            source="gupy", external_id=identifier, title=title,
            company=company, city=city, work_mode=mode,
            contract_type=CONTRACTS.get(str(item.get("type") or ""), "unspecified"),
            source_url=url,
        ),
        excerpt=text,
        missing_information=["Salário não informado ou não confirmado"],
    )

def search_gupy(query: str, *, page: int = 1, remote_only: bool = False) -> JobSearchResult:
    if not 2 <= len(query.strip()) <= 80 or not 1 <= page <= 5:
        raise ValueError("Parâmetros de busca inválidos.")
    try:
        with (
            httpx.Client(timeout=httpx.Timeout(8.0, connect=3.0), follow_redirects=False, trust_env=False) as client,
            client.stream(
                "GET", GUPY_API,
                params={"jobName": query.strip(), "limit": 20, "offset": (page - 1) * 20,
                        **({"workplaceType": "remote"} if remote_only else {})},
                headers={"Accept": "application/json"},
            ) as response,
        ):
                if response.status_code != 200 or "application/json" not in response.headers.get("content-type", "").lower():
                    raise JobSearchUnavailable("Fonte de vagas indisponível.")
                body = bytearray()
                for chunk in response.iter_bytes():
                    body.extend(chunk)
                    if len(body) > MAX_BYTES:
                        raise JobSearchUnavailable("Resposta muito grande.")
                payload = response.json() if not body else __import__("json").loads(body)
    except (httpx.HTTPError, ValueError, TypeError) as exc:
        raise JobSearchUnavailable("Não foi possível consultar a fonte Gupy.") from exc
    if not isinstance(payload, dict) or not isinstance(payload.get("data"), list):
        raise JobSearchUnavailable("Resposta da fonte inválida.")
    found = []
    seen = set()
    for item in payload["data"][:20]:
        if not isinstance(item, dict):
            continue
        parsed = _parse(item)
        if parsed is None or (remote_only and parsed.opportunity.work_mode != "remote"):
            continue
        if parsed.opportunity.external_id in seen:
            continue
        seen.add(parsed.opportunity.external_id)
        found.append(parsed)
    return JobSearchResult(
        jobs=found, source_name="Gupy", source_url="https://portal.gupy.io/",
        description="Vagas brasileiras do portal público Gupy.",
        limitations=["Dados sujeitos a atualização na plataforma de origem.",
                     "Nenhuma candidatura é enviada pelo Alinha."]
    )

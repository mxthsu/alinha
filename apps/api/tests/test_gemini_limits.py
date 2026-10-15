"""Gemini RPM and RPD enforcement across sessions/processes (no real API requests)."""
import sqlite3
from concurrent.futures import ThreadPoolExecutor
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from alinha_api.main import app
from alinha_api.services import gemini_limits
from alinha_api.services.gemini_limits import LocalQuotaExceeded
from alinha_api.services.provider import GeminiProvider, GeminiRateLimited

MODEL = "gemini-3.5-flash-lite"


def test_defaults_and_safety_headroom(monkeypatch):
    monkeypatch.delenv("GEMINI_MODEL", raising=False)
    assert GeminiProvider(api_key="synthetic-key").model == MODEL
    assert gemini_limits.MAX_REQUESTS_PER_MINUTE < 15
    assert gemini_limits.MAX_REQUESTS_PER_24_HOURS < 500


def test_rolling_minute_persists_and_recovers(tmp_path):
    db = tmp_path / "usage.sqlite3"
    base = 1750000000.0
    for _ in range(gemini_limits.MAX_REQUESTS_PER_MINUTE):
        gemini_limits.reserve(MODEL, path=db, now=base)
    with pytest.raises(LocalQuotaExceeded) as error:
        gemini_limits.reserve(MODEL, path=db, now=base)
    assert error.value.seconds == 60
    # Reloading the SQLite database preserves the quota across API restarts.
    with pytest.raises(LocalQuotaExceeded):
        gemini_limits.reserve(MODEL, path=db, now=base + 59)
    gemini_limits.reserve(MODEL, path=db, now=base + 60)


def test_parallel_reservations_never_exceed_limit(tmp_path):
    db = tmp_path / "parallel.sqlite3"
    def attempt(_: int) -> bool:
        try:
            gemini_limits.reserve(MODEL, path=db, now=1750000000.0)
            return True
        except LocalQuotaExceeded:
            return False

    with ThreadPoolExecutor(max_workers=20) as executor:
        outcomes = list(executor.map(attempt, range(40)))
    assert sum(outcomes) == gemini_limits.MAX_REQUESTS_PER_MINUTE
    with sqlite3.connect(db) as conn:
        count = conn.execute("SELECT COUNT(*) FROM gemini_attempts WHERE model=?", (MODEL,)).fetchone()[0]
    assert count == gemini_limits.MAX_REQUESTS_PER_MINUTE


def test_daily_quota_and_model_isolation(tmp_path):
    db = tmp_path / "daily.sqlite3"
    base = 1750000000.0
    for i in range(gemini_limits.MAX_REQUESTS_PER_24_HOURS):
        gemini_limits.reserve(MODEL, path=db, now=base + 70 * i)
    with pytest.raises(LocalQuotaExceeded, match="400 solicitações"):
        gemini_limits.reserve(MODEL, path=db, now=base + 70 * gemini_limits.MAX_REQUESTS_PER_24_HOURS)
    gemini_limits.reserve("other-model", path=db, now=base + 70 * gemini_limits.MAX_REQUESTS_PER_24_HOURS)


def test_google_429_pauses_further_local_calls(tmp_path, monkeypatch):
    db = tmp_path / "pause.sqlite3"
    monkeypatch.setattr(gemini_limits.time, "time", lambda: 1750000000.0)
    gemini_limits.cooldown(MODEL, path=db, seconds=60)
    with pytest.raises(LocalQuotaExceeded, match="pausa"):
        gemini_limits.reserve(MODEL, path=db, now=1750000030.0)
    gemini_limits.reserve(MODEL, path=db, now=1750000060.0)


def test_http_rate_limit_returns_retry_after(monkeypatch):
    monkeypatch.setenv("ALINHA_DEPLOYMENT_MODE", "community")
    monkeypatch.setattr("alinha_api.main.api_key", lambda name: "synthetic-key")
    monkeypatch.setattr("alinha_api.main.GeminiProvider", lambda: SimpleNamespace(
        analyze=lambda *_: (_ for _ in ()).throw(GeminiRateLimited("Aguarde antes de tentar.", 42))
    ))
    client = TestClient(app)
    response = client.post("/api/v1/analyses/text", json={
        "resume_text": "Currículo fictício com projetos e experiência em Python, FastAPI e pytest.",
        "job_description": "Vaga fictícia pede experiência com Python e desenvolvimento de APIs e testes.",
        "provider": "gemini",
    })
    assert response.status_code == 429
    assert response.headers["retry-after"] == "42"
    assert "Aguarde" in response.json()["detail"]


def test_generation_request_disables_automatic_retries(monkeypatch):
    from alinha_api.services import provider as provider_module
    calls = []

    class DummyClient:
        def __init__(self, *, http_options, **kwargs):
            calls.append(http_options.retry_options.attempts)
            self.models = SimpleNamespace(generate_content=lambda **kwargs: SimpleNamespace(
                parsed={"job_title": "Backend", "requirements": [{
                    "requirement": "Python", "status": "evidenciado",
                    "job_evidence": "Python",
                    "resume_evidence": "Python",
                    "recommendation": "Descreva sua experiência em Python.",
                }]},
                text=None,
            ))
        def __enter__(self):
            return self
        def __exit__(self, *_):
            return False

    monkeypatch.setattr(provider_module, "reserve_gemini_request", lambda model: None)
    monkeypatch.setattr(provider_module.genai, "Client", DummyClient)
    report = GeminiProvider(api_key="synthetic-key").analyze("Currículo Python", "Vaga Python")
    assert report.requirements[0].requirement == "Python"
    assert calls == [1]

"""Conservative Gemini inference quota for a single Community installation.

Reservations are persisted in SQLite so concurrent requests, worker processes and
local API restarts all share the same rolling windows. No keys or document contents
are recorded. This does NOT know usage by other clients in the same Google project.
"""
from __future__ import annotations

import math
import os
import sqlite3
import time
from contextlib import closing
from pathlib import Path

MAX_REQUESTS_PER_MINUTE = 10  # Safety headroom under a project RPM limit of 15.
MAX_REQUESTS_PER_24_HOURS = 400  # Safety headroom under the user's RPD limit of 500.
MINUTE_SECONDS = 60
DAY_SECONDS = 86400


class LocalQuotaExceeded(Exception):
    def __init__(self, seconds: int, period: str):
        self.seconds = max(1, seconds)
        self.period = period
        super().__init__(f"Limite local do Gemini atingido ({period}). Aguarde {self.seconds} s.")


class QuotaStorageUnavailable(Exception):
    pass


def _database_path() -> Path:
    base = (
        Path(os.environ["LOCALAPPDATA"])
        if os.name == "nt" and os.getenv("LOCALAPPDATA")
        else Path.home() / ".local" / "state"
    )
    return base / "alinha" / "gemini-limits.sqlite3"


def _connect(path: Path) -> sqlite3.Connection:
    path.parent.mkdir(parents=True, exist_ok=True)
    if os.name != "nt":
        path.parent.chmod(0o700)
    conn = sqlite3.connect(str(path), timeout=10, isolation_level=None)
    try:
        conn.execute("PRAGMA busy_timeout=10000")
        conn.execute(
            "CREATE TABLE IF NOT EXISTS gemini_attempts (model TEXT NOT NULL, timestamp REAL NOT NULL)"
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_gemini_attempts ON gemini_attempts(model,timestamp)"
        )
        conn.execute(
            "CREATE TABLE IF NOT EXISTS gemini_cooldowns (model TEXT PRIMARY KEY, until_at REAL NOT NULL)"
        )
        if os.name != "nt":
            path.chmod(0o600)
        return conn
    except Exception:
        conn.close()
        raise


def reserve(model: str, *, path: Path | None = None, now: float | None = None) -> None:
    """Reserve one HTTP inference attempt before contacting the remote provider.

    Failed provider calls still count, and all worker processes serialize under
    BEGIN IMMEDIATE. The two windows remain effective across server restarts.
    """
    timestamp = time.time() if now is None else now
    db_path = path if path is not None else _database_path()
    try:
        with closing(_connect(db_path)) as db, db:
            db.execute("BEGIN IMMEDIATE")
            db.execute("DELETE FROM gemini_attempts WHERE timestamp <= ?", (timestamp - DAY_SECONDS,))
            cooldown = db.execute(
                "SELECT until_at FROM gemini_cooldowns WHERE model = ?", (model,)
            ).fetchone()
            if cooldown and cooldown[0] > timestamp:
                raise LocalQuotaExceeded(math.ceil(cooldown[0] - timestamp), "pausa do provedor")

            last_minute = db.execute(
                "SELECT COUNT(*), MIN(timestamp) FROM gemini_attempts "
                "WHERE model = ? AND timestamp > ?",
                (model, timestamp - MINUTE_SECONDS),
            ).fetchone()
            if last_minute[0] >= MAX_REQUESTS_PER_MINUTE:
                retry = math.ceil(last_minute[1] + MINUTE_SECONDS - timestamp)
                raise LocalQuotaExceeded(retry, "10 solicitações por minuto")

            last_day = db.execute(
                "SELECT COUNT(*), MIN(timestamp) FROM gemini_attempts "
                "WHERE model = ? AND timestamp > ?",
                (model, timestamp - DAY_SECONDS),
            ).fetchone()
            if last_day[0] >= MAX_REQUESTS_PER_24_HOURS:
                retry = math.ceil(last_day[1] + DAY_SECONDS - timestamp)
                raise LocalQuotaExceeded(retry, "400 solicitações em 24 horas")

            db.execute(
                "INSERT INTO gemini_attempts(model,timestamp) VALUES (?,?)", (model, timestamp)
            )
    except LocalQuotaExceeded:
        raise
    except (sqlite3.Error, OSError) as exc:
        # Fail closed: never bypass local limits when persistence is unavailable.
        raise QuotaStorageUnavailable(
            "Não foi possível conferir o limite local de uso do Gemini."
        ) from exc


def cooldown(model: str, *, seconds: int = 60, path: Path | None = None) -> None:
    """Pause further calls after an actual Google 429 (incl. shared project quota)."""
    db_path = path if path is not None else _database_path()
    try:
        with closing(_connect(db_path)) as db, db:
            db.execute("BEGIN IMMEDIATE")
            db.execute(
                "INSERT INTO gemini_cooldowns(model,until_at) VALUES(?,?) "
                "ON CONFLICT(model) DO UPDATE SET until_at = MAX(until_at,excluded.until_at)",
                (model, time.time() + seconds),
            )
    except (sqlite3.Error, OSError) as exc:
        raise QuotaStorageUnavailable(
            "Não foi possível registrar a pausa de uso do Gemini."
        ) from exc

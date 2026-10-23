"""Durable per-journey AI-call reservations; no prompts, tokens, CVs or credentials stored."""
from __future__ import annotations

import sqlite3
import time
from dataclasses import dataclass
from pathlib import Path
from uuid import UUID

from alinha_api.services.community_storage import user_paths

MAX_CALLS_PER_JOURNEY = 2
RETENTION_SECONDS = 14 * 24 * 60 * 60


class CallBudgetExhausted(Exception):
    """Per-journey model-call budget is exhausted."""


class DuplicateIntentRequest(Exception):
    """An identical request cannot accidentally cause a second model call."""


class CallBudgetUnavailable(Exception):
    """A local ledger failure must stop the model call, not bypass accounting."""


@dataclass(frozen=True)
class CallReservation:
    calls_used: int
    calls_remaining: int


def reserve_call(
    run_id: UUID,
    request_id: UUID,
    *,
    path: Path | None = None,
) -> CallReservation:
    """Atomic reservation before inference; failed/ambiguous calls still consume a slot.

    A separate run ID can reset the *per-journey* allowance. This is not a global
    provider spending limit or a monetary token budget.
    """
    database = path or user_paths()[1]
    conn: sqlite3.Connection | None = None
    try:
        database.parent.mkdir(parents=True, exist_ok=True)
        conn = sqlite3.connect(database, timeout=3, isolation_level=None)
        conn.execute("BEGIN IMMEDIATE")
        conn.execute(
            "CREATE TABLE IF NOT EXISTS agent_intent_call_ledger ("
            "run_id TEXT NOT NULL, request_id TEXT NOT NULL,"
            "reserved_at INTEGER NOT NULL,"
            "PRIMARY KEY (run_id, request_id))"
        )
        now = int(time.time())
        conn.execute(
            "DELETE FROM agent_intent_call_ledger WHERE reserved_at < ?",
            (now - RETENTION_SECONDS,),
        )
        if conn.execute(
            "SELECT 1 FROM agent_intent_call_ledger WHERE run_id = ? AND request_id = ?",
            (str(run_id), str(request_id)),
        ).fetchone():
            conn.execute("ROLLBACK")
            raise DuplicateIntentRequest()
        used = conn.execute(
            "SELECT COUNT(*) FROM agent_intent_call_ledger WHERE run_id = ?",
            (str(run_id),),
        ).fetchone()[0]
        if used >= MAX_CALLS_PER_JOURNEY:
            conn.execute("ROLLBACK")
            raise CallBudgetExhausted()
        conn.execute(
            "INSERT INTO agent_intent_call_ledger (run_id, request_id, reserved_at) "
            "VALUES (?, ?, ?)",
            (str(run_id), str(request_id), now),
        )
        conn.execute("COMMIT")
        return CallReservation(
            calls_used=used + 1,
            calls_remaining=MAX_CALLS_PER_JOURNEY - used - 1,
        )
    except sqlite3.Error as exc:
        if conn is not None and conn.in_transaction:
            conn.rollback()
        raise CallBudgetUnavailable() from exc
    except OSError as exc:
        raise CallBudgetUnavailable() from exc
    finally:
        if conn is not None:
            conn.close()

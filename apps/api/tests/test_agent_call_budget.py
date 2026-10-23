"""Local AI reservations: atomic, non-sensitive and crash-surviving."""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from uuid import uuid4

import pytest

from alinha_api.agent.call_budget import (
    CallBudgetExhausted,
    CallBudgetUnavailable,
    DuplicateIntentRequest,
    reserve_call,
)


def test_two_calls_only_and_repeated_request_never_reexecutes(tmp_path):
    db = tmp_path / "budget.sqlite3"
    run = uuid4()
    a, b, c = uuid4(), uuid4(), uuid4()
    first = reserve_call(run, a, path=db)
    assert first.calls_used == 1
    assert first.calls_remaining == 1
    with pytest.raises(DuplicateIntentRequest):
        reserve_call(run, a, path=db)
    second = reserve_call(run, b, path=db)
    assert second.calls_used == 2
    assert second.calls_remaining == 0
    with pytest.raises(CallBudgetExhausted):
        reserve_call(run, c, path=db)
    # A separate journey may start a new allowance, not a global money cap.
    assert reserve_call(uuid4(), uuid4(), path=db).calls_used == 1


def test_concurrent_reservations_never_exceed_limit(tmp_path):
    db = tmp_path / "parallel.sqlite3"
    run = uuid4()
    def attempt(_):
        try:
            reserve_call(run, uuid4(), path=db)
            return True
        except CallBudgetExhausted:
            return False
    with ThreadPoolExecutor(max_workers=8) as pool:
        results = list(pool.map(attempt, range(8)))
    assert results.count(True) == 2
    assert results.count(False) == 6


def test_budget_is_durable_across_callers(tmp_path):
    database = tmp_path / "persist.sqlite3"
    run = uuid4()
    reserve_call(run, uuid4(), path=database)
    # New sqlite3 connection and an independent caller observe the same limit.
    second = reserve_call(run, uuid4(), path=database)
    assert second.calls_remaining == 0


def test_storage_failure_prevents_inference(tmp_path):
    impossible = tmp_path / "folder"
    impossible.mkdir()
    with pytest.raises(CallBudgetUnavailable):
        reserve_call(uuid4(), uuid4(), path=impossible)


def test_ledger_contains_only_random_identifiers(tmp_path):
    import sqlite3
    db = Path(tmp_path / "ledger.sqlite3")
    run, request = uuid4(), uuid4()
    reserve_call(run, request, path=db)
    with sqlite3.connect(db) as conn:
        rows = conn.execute(
            "SELECT run_id,request_id FROM agent_intent_call_ledger"
        ).fetchall()
    assert rows == [(str(run), str(request))]

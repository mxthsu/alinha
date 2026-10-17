"""Transactional browser-to-SQLite import, export and recovery for local Community data."""
from __future__ import annotations

import json
import sqlite3
import uuid
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from alinha_api.services import community_storage as storage
from alinha_api.services.community_storage import (
    MAX_RECORD_BYTES,
    RevisionConflict,
    _connect,
    _private_directory,
    get_record,
    validate_record,
)

KINDS = ("resume", "opportunities")
BACKUP_FORMAT = "alinha-community-backup"
BACKUP_VERSION = 1


def export_records(path: Path | None = None) -> dict[str, Any]:
    """Portable JSON backup; never includes provider credentials or tokens."""
    path = path or storage.user_paths()[1]
    records = {}
    for kind in KINDS:
        value, revision = get_record(kind, path)
        records[kind] = {"value": value, "revision": revision}
    return {
        "format": BACKUP_FORMAT,
        "version": BACKUP_VERSION,
        "created_at": datetime.now(UTC).isoformat(),
        "records": records,
    }


def atomic_import(
    values: dict[str, object],
    expected_revisions: dict[str, int],
    *,
    overwrite: bool = False,
    path: Path | None = None,
) -> dict[str, Any]:
    """Validate all inputs, snapshot current DB, then write all records in one transaction.

    Existing nonidentical records are protected unless explicitly restoring a backup.
    The caller keeps the browser data untouched until a read-back verification.
    """
    if not values or any(k not in KINDS for k in values):
        raise ValueError("Tipos de registro inválidos.")
    normalized = {}
    for kind, value in values.items():
        checked = validate_record(kind, value)
        encoded = json.dumps(checked, ensure_ascii=False, separators=(",", ":"))
        if len(encoded.encode("utf-8")) > MAX_RECORD_BYTES:
            raise ValueError("Registro excede o limite de tamanho.")
        expected = expected_revisions.get(kind)
        if type(expected) is not int or not 0 <= expected <= 2**31:
            raise ValueError("Revisão esperada inválida.")
        normalized[kind] = encoded

    path = path or storage.user_paths()[1]
    _private_directory(path.parent / "backups")
    backup = path.parent / "backups" / f"before-import-{uuid.uuid4().hex}.sqlite3"
    revisions: dict[str, int] = {}
    with _connect(path) as db:
        with sqlite3.connect(backup) as backup_db:
            db.backup(backup_db)
        try:
            db.execute("BEGIN IMMEDIATE")
            # Compare all revisions and payloads before issuing any INSERT.
            for kind, payload in normalized.items():
                row = db.execute(
                    "SELECT payload, revision FROM records WHERE kind=?", (kind,)
                ).fetchone()
                revision = row[1] if row else 0
                if revision != expected_revisions[kind]:
                    raise RevisionConflict("Os dados locais foram alterados em outra aba.")
                if row and not overwrite and json.loads(row[0]) != json.loads(payload):
                    raise RevisionConflict("Já existem dados diferentes no banco. Nenhum registro foi substituído.")
                revisions[kind] = revision
            for kind, payload in normalized.items():
                existing = db.execute(
                    "SELECT payload FROM records WHERE kind=?", (kind,)
                ).fetchone()
                if existing and json.loads(existing[0]) == json.loads(payload):
                    continue
                next_rev = revisions[kind] + 1
                db.execute(
                    "INSERT INTO records(kind,payload,revision) VALUES(?,?,?) "
                    "ON CONFLICT(kind) DO UPDATE SET payload=excluded.payload, revision=excluded.revision",
                    (kind, payload, next_rev),
                )
                revisions[kind] = next_rev
        except BaseException:
            db.rollback()
            raise
    # Readback verifies the transaction; source browser copies have NOT been deleted.
    for kind, payload in normalized.items():
        actual, revision = get_record(kind, path)
        if actual != json.loads(payload) or revision != revisions[kind]:
            raise OSError("Falha na verificação dos dados importados.")
    return {"revisions": revisions, "backup_file": backup.name}


def restore_export(
    document: object, expected_revisions: dict[str, int], path: Path | None = None,
) -> dict[str, Any]:
    if not isinstance(document, dict) or document.get("format") != BACKUP_FORMAT or document.get("version") != BACKUP_VERSION:
        raise ValueError("Backup incompatível.")
    records = document.get("records")
    if not isinstance(records, dict) or set(records) != set(KINDS):
        raise ValueError("Backup incompleto.")
    values = {}
    for kind in KINDS:
        record = records.get(kind)
        if not isinstance(record, dict) or "value" not in record:
            raise ValueError("Backup malformado.")
        if record["value"] is not None:
            values[kind] = record["value"]
    if not values:
        raise ValueError("Backup sem dados para restaurar.")
    return atomic_import(values, expected_revisions, overwrite=True, path=path)

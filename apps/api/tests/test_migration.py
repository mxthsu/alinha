"""Atomic, safe migration and local recovery tests with synthetic candidates only."""
import json
import sqlite3

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from alinha_api import main
from alinha_api.services import community_storage as storage
from alinha_api.services import migration


def profile(name="Pessoa Exemplo"):
    return {
        "schema_version": 1,
        "contact": {"name": name, "headline": "Engenharia de IA"},
        "summary": "Perfil fictício para testes.",
        "experiences": [], "education": [], "projects": [],
        "skills": ["Python"], "languages": [],
    }


def opportunity():
    return {
        "id": "vaga-sintetica-1", "title": "Engenheiro de IA", "company": "Empresa Fictícia",
        "url": "https://empresa.example.com/jobs/1", "source": "example",
        "sourceId": "1", "status": "saved",
        "addedAt": "2026-10-17T10:00:00Z", "updatedAt": "2026-10-17T10:00:00Z",
    }


def test_atomic_import_creates_snapshot_and_commits_together(tmp_path):
    db = tmp_path / "data" / "community.sqlite3"
    result = migration.atomic_import(
        {"resume": {"profile": profile()}, "opportunities": [opportunity()]},
        {"resume": 0, "opportunities": 0}, path=db,
    )
    assert result["revisions"] == {"resume": 1, "opportunities": 1}
    assert (db.parent / "backups" / result["backup_file"]).exists()
    with sqlite3.connect(db.parent / "backups" / result["backup_file"]) as snapshot:
        assert snapshot.execute("SELECT COUNT(*) FROM records").fetchone()[0] == 0
    assert storage.get_record("resume", db)[0]["profile"]["contact"]["name"] == "Pessoa Exemplo"
    assert storage.get_record("opportunities", db)[0][0]["id"] == opportunity()["id"]


def test_stale_revision_and_existing_data_never_overwrite(tmp_path):
    db = tmp_path / "community.sqlite3"
    storage.save_record("resume", {"profile": profile()}, 0, db)
    with pytest.raises(storage.RevisionConflict):
        migration.atomic_import(
            {"resume": {"profile": profile("Pessoa Diferente")}, "opportunities": [opportunity()]},
            {"resume": 1, "opportunities": 0}, path=db,
        )
    assert storage.get_record("opportunities", db) == (None, 0)
    assert storage.get_record("resume", db)[0]["profile"]["contact"]["name"] == "Pessoa Exemplo"
    with pytest.raises(storage.RevisionConflict):
        migration.atomic_import({"resume": {"profile": profile()}}, {"resume": 0}, path=db)


def test_invalid_data_rejected_before_any_write(tmp_path):
    db = tmp_path / "community.sqlite3"
    unsafe = {**opportunity(), "url": "http://127.0.0.1/private"}
    with pytest.raises(ValidationError):
        migration.atomic_import(
            {"resume": {"profile": profile()}, "opportunities": [unsafe]},
            {"resume": 0, "opportunities": 0}, path=db,
        )
    assert not db.exists()


def test_export_and_restore_with_revision_guard(tmp_path):
    db = tmp_path / "community.sqlite3"
    migration.atomic_import({"resume": {"profile": profile()}}, {"resume": 0}, path=db)
    backup = migration.export_records(db)
    assert backup["format"] == "alinha-community-backup"
    assert "api_key" not in json.dumps(backup)
    storage.save_record("resume", {"profile": profile("Pessoa Nova")}, 1, db)
    with pytest.raises(storage.RevisionConflict):
        migration.restore_export(backup, {"resume": 1}, db)
    restored = migration.restore_export(backup, {"resume": 2}, db)
    assert restored["revisions"]["resume"] == 3
    assert storage.get_record("resume", db)[0]["profile"]["contact"]["name"] == "Pessoa Exemplo"


def test_migration_api_and_cors(tmp_path, monkeypatch):
    monkeypatch.setattr(storage, "user_paths", lambda: (
        tmp_path / "config.jsonc", tmp_path / "data" / "community.sqlite3"
    ))
    monkeypatch.setattr(main, "get_mode", lambda: "community")
    client = TestClient(main.app, base_url="http://localhost", client=("127.0.0.1", 4321))
    headers = {"origin": "http://localhost:3000"}
    preflight = client.options("/api/v1/community/data/resume", headers={
        **headers, "access-control-request-method": "PUT",
    })
    assert preflight.status_code == 200
    assert "PUT" in preflight.headers["access-control-allow-methods"]
    imported = client.post("/api/v1/community/migration", headers=headers, json={
        "resume": {"profile": profile()}, "opportunities": [opportunity()],
        "expected_revisions": {"resume": 0, "opportunities": 0},
    })
    assert imported.status_code == 200, imported.text
    assert imported.json()["revisions"] == {"resume": 1, "opportunities": 1}
    exported = client.get("/api/v1/community/backup")
    assert exported.status_code == 200, exported.text
    assert exported.headers["cache-control"] == "no-store"
    assert exported.json()["records"]["resume"]["revision"] == 1
    assert client.post("/api/v1/community/migration", json={}, headers=headers).status_code == 422
    assert client.post("/api/v1/community/migration", json={
        "resume": {"profile": profile("Outra Pessoa")},
        "expected_revisions": {"resume": 1},
    }, headers=headers).status_code == 409
    assert client.post("/api/v1/community/restore", headers=headers, json={
        "backup": exported.json(), "expected_revisions": {"resume": 1, "opportunities": 1}
    }).status_code == 200
    assert client.post("/api/v1/community/migration", headers={
        "origin": "https://malicioso.example"
    }, json={"resume": {"profile": profile()}, "expected_revisions": {"resume": 1}}).status_code == 403


def test_backup_preserves_approved_versions_and_old_backups(tmp_path):
    db = tmp_path / "community.sqlite3"
    approved = {
        "version": 1,
        "job": {
            "title": "Engenharia de IA", "company": "Empresa Fictícia",
            "source": "lever", "excerpt": "Python",
            "url": "https://jobs.lever.co/Flex/example",
        },
        "profile": profile(), "template": "classico",
        "approvedAt": "2026-10-17T03:00:00Z",
    }
    assert migration.atomic_import(
        {"resume_versions": [approved]}, {"resume_versions": 0}, path=db,
    )["revisions"]["resume_versions"] == 1
    assert migration.atomic_import(
        {"resume": {"profile": profile()}}, {"resume": 0}, path=db,
    )["revisions"]["resume"] == 1
    backup = migration.export_records(db)
    assert backup["records"]["resume_versions"]["value"][0]["job"]["title"] == "Engenharia de IA"
    old = {
        **backup,
        "records": {k: v for k, v in backup["records"].items() if k != "resume_versions"},
    }
    # Version-one backup documents that predate this feature remain restorable.
    restored = migration.restore_export(old, {"resume": 1, "opportunities": 0}, db)
    assert restored["revisions"]["resume"] == 1
    assert storage.get_record("resume_versions", db)[1] == 1
    # New backups include versions and can restore them after a controlled deletion.
    assert storage.clear_record("resume_versions", 1, db) == 2
    result = migration.restore_export(
        backup, {"resume_versions": 2, "resume": 1, "opportunities": 0}, db,
    )
    assert result["revisions"]["resume_versions"] == 3



def test_partial_legacy_import_does_not_resurrect_deleted_resume(tmp_path):
    db = tmp_path / "community.sqlite3"
    assert storage.save_record("resume", {"profile": profile()}, 0, db) == 1
    assert storage.clear_record("resume", 1, db) == 2
    versions = [{
        "version": 1,
        "job": {
            "title": "Engenharia de IA", "company": "Empresa Fictícia",
            "source": "lever", "excerpt": "",
            "url": "https://jobs.lever.co/Flex/legacy-example",
        },
        "profile": profile(), "template": "classico",
        "approvedAt": "2026-10-17T03:00:00Z",
    }]
    imported = migration.atomic_import(
        {"resume_versions": versions}, {"resume_versions": 0}, path=db,
    )
    assert imported["revisions"] == {"resume_versions": 1}
    assert storage.get_record("resume", db) == (None, 2)
    assert storage.get_record("resume_versions", db)[0][0]["job"]["title"] == "Engenharia de IA"
    with pytest.raises(storage.RevisionConflict):
        migration.atomic_import({"resume": {"profile": profile()}}, {"resume": 2}, path=db)

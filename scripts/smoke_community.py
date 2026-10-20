"""Self-contained offline release smoke for Alinha Community.

Run from apps/api:
  uv run python ../../scripts/smoke_community.py

All records, settings and snapshots live in a disposable temporary directory.
This script never binds a port, contacts job boards or connects to an AI provider.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path
from tempfile import TemporaryDirectory

from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "apps" / "api" / "src"))

from alinha_api import main  # noqa: E402
from alinha_api.services import community_storage as storage  # noqa: E402

ORIGIN = {"origin": "http://localhost:3000"}
API = "/api/v1/community"


def demand(response, expected: int) -> dict:
    if response.status_code != expected:
        raise AssertionError(
            f"HTTP {response.status_code}, esperado {expected}: {response.text[:300]}"
        )
    if expected == 204:
        return {}
    return response.json()


def sample_job(identifier: str) -> dict:
    return {
        "id": identifier,
        "title": "Desenvolvedor Python (vaga fictícia)",
        "company": "Empresa Demonstrativa",
        "url": f"https://jobs.lever.co/Flex/{identifier}",
        "source": "lever",
        "sourceId": identifier,
        "status": "saved",
        "addedAt": "2026-10-20T10:00:00Z",
        "updatedAt": "2026-10-20T10:00:00Z",
    }


def approved_version(profile: dict, suffix: str) -> dict:
    return {
        "version": 1,
        "job": {
            "title": "Engenharia Python (vaga fictícia)",
            "company": "Empresa Demonstrativa",
            "source": "lever",
            "excerpt": "Python e APIs",
            "url": f"https://jobs.lever.co/Flex/{suffix}",
        },
        "profile": profile,
        "template": "classico",
        "approvedAt": "2026-10-20T10:00:00Z",
    }


def smoke() -> None:
    with TemporaryDirectory(prefix="alinha-community-smoke-") as temp:
        isolated = Path(temp)
        config = isolated / "config" / "config.jsonc"
        database = isolated / "data" / "community.sqlite3"
        original_paths = storage.user_paths
        original_mode = main.get_mode
        try:
            storage.user_paths = lambda: (config, database)
            main.get_mode = lambda: "community"
            with TestClient(
                main.app,
                base_url="http://localhost",
                client=("127.0.0.1", 49731),
            ) as client:
                assert demand(client.get("/health"), 200)["status"] == "ok"

                # Preferences are local and explicit; no provider keys are added.
                settings = demand(client.get(API + "/settings"), 200)
                assert settings["job_preferences"] is None
                settings["job_preferences"] = {
                    "source": "greenhouse", "workMode": "hybrid",
                    "contract": "clt", "city": "Florianópolis, SC", "salary": "5500",
                }
                saved_settings = demand(
                    client.put(API + "/settings", headers=ORIGIN, json=settings), 200
                )
                assert saved_settings["job_preferences"]["city"] == "Florianópolis, SC"
                assert saved_settings["connectors"]["ashby"]["enabled"] is True

                # Import only the repository's synthetic CV; no real user data.
                fixture = ROOT / "examples" / "resume.txt"
                preview = demand(
                    client.post(
                        "/api/v1/resumes/structured/import/upload",
                        files={"file": ("ficticio.txt", fixture.read_bytes(), "text/plain")},
                    ), 200
                )
                profile = preview["profile"]
                assert profile["contact"]["name"] == ""
                assert profile["contact"]["headline"] == "Desenvolvedor de backend"
                assert "Desenvolvedor(a) de backend" in profile["summary"]
                assert any("Python" in line for line in preview["unassigned_lines"])
                assert preview["requires_confirmation"] is True

                initial = demand(client.get(API + "/data/resume"), 200)
                assert initial == {"value": None, "revision": 0}
                created = demand(
                    client.put(API + "/data/resume", headers=ORIGIN, json={
                        "expected_revision": initial["revision"],
                        "value": {"profile": profile, "template": "classico"},
                    }), 200,
                )
                assert created["revision"] == 1
                assert demand(
                    client.put(API + "/data/resume", headers=ORIGIN, json={
                        "expected_revision": 0,
                        "value": {"profile": profile, "template": "classico"},
                    }), 409,
                )["detail"]

                opportunities = [sample_job("job-fixture-1"), sample_job("job-fixture-2")]
                versions = [
                    approved_version(profile, "job-fixture-1"),
                    approved_version(profile, "job-fixture-2"),
                ]
                for kind, value in (("opportunities", opportunities), ("resume_versions", versions)):
                    assert demand(
                        client.put(API + "/data/" + kind, headers=ORIGIN,
                                   json={"expected_revision": 0, "value": value}), 200,
                    )["revision"] == 1

                # Never trust another local web origin, even without public internet.
                unauthorized = client.put(
                    API + "/data/resume",
                    headers={"origin": "https://untrusted.example"},
                    json={"expected_revision": 1, "value": {"profile": profile}},
                )
                assert unauthorized.status_code == 403

                backup = demand(client.get(API + "/backup"), 200)
                assert backup["format"] == "alinha-community-backup"
                assert backup["records"]["resume_versions"]["value"] == versions
                assert not any(secret in json.dumps(backup).lower() for secret in
                               ("api_key", "access_token", "password", "private_key"))

                # Clear two independent records; verify restoration of BOTH versions.
                revisions = {"resume": 1, "opportunities": 1, "resume_versions": 1}
                for kind in ("resume", "resume_versions"):
                    cleared = demand(
                        client.delete(API + f"/data/{kind}?expected_revision=1",
                                      headers=ORIGIN), 200,
                    )
                    assert cleared["revision"] == 2
                    revisions[kind] = 2

                restored = demand(client.post(
                    API + "/restore", headers=ORIGIN, json={
                        "backup": backup, "expected_revisions": revisions,
                    },
                ), 200)
                assert restored["revisions"]["resume"] == 3
                assert restored["revisions"]["resume_versions"] == 3
                restored_versions = demand(client.get(API + "/data/resume_versions"), 200)
                assert len(restored_versions["value"]) == 2
                restored_resume = demand(client.get(API + "/data/resume"), 200)
                assert restored_resume["value"]["profile"]["summary"] == profile["summary"]
                assert demand(client.get(API + "/data/opportunities"), 200)["value"] == opportunities

                # Broken import must not corrupt records already recovered.
                invalid = client.post(API + "/restore", headers=ORIGIN, json={
                    "backup": {"format": "alinha-community-backup", "version": 1},
                    "expected_revisions": restored["revisions"],
                })
                assert invalid.status_code == 422
                assert demand(client.get(API + "/data/resume_versions"), 200)["value"] == versions

                assert config.exists() and database.exists()
                assert all(str(x).startswith(str(isolated)) for x in (config, database))
                print("PASSOU: importação TXT fictícia, cargo explícito, SQLite e revisão concorrente.")
                print("PASSOU: 2 vagas + 2 versões aprovadas, backup, exclusão e restauração.")
                print("PASSOU: origem não autorizada bloqueada, backup inválido rejeitado.")
                print("PASSOU: armazenamento temporário isolado; nada gravado nos dados do usuário.")
        finally:
            storage.user_paths = original_paths
            main.get_mode = original_mode


if __name__ == "__main__":
    try:
        smoke()
    except (AssertionError, OSError, ValueError) as error:
        print(f"FALHOU: {error}", file=sys.stderr)
        raise SystemExit(1) from error

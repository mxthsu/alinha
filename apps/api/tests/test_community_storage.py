"""Isolated tests: no real user files, OS vault or external requests."""

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from alinha_api import main
from alinha_api.services import community_storage as storage


def profile():
    return {
        "schema_version": 1,
        "contact": {"name": "Pessoa Exemplo", "headline": "Engenharia de Software"},
        "summary": "Perfil fictício para testes.",
        "experiences": [], "education": [], "projects": [],
        "skills": ["Python"], "languages": [],
    }


def opportunity(url="https://jobs.example.com/positions/123"):
    return {
        "id": "job-test-1", "title": "Engenharia de Software",
        "company": "Empresa Exemplo", "url": url,
        "source": "example", "sourceId": "123", "status": "saved",
        "addedAt": "2026-10-16T13:00:00Z",
        "updatedAt": "2026-10-16T13:00:00Z",
    }


def test_jsonc_comments_trailing_comma_and_url_literals(tmp_path):
    path = tmp_path / "config.jsonc"
    path.write_text('''{
        // Preferências do usuário
        "version": 1,
        "ai": {"preferred_provider": "gemini",},
        "agent": {"search": "assisted", "applications": "review_only",},
        /* Não armazenar segredos */
        "connectors": {"himalayas": {"enabled": false}},
    }''', encoding="utf-8")
    read = storage.read_settings(path)
    assert read.connectors.himalayas.enabled is False
    assert read.ai.preferred_provider == "gemini"
    assert storage.read_jsonc('{"test": "https://example.com/jobs//123",}') == {
        "test": "https://example.com/jobs//123"
    }
    assert storage.read_jsonc('{"quoted":"/* comment */"}') == {"quoted": "/* comment */"}


def test_config_fails_closed_for_unknown_keys_and_unterminated_comments(tmp_path):
    path = tmp_path / "config.jsonc"
    path.write_text('{"version": 1, "secret": "SHOULD_NOT_BE_HERE"}', encoding="utf-8")
    with pytest.raises(ValidationError):
        storage.read_settings(path)
    with pytest.raises(ValueError):
        storage.read_jsonc('{"version": 1, /* unfinished}')
    with pytest.raises(ValueError):
        storage.read_jsonc(" " * (storage.MAX_CONFIG_BYTES + 1))


def test_atomic_setting_write_and_private_path(tmp_path):
    path = tmp_path / "conf" / "config.jsonc"
    settings = storage.CommunitySettings(
        ai=storage.AiOptions(preferred_provider="ollama")
    )
    storage.write_settings(settings, path)
    assert storage.read_settings(path).ai.preferred_provider == "ollama"
    assert "api_key" not in path.read_text(encoding="utf-8")


def test_sqlite_resume_roundtrip_revision_and_no_clobber(tmp_path):
    db = tmp_path / "data" / "community.sqlite3"
    assert storage.get_record("resume", db) == (None, 0)
    revision = storage.save_record(
        "resume", {"profile": profile(), "template": "classico"}, 0, db
    )
    assert revision == 1
    payload, version = storage.get_record("resume", db)
    assert payload["profile"]["contact"]["name"] == "Pessoa Exemplo"
    assert version == 1
    with pytest.raises(storage.RevisionConflict):
        storage.save_record("resume", {"profile": profile()}, 0, db)
    assert storage.save_record("resume", {"profile": profile()}, 1, db) == 2


@pytest.mark.parametrize("url", [
    "http://jobs.example.com/test",
    "https://localhost/private",
    "https://127.0.0.1/jobs",
    "https://private.local/jobs",
    "https://example.com/jobs?access_token=secret",
    "https://user:password@example.com/jobs",
])
def test_sqlite_rejects_untrusted_job_links(tmp_path, url):
    with pytest.raises(ValidationError):
        storage.save_record(
            "opportunities", [opportunity(url)], 0, tmp_path / "db.sqlite3"
        )


def test_opportunity_roundtrip_and_no_unknown_types(tmp_path):
    db = tmp_path / "community.sqlite3"
    assert storage.save_record("opportunities", [opportunity()], 0, db) == 1
    saved, revision = storage.get_record("opportunities", db)
    assert saved[0]["status"] == "saved"
    assert revision == 1
    with pytest.raises(ValueError):
        storage.get_record("credentials", db)
    with pytest.raises(ValueError):
        storage.save_record("opportunities", [opportunity(), opportunity()], 1, db)


@pytest.fixture()
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(
        storage, "user_paths",
        lambda: (tmp_path / "config.jsonc", tmp_path / "community.sqlite3"),
    )
    monkeypatch.setattr(main, "get_mode", lambda: "community")
    return TestClient(main.app, base_url="http://localhost", client=("127.0.0.1", 54123))


def test_community_endpoints_config_and_records(client):
    headers = {"origin": "http://localhost:3000"}
    response = client.get("/api/v1/community/settings")
    assert response.status_code == 200
    assert response.json()["agent"]["applications"] == "review_only"
    updated = client.put("/api/v1/community/settings", json={
        "version": 1, "ai": {"preferred_provider": "gemini"},
        "connectors": {"himalayas": {"enabled": False}},
    }, headers=headers)
    assert updated.status_code == 200, updated.text
    assert client.get("/api/v1/community/settings").json()["ai"]["preferred_provider"] == "gemini"
    payload = {"expected_revision": 0, "value": {"profile": profile()}}
    saved = client.put("/api/v1/community/data/resume", json=payload, headers=headers)
    assert saved.status_code == 200, saved.text
    response = client.get("/api/v1/community/data/resume")
    assert response.json()["revision"] == 1
    assert response.json()["value"]["profile"]["summary"] == profile()["summary"]
    conflict = client.put("/api/v1/community/data/resume", json=payload, headers=headers)
    assert conflict.status_code == 409
    assert client.get("/api/v1/community/data/other").status_code == 404


def test_community_endpoints_deny_other_origins_hosts_remote_and_cloud(client, monkeypatch):
    write = {"expected_revision": 0, "value": {"profile": profile()}}
    assert client.put("/api/v1/community/data/resume", json=write).status_code == 403
    assert client.put(
        "/api/v1/community/data/resume",
        json=write,
        headers={"origin": "https://untrusted.test"},
    ).status_code == 403
    assert client.get(
        "/api/v1/community/data/resume",
        headers={"origin": "https://untrusted.test"},
    ).status_code == 403
    assert client.get(
        "/api/v1/community/data/resume",
        headers={"sec-fetch-site": "cross-site"},
    ).status_code == 403
    assert TestClient(
        main.app, base_url="http://evil.example", client=("127.0.0.1", 54124)
    ).get("/api/v1/community/data/resume").status_code == 403
    assert TestClient(
        main.app, base_url="http://localhost", client=("192.168.1.42", 54125)
    ).get("/api/v1/community/data/resume").status_code == 403
    monkeypatch.setattr(main, "get_mode", lambda: "cloud")
    assert client.get("/api/v1/community/data/resume").status_code == 403

def test_disabled_connector_blocks_new_job_queries(client, monkeypatch):
    headers = {"origin": "http://localhost:3000"}
    set_response = client.put("/api/v1/community/settings", json={
        "version": 1,
        "connectors": {"himalayas": {"enabled": False}},
    }, headers=headers)
    assert set_response.status_code == 200
    monkeypatch.setattr(
        main, "search_jobs",
        lambda *args, **kwargs: pytest.fail("Disabled source must never be called"),
    )
    response = client.get("/api/v1/jobs/search", params={"q": "python"})
    assert response.status_code == 409


def test_tombstone_prevents_deleted_resume_from_reappearing(tmp_path):
    path = tmp_path / "community.sqlite3"
    assert storage.save_record("resume", {"profile": profile()}, 0, path) == 1
    assert storage.clear_record("resume", 1, path) == 2
    assert storage.get_record("resume", path) == (None, 2)
    with pytest.raises(storage.RevisionConflict):
        storage.clear_record("resume", 1, path)
    assert storage.save_record("resume", {"profile": profile()}, 2, path) == 3


def test_delete_data_endpoint_requires_local_origin_and_revision(client):
    headers = {"origin": "http://localhost:3000"}
    result = client.put("/api/v1/community/data/resume", headers=headers,
                        json={"expected_revision": 0, "value": {"profile": profile()}})
    assert result.status_code == 200
    preflight = client.options("/api/v1/community/data/resume", headers={
        **headers, "access-control-request-method": "DELETE",
    })
    assert preflight.status_code == 200
    assert "DELETE" in preflight.headers["access-control-allow-methods"]
    assert client.delete("/api/v1/community/data/resume?expected_revision=1").status_code == 403
    deleted = client.delete("/api/v1/community/data/resume?expected_revision=1", headers=headers)
    assert deleted.status_code == 200, deleted.text
    assert deleted.json()["revision"] == 2
    assert client.get("/api/v1/community/data/resume").json() == {"value": None, "revision": 2}
    assert client.delete("/api/v1/community/data/resume?expected_revision=1", headers=headers).status_code == 409

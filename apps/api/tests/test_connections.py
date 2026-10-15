"""Local provider connections: synthetic credentials only, no paid calls."""
from fastapi.testclient import TestClient

from alinha_api.main import app
from alinha_api.services import api_key_store as keys
from alinha_api.services.provider import AnthropicProvider, OpenAIKeyProvider


def local_client() -> TestClient:
    return TestClient(
        app,
        base_url="http://127.0.0.1:8000",
        client=("127.0.0.1", 42424),
    )


def test_key_validation_and_local_vault(monkeypatch):
    monkeypatch.setenv("ALINHA_DEPLOYMENT_MODE", "community")
    vault = {}
    monkeypatch.setattr(keys.keyring, "get_password", lambda service, account: vault.get(account))
    monkeypatch.setattr(keys.keyring, "set_password", lambda service, account, secret: vault.__setitem__(account, secret))
    monkeypatch.setattr(keys.keyring, "delete_password", lambda service, account: vault.pop(account))

    class FakeResponse:
        status_code = 200

        def raise_for_status(self):
            pass

    requested = []

    def fake_get(url, headers=None, **kwargs):
        if headers:
            requested.append((url, headers))
        return FakeResponse()

    monkeypatch.setattr(keys.httpx, "get", fake_get)

    response = local_client().post(
        "/api/v1/providers/keys/connect",
        json={"provider": "anthropic", "api_key": "synthetic-api-key-not-real"},
        headers={"Origin": "http://localhost:3000"},
    )
    assert response.status_code == 200
    assert response.json() == {"connected": True}
    assert keys.api_key("anthropic") == "synthetic-api-key-not-real"
    assert requested[0][0] == "https://api.anthropic.com/v1/models"
    assert requested[0][1]["x-api-key"] == "synthetic-api-key-not-real"

    status = local_client().get("/api/v1/providers/status")
    assert status.status_code == 200
    assert status.json()["anthropic"]["source"] == "vault"
    assert "synthetic-api-key-not-real" not in status.text

    deleted = local_client().post(
        "/api/v1/providers/keys/disconnect",
        json={"provider": "anthropic"},
        headers={"Origin": "http://localhost:3000"},
    )
    assert deleted.status_code == 200
    assert keys.api_key("anthropic") is None


def test_origin_and_remote_requests_rejected(monkeypatch):
    monkeypatch.setenv("ALINHA_DEPLOYMENT_MODE", "community")
    for client in [
        local_client(),
        TestClient(app),
    ]:
        reply = client.post(
            "/api/v1/providers/keys/connect",
            json={"provider": "gemini", "api_key": "synthetic-api-key-not-real"},
            headers={"Origin": "https://untrusted.example"},
        )
        assert reply.status_code == 403


def test_cloud_never_accepts_personal_keys(monkeypatch):
    monkeypatch.setenv("ALINHA_DEPLOYMENT_MODE", "cloud")
    reply = local_client().post(
        "/api/v1/providers/keys/connect",
        json={"provider": "gemini", "api_key": "synthetic-api-key-not-real"},
        headers={"Origin": "http://localhost:3000"},
    )
    assert reply.status_code == 403


def test_invalid_key_not_saved(monkeypatch):
    monkeypatch.setenv("ALINHA_DEPLOYMENT_MODE", "community")
    saved = []
    monkeypatch.setattr(keys.keyring, "set_password", lambda *args: saved.append(args))

    class FakeResponse:
        status_code = 401

    monkeypatch.setattr(keys.httpx, "get", lambda *args, **kwargs: FakeResponse())
    reply = local_client().post(
        "/api/v1/providers/keys/connect",
        json={"provider": "gemini", "api_key": "synthetic-api-key-not-real"},
        headers={"Origin": "http://localhost:3000"},
    )
    assert reply.status_code == 422
    assert saved == []
    assert "synthetic-api-key-not-real" not in reply.text


def test_anthropic_provider_response(monkeypatch):
    monkeypatch.setattr(
        "alinha_api.services.provider.saved_api_key",
        lambda provider: "synthetic-key" if provider == "anthropic" else None,
    )

    class FakeResponse:
        status_code = 200

        def raise_for_status(self):
            pass

        def json(self):
            return {"stop_reason": "end_turn", "content": [{
                "type": "text",
                "text": '{"job_title":"Pessoa Backend","requirements":[{"requirement":"Python",'
                        '"job_evidence":"Experiência com Python",'
                        '"status":"evidenciado",'
                        '"resume_evidence":"Projetos em Python",'
                        '"recommendation":"Detalhe projetos verdadeiros."}]}',
            }]}

    monkeypatch.setattr("alinha_api.services.provider.httpx.post", lambda *a, **kw: FakeResponse())
    draft = AnthropicProvider().analyze(
        "Projetos em Python na empresa.", "Experiência com Python na vaga."
    )
    assert draft.job_title == "Pessoa Backend"


def test_openai_api_provider_response(monkeypatch):
    monkeypatch.setattr("alinha_api.services.provider.saved_api_key", lambda provider: "synthetic-key")

    class FakeResponse:
        status_code = 200

        def raise_for_status(self):
            pass

        def json(self):
            return {
                "status": "completed",
                "output": [{"content": [{"type": "output_text", "text":
                    '{"job_title":"Pessoa Backend","requirements":[{"requirement":"Python",'
                    '"job_evidence":"Experiência com Python",'
                    '"status":"evidenciado",'
                    '"resume_evidence":"Projetos em Python",'
                    '"recommendation":"Detalhe projetos verdadeiros."}]}'}
                ]}],
            }

    monkeypatch.setattr("alinha_api.services.provider.httpx.post", lambda *a, **kw: FakeResponse())
    draft = OpenAIKeyProvider().analyze(
        "Projetos em Python na empresa.", "Experiência com Python na vaga."
    )
    assert draft.requirements[0].status == "evidenciado"

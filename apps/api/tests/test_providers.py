"""Provider selection, OAuth state/PKCE and streaming tests. All credentials synthetic."""
import json
from urllib.parse import parse_qs, urlparse

import pytest
from fastapi.testclient import TestClient

from alinha_api.main import app
from alinha_api.services import chatgpt_auth as auth_module
from alinha_api.services.chatgpt_auth import AuthError, LocalChatGPTAuth
from alinha_api.services.provider import ProviderError, parse_openai_events


def test_local_login_is_disabled_by_default(monkeypatch):
    monkeypatch.delenv("ALINHA_LOCAL_AUTH_ENABLED", raising=False)
    client = TestClient(app)
    response = client.post(
        "/api/v1/providers/chatgpt/login",
        headers={"origin": "http://localhost:3000"},
    )
    assert response.status_code == 403
    assert "authorization_url" not in response.text


def test_remote_origin_is_rejected_even_when_enabled(monkeypatch):
    monkeypatch.setenv("ALINHA_LOCAL_AUTH_ENABLED", "1")
    response = TestClient(app).post(
        "/api/v1/providers/chatgpt/login",
        headers={"origin": "https://untrusted.example"},
    )
    assert response.status_code == 403


def test_pkce_and_single_use_state(monkeypatch):
    monkeypatch.setenv("ALINHA_LOCAL_AUTH_ENABLED", "1")
    monkeypatch.setattr(auth_module, "_credential", lambda: None)
    monkeypatch.setattr(auth_module, "_host_id", lambda: "urn:uuid:11111111-1111-4111-8111-111111111111")
    client = LocalChatGPTAuth()
    url = client.begin()
    query = parse_qs(urlparse(url).query)
    assert urlparse(url).hostname == "auth.openai.com"
    assert query["client_id"] == ["dynamic_agent_client"]
    assert query["scope"] == [auth_module.SCOPES]
    assert query["resource"] == ["https://api.openai.com/v1"]
    assert query["redirect_uri"] == [auth_module.CALLBACK_URL]
    assert query["code_challenge_method"] == ["S256"]
    assert "agent_name_hint" in query
    assert "code_verifier" not in query

    with pytest.raises(AuthError, match="inválida"):
        client.finish(
            state="wrong-state", code="fake-code",
            issued_client_id="oaiapp_test", error=None
        )
    with pytest.raises(AuthError, match="inválida"):
        client.finish(
            state=query["state"][0], code="fake-code",
            issued_client_id="oaiapp_test", error=None
        )


def test_callback_checks_identity_scope_before_saving(monkeypatch):
    monkeypatch.setenv("ALINHA_LOCAL_AUTH_ENABLED", "1")
    monkeypatch.setattr(auth_module, "_credential", lambda: None)
    monkeypatch.setattr(auth_module, "_host_id", lambda: "urn:uuid:11111111-1111-4111-8111-111111111111")
    saved = []
    monkeypatch.setattr(auth_module, "_save_credential", lambda record: saved.append(record))
    monkeypatch.setattr(
        LocalChatGPTAuth,
        "_verify_id_token",
        staticmethod(lambda raw, client_id, nonce: {"sub": "synthetic-user", "email": "demo@example.test", "nonce": nonce}),
    )

    class FakeResponse:
        def raise_for_status(self):
            return None

        def json(self):
            return {
                "access_token": "fake-access", "refresh_token": "fake-refresh",
                "id_token": "fake-id", "expires_in": 3600, "scope": "openid email",
            }

    monkeypatch.setattr(auth_module.httpx, "post", lambda *args, **kwargs: FakeResponse())
    client = LocalChatGPTAuth()
    url = client.begin()
    state = parse_qs(urlparse(url).query)["state"][0]
    with pytest.raises(AuthError, match="permissão"):
        client.finish(state=state, code="synthetic", issued_client_id="oaiapp_demo", error=None)
    assert saved == []


def _events(*items):
    for event in items:
        yield "data: " + json.dumps(event)
        yield ""


def test_stream_requires_completed_event():
    text = '{"job_title":"Pessoa Dev","requirements":[]}'
    with pytest.raises(ProviderError, match="concluída"):
        parse_openai_events(_events({"type": "response.output_text.delta", "delta": text}))
    assert parse_openai_events(_events(
        {"type": "response.output_text.delta", "delta": text},
        {"type": "response.completed"},
    )) == text


def test_stream_rejects_usage_limit_even_with_text():
    with pytest.raises(ProviderError, match="limite"):
        parse_openai_events(_events(
            {"type": "response.output_text.delta", "delta": '{"partial":true}'},
            {"type": "response.failed", "response": {
                "error": {"code": "subscription_sharing_usage_limit_exceeded"}
            }},
        ))


def test_invalid_provider_rejected_at_contract():
    response = TestClient(app).post(
        "/api/v1/analyses/text",
        json={
            "resume_text": "Realizei manutenção de sistemas Python e APIs em projetos de automação.",
            "job_description": "Requisitos da vaga: conhecimento em Python, FastAPI e testes automatizados.",
            "provider": "unrecognized",
        },
    )
    assert response.status_code == 422


def test_authorization_success_stores_only_after_validation(monkeypatch):
    monkeypatch.setenv("ALINHA_LOCAL_AUTH_ENABLED", "1")
    monkeypatch.setattr(auth_module, "_credential", lambda: None)
    monkeypatch.setattr(auth_module, "_host_id", lambda: "urn:uuid:11111111-1111-4111-8111-111111111111")
    stored: list[dict] = []
    monkeypatch.setattr(auth_module, "_save_credential", stored.append)
    monkeypatch.setattr(
        LocalChatGPTAuth,
        "_verify_id_token",
        staticmethod(lambda raw, client_id, nonce: {"sub": "test-account", "email": "test@example.test"}),
    )

    class Reply:
        def raise_for_status(self): pass
        def json(self):
            return {
                "access_token": "fake-access",
                "refresh_token": "fake-refresh",
                "id_token": "fake-id-token",
                "expires_in": 3600,
                "scope": "openid email offline_access resource.invoke chatgpt.tokens.use.direct",
            }

    monkeypatch.setattr(auth_module.httpx, "post", lambda *args, **kwargs: Reply())
    auth = LocalChatGPTAuth()
    state = parse_qs(urlparse(auth.begin()).query)["state"][0]
    auth.finish(state=state, code="synthetic-code", issued_client_id="oaiapp_test", error=None)
    assert stored[0]["client_id"] == "oaiapp_test"
    assert stored[0]["subject"] == "test-account"
    assert stored[0]["refresh_token"] == "fake-refresh"


def test_refresh_rotates_both_tokens(monkeypatch):
    monkeypatch.setenv("ALINHA_LOCAL_AUTH_ENABLED", "1")
    record = {
        "client_id": "oaiapp_demo", "subject": "demo-subject",
        "scope": "openid chatgpt.tokens.use.direct", "expires_at": 0,
        "refresh_token": "old-refresh", "access_token": "old-access",
    }
    saved: list[dict] = []
    monkeypatch.setattr(auth_module, "_credential", lambda: record)
    monkeypatch.setattr(auth_module, "_save_credential", lambda data: saved.append(data.copy()))

    class Reply:
        def raise_for_status(self): pass
        def json(self):
            return {
                "access_token": "new-access", "refresh_token": "new-refresh",
                "expires_in": 3600, "scope": "openid chatgpt.tokens.use.direct",
            }

    monkeypatch.setattr(auth_module.httpx, "post", lambda *args, **kwargs: Reply())
    token = LocalChatGPTAuth().access_token()
    assert token == "new-access"
    assert saved[0]["refresh_token"] == "new-refresh"
    assert saved[0]["access_token"] == "new-access"


def test_chatgpt_inference_disabled_without_local_opt_in(monkeypatch):
    monkeypatch.delenv("ALINHA_LOCAL_AUTH_ENABLED", raising=False)
    response = TestClient(app).post(
        "/api/v1/analyses/text",
        json={
            "resume_text": "Trabalhei com Python e criei diversas APIs REST com FastAPI e testes.",
            "job_description": "Esta vaga exige experiência em Python e FastAPI com testes automatizados.",
            "provider": "chatgpt",
        },
    )
    assert response.status_code == 403


def test_reauthorization_never_embeds_id_token_in_browser_url(monkeypatch):
    monkeypatch.setenv("ALINHA_LOCAL_AUTH_ENABLED", "1")
    monkeypatch.setattr(
        auth_module, "_credential",
        lambda: {
            "client_id": "oaiapp_existing",
            "subject": "synthetic-user",
            "id_token": "private-synthetic-id-token",
            "email": "test@example.test",
        },
    )
    monkeypatch.setattr(auth_module, "_host_id", lambda: "urn:uuid:11111111-1111-4111-8111-111111111111")
    url = LocalChatGPTAuth().begin()
    params = parse_qs(urlparse(url).query)
    assert params["client_id"] == ["oaiapp_existing"]
    assert "private-synthetic-id-token" not in url
    assert "id_token_hint" not in params

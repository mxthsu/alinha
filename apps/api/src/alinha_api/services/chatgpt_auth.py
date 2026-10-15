"""Opt-in OSS ChatGPT OAuth for one locally hosted Alinha instance.

The browser never sees provider tokens. OAuth records live in the OS credential vault.
This module MUST NOT be enabled on a remotely hosted/shared web server.
"""
import base64
import hashlib
import json
import os
import secrets
import threading
import time
import uuid
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import urlencode

import httpx
import jwt
import keyring

ISSUER = "https://auth.openai.com"
AUTH_URL = f"{ISSUER}/api/accounts/authorize"
TOKEN_URL = f"{ISSUER}/api/accounts/oauth/token"
JWKS_URL = f"{ISSUER}/.well-known/jwks.json"
RESOURCE = "https://api.openai.com/v1"
REQUIRED_SCOPE = "chatgpt.tokens.use.direct"
KEYRING_SERVICE = "alinha.openai.oss"
KEYRING_ACCOUNT = "active"
CALLBACK_URL = "http://127.0.0.1:8000/auth/callback"
SCOPES = "openid profile email offline_access resource.invoke chatgpt.tokens.use.direct"


class AuthError(Exception):
    """A safely displayable authorization error. Never include tokens."""


@dataclass(frozen=True)
class PendingLogin:
    state: str
    nonce: str
    verifier: str
    client_id: str
    existing_subject: str | None
    expires_at: float


def enabled() -> bool:
    return os.getenv("ALINHA_LOCAL_AUTH_ENABLED") == "1"


def _challenge(verifier: str) -> str:
    return base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).rstrip(b"=").decode()


def _credential() -> dict | None:
    try:
        raw = keyring.get_password(KEYRING_SERVICE, KEYRING_ACCOUNT)
    except Exception as exc:
        raise AuthError("Armazenamento seguro de credenciais indisponível neste computador.") from exc
    return json.loads(raw) if raw else None


def _save_credential(record: dict) -> None:
    try:
        keyring.set_password(KEYRING_SERVICE, KEYRING_ACCOUNT, json.dumps(record))
    except Exception as exc:
        raise AuthError("Não foi possível armazenar as credenciais de forma segura.") from exc


def _delete_credential() -> None:
    try:
        if keyring.get_password(KEYRING_SERVICE, KEYRING_ACCOUNT) is not None:
            keyring.delete_password(KEYRING_SERVICE, KEYRING_ACCOUNT)
    except Exception as exc:
        raise AuthError("Não foi possível desconectar a conta local.") from exc


def _host_id() -> str:
    """Persist only a non-secret, stable machine-local UUID; never an account identifier."""
    file = Path.home() / ".config" / "alinha" / "host.json"
    if file.exists():
        value = json.loads(file.read_text(encoding="utf-8"))["host_id"]
        if not value.startswith("urn:uuid:"):
            raise AuthError("Identificador local de instalação inválido.")
        return value
    file.parent.mkdir(parents=True, exist_ok=True)
    value = "urn:uuid:" + str(uuid.uuid4())
    with file.open("x", encoding="utf-8") as handle:
        json.dump({"host_id": value}, handle)
    if os.name == "posix":
        file.chmod(0o600)
    return value


def _scope_set(value: str) -> set[str]:
    return set(value.split())


class LocalChatGPTAuth:
    """Single active ChatGPT account; never performs OAuth without a user click."""

    def __init__(self):
        self._pending: PendingLogin | None = None
        self._lock = threading.RLock()
        self._model_cache: tuple[float, list[dict]] | None = None

    def status(self) -> dict:
        if not enabled():
            return {"enabled": False, "connected": False, "email": None}
        record = _credential()
        return {
            "enabled": True,
            "connected": bool(record and REQUIRED_SCOPE in _scope_set(record["scope"])),
            "email": record.get("email") if record else None,
        }

    def begin(self) -> str:
        if not enabled():
            raise AuthError("Login ChatGPT disponível apenas na instalação local autorizada.")
        with self._lock:
            saved = _credential()
            verifier = secrets.token_urlsafe(64)
            state = secrets.token_urlsafe(32)
            nonce = secrets.token_urlsafe(32)
            client_id = saved["client_id"] if saved else "dynamic_agent_client"
            self._pending = PendingLogin(
                state=state,
                nonce=nonce,
                verifier=verifier,
                client_id=client_id,
                existing_subject=saved["subject"] if saved else None,
                expires_at=time.time() + 600,
            )
            params = {
                "client_id": client_id,
                "ext_agent_host_id": _host_id(),
                "response_type": "code",
                "redirect_uri": CALLBACK_URL,
                "scope": SCOPES,
                "resource": RESOURCE,
                "state": state,
                "nonce": nonce,
                "code_challenge_method": "S256",
                "code_challenge": _challenge(verifier),
            }
            if not saved:
                params["agent_name_hint"] = "Alinha"
            # Reauthorization uses the issued client ID. Avoid passing an ID token
            # through browser URLs, even though the optional hint is supported.
            # The URL may contain id_token_hint: never log it.
            return AUTH_URL + "?" + urlencode(params)

    @staticmethod
    def _verify_id_token(raw: str, client_id: str, nonce: str) -> dict:
        try:
            key = jwt.PyJWKClient(JWKS_URL, cache_jwk_set=True).get_signing_key_from_jwt(raw)
            claims = jwt.decode(
                raw,
                key.key,
                algorithms=["RS256"],
                audience=client_id,
                issuer=ISSUER,
                leeway=5,
                options={"require": ["sub", "exp", "iat"]},
            )
        except Exception as exc:
            raise AuthError("A identidade retornada pelo ChatGPT não pôde ser validada.") from exc
        if claims.get("nonce") != nonce or not claims.get("sub"):
            raise AuthError("Validação de identidade ou nonce não correspondeu.")
        return claims

    def finish(self, *, state: str | None, code: str | None,
               issued_client_id: str | None, error: str | None) -> None:
        if not enabled():
            raise AuthError("Autenticação local desabilitada.")
        with self._lock:
            pending = self._pending
            self._pending = None  # Consume state once, including on failure.
            if not state or not pending or not secrets.compare_digest(state, pending.state):
                raise AuthError("Autorização expirada ou inválida. Inicie uma nova conexão.")
            if time.time() >= pending.expires_at:
                raise AuthError("A autorização expirou. Tente novamente.")
            if error or not code:
                raise AuthError("Autorização não concluída pelo usuário.")
            if pending.client_id == "dynamic_agent_client":
                if not issued_client_id or not issued_client_id.startswith("oaiapp_"):
                    raise AuthError("O ChatGPT não retornou um identificador de cliente válido.")
                client_id = issued_client_id
            else:
                if issued_client_id and issued_client_id != pending.client_id:
                    raise AuthError("A conta retornada não corresponde à autorização iniciada.")
                client_id = pending.client_id
            try:
                response = httpx.post(
                    TOKEN_URL,
                    data={
                        "grant_type": "authorization_code",
                        "code": code,
                        "client_id": client_id,
                        "code_verifier": pending.verifier,
                        "redirect_uri": CALLBACK_URL,
                        "resource": RESOURCE,
                    },
                    timeout=15.0,
                )
                response.raise_for_status()
                tokens = response.json()
            except (httpx.HTTPError, ValueError) as exc:
                raise AuthError("Não foi possível concluir o login com o ChatGPT.") from exc
            required = {"id_token", "access_token", "refresh_token", "expires_in", "scope"}
            if not required.issubset(tokens):
                raise AuthError("O retorno de autenticação está incompleto.")
            claims = self._verify_id_token(tokens["id_token"], client_id, pending.nonce)
            if pending.existing_subject and pending.existing_subject != claims["sub"]:
                raise AuthError("A identidade conectada não corresponde à conta anterior.")
            if REQUIRED_SCOPE not in _scope_set(tokens["scope"]):
                raise AuthError("Esta conta não concedeu permissão para usar o plano ChatGPT.")
            record = {
                "subject": claims["sub"],
                "email": claims.get("email"),
                "client_id": client_id,
                "id_token": tokens["id_token"],
                "access_token": tokens["access_token"],
                "refresh_token": tokens["refresh_token"],
                "scope": tokens["scope"],
                "expires_at": time.time() + int(tokens["expires_in"]),
            }
            _save_credential(record)
            self._model_cache = None

    def access_token(self) -> str:
        if not enabled():
            raise AuthError("Uso de assinatura ChatGPT disponível apenas localmente.")
        with self._lock:
            record = _credential()
            if not record or REQUIRED_SCOPE not in _scope_set(record["scope"]):
                raise AuthError("Conecte uma conta ChatGPT autorizada antes de analisar.")
            if float(record["expires_at"]) - time.time() < 120:
                try:
                    response = httpx.post(
                        TOKEN_URL,
                        data={
                            "grant_type": "refresh_token",
                            "client_id": record["client_id"],
                            "refresh_token": record["refresh_token"],
                            "resource": RESOURCE,
                        },
                        timeout=15,
                    )
                    response.raise_for_status()
                    payload = response.json()
                    if not {"access_token", "refresh_token", "scope", "expires_in"}.issubset(payload):
                        raise ValueError("Campos obrigatórios ausentes")
                except (httpx.HTTPError, ValueError) as exc:
                    raise AuthError("A sessão ChatGPT expirou. Reconecte sua conta.") from exc
                if REQUIRED_SCOPE not in _scope_set(payload["scope"]):
                    raise AuthError("O plano ChatGPT deixou de autorizar esta conexão.")
                record.update({
                    "access_token": payload["access_token"],
                    "refresh_token": payload["refresh_token"],
                    "scope": payload["scope"],
                    "expires_at": time.time() + int(payload["expires_in"]),
                })
                # Do not replace the previously validated identity token with
                # an unverified value returned during refresh.
                _save_credential(record)  # Single-process lock serializes refresh.
            return record["access_token"]

    def models(self) -> list[dict]:
        with self._lock:
            if self._model_cache and self._model_cache[0] > time.time():
                return self._model_cache[1]
            token = self.access_token()
            try:
                response = httpx.get(
                    f"{RESOURCE}/models",
                    headers={"Authorization": f"Bearer {token}"},
                    timeout=15,
                )
                response.raise_for_status()
                payload = response.json()
                items = payload.get("models", [])
                models = [
                    {"id": item["slug"], "name": item.get("display_name", item["slug"])}
                    for item in items if item.get("visibility") == "list" and item.get("slug")
                ]
            except (httpx.HTTPError, ValueError, KeyError, TypeError) as exc:
                raise AuthError("Não foi possível consultar os modelos desta conta.") from exc
            self._model_cache = (time.time() + 300, models)
            return models

    def sign_out(self) -> bool:
        if not enabled():
            raise AuthError("Autenticação local desabilitada.")
        with self._lock:
            record = _credential()
            revoked = True
            if record:
                try:
                    response = httpx.post(
                        f"{ISSUER}/api/accounts/oauth/revoke",
                        data={
                            "token": record["refresh_token"],
                            "token_type_hint": "refresh_token",
                            "client_id": record["client_id"],
                        },
                        timeout=10,
                    )
                    revoked = response.status_code == 200
                except httpx.HTTPError:
                    revoked = False
            _delete_credential()
            self._model_cache = None
            self._pending = None
            return revoked


chatgpt_auth = LocalChatGPTAuth()

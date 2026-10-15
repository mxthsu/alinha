"""Secure, local-only API key connections for Community installations.

Secrets are held by the OS credential vault (Windows Credential Manager,
macOS Keychain, or desktop Secret Service) and never serialized to API replies.
"""
import os
from typing import Literal

import httpx
import keyring

from alinha_api.services.deployment import get_mode

KeyProvider = Literal["gemini", "anthropic", "openai_api"]
SERVICE = "alinha.community.api-key"
ENV_KEYS = {
    "gemini": "GEMINI_API_KEY",
    "anthropic": "ANTHROPIC_API_KEY",
    "openai_api": "OPENAI_API_KEY",
}


class ConnectionError(Exception):
    """Public error: never include credentials or raw upstream responses."""


def _ensure_community() -> None:
    if get_mode() != "community":
        raise ConnectionError("Conexões pessoais disponíveis apenas no Alinha Community.")


def _vault_get(provider: KeyProvider) -> str | None:
    _ensure_community()
    try:
        return keyring.get_password(SERVICE, provider)
    except Exception as exc:
        raise ConnectionError("O cofre de credenciais do sistema está indisponível.") from exc


def api_key(provider: KeyProvider) -> str | None:
    return _vault_get(provider) or os.getenv(ENV_KEYS[provider]) or None


def connection_source(provider: KeyProvider) -> str:
    if get_mode() != "community":
        return "none"
    if _vault_get(provider):
        return "vault"
    if os.getenv(ENV_KEYS[provider]):
        return "environment"
    return "none"


def verify_key(provider: KeyProvider, candidate: str) -> None:
    """Check key permission with each provider's official model-list endpoint.

    This validation doesn't produce a billable inference request.
    """
    if len(candidate) < 12 or len(candidate) > 4096 or candidate != candidate.strip():
        raise ConnectionError("A chave informada é inválida. Confira o valor e tente novamente.")
    if "\n" in candidate or "\r" in candidate:
        raise ConnectionError("A chave não pode conter quebras de linha.")

    checks = {
        "gemini": (
            "https://generativelanguage.googleapis.com/v1beta/models",
            {"x-goog-api-key": candidate},
        ),
        "anthropic": (
            "https://api.anthropic.com/v1/models",
            {"x-api-key": candidate, "anthropic-version": "2023-06-01"},
        ),
        "openai_api": (
            "https://api.openai.com/v1/models",
            {"Authorization": f"Bearer {candidate}"},
        ),
    }
    url, headers = checks[provider]
    try:
        response = httpx.get(url, headers=headers, timeout=12.0, follow_redirects=False)
        if response.status_code in (401, 403):
            raise ConnectionError("Chave não autorizada pelo provedor.")
        if response.status_code == 429:
            raise ConnectionError("Provedor limitou a verificação. Tente novamente mais tarde.")
        response.raise_for_status()
    except ConnectionError:
        raise
    except httpx.HTTPError as exc:
        raise ConnectionError("Não foi possível verificar a chave com o provedor.") from exc


def connect(provider: KeyProvider, candidate: str) -> None:
    _ensure_community()
    verify_key(provider, candidate)
    try:
        keyring.set_password(SERVICE, provider, candidate)
    except Exception as exc:
        raise ConnectionError("Não foi possível salvar a chave no cofre do sistema.") from exc


def disconnect(provider: KeyProvider) -> None:
    _ensure_community()
    if _vault_get(provider) is None:
        return
    try:
        keyring.delete_password(SERVICE, provider)
    except Exception as exc:
        raise ConnectionError("Não foi possível remover a chave do cofre.") from exc

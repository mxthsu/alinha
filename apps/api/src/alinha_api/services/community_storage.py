"""Per-user Community configuration and SQLite storage; independent of Cloud.

The local service is only reachable from loopback and never stores provider secrets.
"""
from __future__ import annotations

import ipaddress
import json
import os
import sqlite3
import sys
import tempfile
from datetime import datetime
from pathlib import Path
from typing import Literal
from urllib.parse import parse_qsl, urlsplit

from pydantic import BaseModel, ConfigDict, Field, field_validator

from alinha_api.resume_schema import ResumeProfile, TemplateName

MAX_CONFIG_BYTES = 32_768
MAX_RECORD_BYTES = 350_000
MAX_OPPORTUNITIES = 200


def user_paths() -> tuple[Path, Path]:
    """Outside the checkout, consistent with native app-data conventions."""
    if sys.platform == "win32":
        roaming = Path(os.environ.get("APPDATA") or Path.home() / "AppData" / "Roaming")
        local = Path(os.environ.get("LOCALAPPDATA") or Path.home() / "AppData" / "Local")
        return roaming / "Alinha" / "config.jsonc", local / "Alinha" / "data" / "community.sqlite3"
    config = Path(os.environ.get("XDG_CONFIG_HOME") or Path.home() / ".config")
    data = Path(os.environ.get("XDG_DATA_HOME") or Path.home() / ".local" / "share")
    return config / "alinha" / "config.jsonc", data / "alinha" / "community.sqlite3"


class _StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class AgentOptions(_StrictModel):
    search: Literal["assisted"] = "assisted"
    applications: Literal["review_only"] = "review_only"


class ConnectorSettings(_StrictModel):
    enabled: bool = True


class Connectors(_StrictModel):
    himalayas: ConnectorSettings = Field(default_factory=ConnectorSettings)
    gupy: ConnectorSettings = Field(default_factory=lambda: ConnectorSettings(enabled=False))
    lever: ConnectorSettings = Field(default_factory=ConnectorSettings)


class AiOptions(_StrictModel):
    preferred_provider: Literal["gemini", "anthropic", "openai_api", "ollama", "chatgpt"] | None = None


class CommunitySettings(_StrictModel):
    version: Literal[1] = 1
    ai: AiOptions = Field(default_factory=AiOptions)
    agent: AgentOptions = Field(default_factory=AgentOptions)
    connectors: Connectors = Field(default_factory=Connectors)


def _strip_jsonc_comments(raw: str) -> str:
    result: list[str] = []
    in_string = False
    escaped = False
    i = 0
    while i < len(raw):
        c = raw[i]
        following = raw[i + 1] if i + 1 < len(raw) else ""
        if in_string:
            result.append(c)
            if escaped:
                escaped = False
            elif c == "\\":
                escaped = True
            elif c == '"':
                in_string = False
            i += 1
            continue
        if c == '"':
            in_string = True
            result.append(c)
            i += 1
            continue
        if c == "/" and following == "/":
            i += 2
            while i < len(raw) and raw[i] not in "\r\n":
                i += 1
            continue
        if c == "/" and following == "*":
            end = raw.find("*/", i + 2)
            if end == -1:
                raise ValueError("Comentário JSONC não finalizado.")
            result.append(" ")
            i = end + 2
            continue
        result.append(c)
        i += 1
    if in_string:
        raise ValueError("Texto JSONC não finalizado.")
    return "".join(result)


def read_jsonc(text: str) -> object:
    if len(text.encode("utf-8")) > MAX_CONFIG_BYTES:
        raise ValueError("Configuração excede o tamanho permitido.")
    without_comments = _strip_jsonc_comments(text)
    output: list[str] = []
    in_string = False
    escaped = False
    for i, c in enumerate(without_comments):
        if in_string:
            output.append(c)
            if escaped:
                escaped = False
            elif c == "\\":
                escaped = True
            elif c == '"':
                in_string = False
            continue
        if c == '"':
            in_string = True
        if c == ",":
            remaining = without_comments[i + 1 :].lstrip()
            if remaining.startswith(("}", "]")):
                continue
        output.append(c)
    return json.loads("".join(output))


def read_settings(path: Path | None = None) -> CommunitySettings:
    path = path or user_paths()[0]
    if not path.exists():
        return CommunitySettings()
    if path.stat().st_size > MAX_CONFIG_BYTES:
        raise ValueError("Configuração excede o tamanho permitido.")
    content = read_jsonc(path.read_text(encoding="utf-8"))
    return CommunitySettings.model_validate(content)


def write_settings(settings: CommunitySettings, path: Path | None = None) -> None:
    path = path or user_paths()[0]
    data = (json.dumps(settings.model_dump(mode="json"), indent=2, ensure_ascii=False) + "\n").encode("utf-8")
    _atomic_write(path, data)


def _private_directory(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True, mode=0o700)
    if os.name != "nt":
        path.chmod(0o700)


def _atomic_write(path: Path, data: bytes) -> None:
    _private_directory(path.parent)
    temp_path: str | None = None
    try:
        with tempfile.NamedTemporaryFile(dir=path.parent, prefix=".alinha-", delete=False) as file:
            temp_path = file.name
            os.chmod(temp_path, 0o600)
            file.write(data)
            file.flush()
            os.fsync(file.fileno())
        os.replace(temp_path, path)
    finally:
        if temp_path and Path(temp_path).exists():
            Path(temp_path).unlink()


class SavedResume(_StrictModel):
    profile: ResumeProfile
    template: TemplateName = "classico"


class TrackedOpportunity(_StrictModel):
    id: str = Field(min_length=2, max_length=90)
    title: str = Field(min_length=2, max_length=180)
    company: str = Field(min_length=2, max_length=180)
    url: str = Field(max_length=1600, pattern=r"^https://")
    source: str = Field(min_length=2, max_length=100)
    sourceId: str | None = Field(default=None, max_length=200)
    status: Literal["saved", "preparing", "applied", "interview", "offer", "closed"]
    addedAt: str = Field(min_length=10, max_length=40)
    updatedAt: str = Field(min_length=10, max_length=40)

    @field_validator("url")
    @classmethod
    def public_https_url(cls, value: str) -> str:
        try:
            parsed = urlsplit(value)
            host = (parsed.hostname or "").lower()
            if parsed.scheme != "https" or parsed.username or parsed.password or parsed.port:
                raise ValueError("Link não permitido.")
            if not host or "." not in host or host.endswith(
                (".local", ".localhost", ".internal", ".test", ".invalid")
            ) or host == "localhost":
                raise ValueError("Host não permitido.")
            try:
                ipaddress.ip_address(host)
            except ValueError:
                pass
            else:
                raise ValueError("IP direto não permitido.")
            secret_keys = {
                "token", "access_token", "auth", "authorization", "secret",
                "password", "session", "sessionid", "api_key", "apikey",
                "jwt", "signature", "sig", "code",
            }
            if any(key.lower() in secret_keys for key, _ in parse_qsl(parsed.query)):
                raise ValueError("Link com credenciais não permitido.")
        except (TypeError, ValueError) as exc:
            raise ValueError("URL da vaga inválida.") from exc
        return value

    @field_validator("addedAt", "updatedAt")
    @classmethod
    def valid_date(cls, value: str) -> str:
        try:
            datetime.fromisoformat(value)
        except ValueError as exc:
            raise ValueError("Data inválida.") from exc
        return value


def validate_record(kind: str, value: object) -> object:
    if kind == "resume":
        return SavedResume.model_validate(value).model_dump(mode="json")
    if kind == "opportunities":
        if not isinstance(value, list) or len(value) > MAX_OPPORTUNITIES:
            raise ValueError("Quantidade de oportunidades inválida.")
        parsed = [TrackedOpportunity.model_validate(v) for v in value]
        ids = [v.id for v in parsed]
        if len(ids) != len(set(ids)):
            raise ValueError("Oportunidades duplicadas.")
        return [v.model_dump(mode="json") for v in parsed]
    raise ValueError("Tipo de dado não permitido.")


def _connect(path: Path) -> sqlite3.Connection:
    _private_directory(path.parent)
    connection = sqlite3.connect(path, timeout=8.0)
    connection.execute("PRAGMA busy_timeout=8000")
    connection.execute("PRAGMA journal_mode=WAL")
    connection.execute(
        "CREATE TABLE IF NOT EXISTS records ("
        "kind TEXT PRIMARY KEY, payload TEXT NOT NULL, revision INTEGER NOT NULL)"
    )
    if os.name != "nt":
        path.chmod(0o600)
    return connection


def get_record(kind: str, path: Path | None = None) -> tuple[object | None, int]:
    if kind not in ("resume", "opportunities"):
        raise ValueError("Tipo de dado não permitido.")
    path = path or user_paths()[1]
    with _connect(path) as db:
        row = db.execute("SELECT payload, revision FROM records WHERE kind = ?", (kind,)).fetchone()
    return (json.loads(row[0]), row[1]) if row else (None, 0)


class RevisionConflict(Exception):
    """A different tab has saved a newer version."""


def save_record(kind: str, value: object, expected_revision: int, path: Path | None = None) -> int:
    if not 0 <= expected_revision <= 2**31:
        raise ValueError("Revisão inválida.")
    normalized = validate_record(kind, value)
    payload = json.dumps(normalized, ensure_ascii=False, separators=(",", ":"))
    if len(payload.encode("utf-8")) > MAX_RECORD_BYTES:
        raise ValueError("Registro excede o tamanho permitido.")
    path = path or user_paths()[1]
    with _connect(path) as db:
        db.execute("BEGIN IMMEDIATE")
        row = db.execute("SELECT revision FROM records WHERE kind=?", (kind,)).fetchone()
        actual = row[0] if row else 0
        if actual != expected_revision:
            raise RevisionConflict("Dados atualizados em outra aba; recarregue antes de salvar.")
        next_rev = actual + 1
        db.execute(
            "INSERT INTO records (kind, payload, revision) VALUES (?, ?, ?) "
            "ON CONFLICT(kind) DO UPDATE SET payload=excluded.payload, revision=excluded.revision",
            (kind, payload, next_rev),
        )
    return next_rev

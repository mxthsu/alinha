"""Shell-neutral desktop API contract: strict session gate and ephemeral port.

All test requests use fake secrets, fake origins and isolated directories.
"""
from __future__ import annotations

import json
import os
import queue
import secrets
import subprocess
import sys
import threading
import urllib.error
import urllib.request
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from alinha_api.desktop_entry import validate_desktop_environment
from alinha_api.main import app

FAKE_SECRET = "test-desktop-secret-" + "a" * 48


def test_desktop_startup_requires_strong_secret(monkeypatch):
    monkeypatch.delenv("ALINHA_DESKTOP_SESSION_TOKEN", raising=False)
    with pytest.raises(RuntimeError, match="session"):
        validate_desktop_environment()
    monkeypatch.setenv("ALINHA_DESKTOP_SESSION_TOKEN", "short")
    with pytest.raises(RuntimeError, match="session"):
        validate_desktop_environment()
    monkeypatch.setenv("ALINHA_DESKTOP_SESSION_TOKEN", FAKE_SECRET)
    monkeypatch.setenv("ALINHA_DEPLOYMENT_MODE", "cloud")
    with pytest.raises(RuntimeError, match="Community"):
        validate_desktop_environment()
    monkeypatch.setenv("ALINHA_DEPLOYMENT_MODE", "community")
    validate_desktop_environment()


def test_desktop_http_token_gate(monkeypatch):
    monkeypatch.setenv("ALINHA_DESKTOP_SESSION_TOKEN", FAKE_SECRET)
    with TestClient(app, client=("127.0.0.1", 31001)) as client:
        assert client.get("/health").status_code == 403
        assert client.get("/health", headers={
            "x-alinha-desktop-session": "wrong-secret"
        }).status_code == 403
        valid = client.get("/health", headers={
            "x-alinha-desktop-session": FAKE_SECRET
        })
        assert valid.status_code == 200
        assert valid.json() == {"status": "ok"}
        assert FAKE_SECRET not in valid.text
        assert client.get("/api/v1/community/settings").status_code == 403
    with TestClient(app, client=("192.0.2.99", 31002)) as client:
        assert client.get("/health", headers={
            "x-alinha-desktop-session": FAKE_SECRET
        }).status_code == 403
    monkeypatch.delenv("ALINHA_DESKTOP_SESSION_TOKEN")
    with TestClient(app, client=("127.0.0.1", 31003)) as client:
        assert client.get("/health").json() == {"status": "ok"}


def test_ephemeral_desktop_api_subprocess(tmp_path: Path):
    """Real startup on an ephemeral loopback port; never reads personal profile."""
    secret = secrets.token_urlsafe(48)
    env = os.environ.copy()
    env.update({
        "ALINHA_DESKTOP_SESSION_TOKEN": secret,
        "ALINHA_DEPLOYMENT_MODE": "community",
        "APPDATA": str(tmp_path / "roaming"),
        "LOCALAPPDATA": str(tmp_path / "local"),
        "XDG_CONFIG_HOME": str(tmp_path / "config"),
        "XDG_DATA_HOME": str(tmp_path / "data"),
        "PYTHONPATH": str(Path(__file__).resolve().parents[1] / "src"),
    })
    received: queue.Queue[str] = queue.Queue(maxsize=1)
    proc = subprocess.Popen(
        [sys.executable, "-m", "alinha_api.desktop_entry"],
        cwd=Path(__file__).resolve().parents[1],
        env=env, stdin=subprocess.DEVNULL,
        stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True,
    )
    def read_ready() -> None:
        if proc.stdout:
            received.put(proc.stdout.readline())
    threading.Thread(target=read_ready, daemon=True).start()
    try:
        ready = json.loads(received.get(timeout=20))
        assert ready["event"] == "ready"
        assert isinstance(ready["port"], int)
        assert ready["port"] > 0
        url = f'http://127.0.0.1:{ready["port"]}/health'
        with pytest.raises(urllib.error.HTTPError) as missing:
            urllib.request.urlopen(url, timeout=3)
        assert missing.value.code == 403
        request = urllib.request.Request(url, headers={
            "x-alinha-desktop-session": secret
        })
        with urllib.request.urlopen(request, timeout=3) as response:
            assert json.load(response) == {"status": "ok"}
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=6)
        except subprocess.TimeoutExpired:
            proc.kill()
            proc.wait(timeout=3)

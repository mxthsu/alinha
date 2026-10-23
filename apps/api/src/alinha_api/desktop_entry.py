"""Entrypoint for an OS-shell-independent, loopback-only Python Desktop API.

Desktop launchers (Go/Wails, Rust/Tauri or others) provide a one-time secret in
the child process environment and use an authenticated local HTTP bridge.
No Python functionality is reimplemented in the native host.
"""
from __future__ import annotations

import asyncio
import json
import os
import socket

import uvicorn


def validate_desktop_environment() -> None:
    token = os.environ.get("ALINHA_DESKTOP_SESSION_TOKEN", "")
    if len(token) < 48 or len(token) > 256:
        raise RuntimeError("Invalid Desktop session secret")
    if os.environ.get("ALINHA_DEPLOYMENT_MODE", "community") != "community":
        raise RuntimeError("Desktop API requires local Community mode")


async def serve() -> None:
    validate_desktop_environment()
    # Reserve one ephemeral port without a bind/serve race. No public interface.
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as listener:
        listener.bind(("127.0.0.1", 0))
        listener.listen(2048)
        listener.set_inheritable(False)
        config = uvicorn.Config(
            "alinha_api.main:app", host="127.0.0.1", port=0,
            log_level="warning", access_log=False, lifespan="on",
        )
        server = uvicorn.Server(config)
        task = asyncio.create_task(server.serve(sockets=[listener]))
        # Announce readiness only once ASGI startup completed, not merely bind().
        for _ in range(1500):
            if server.started:
                break
            if task.done():
                await task
                raise RuntimeError("Desktop API failed before startup")
            await asyncio.sleep(0.01)
        if not server.started:
            server.should_exit = True
            await task
            raise TimeoutError("Desktop API startup exceeded 15 seconds")
        # The host must probe /health with the session header before use.
        print(json.dumps({"event": "ready", "port": listener.getsockname()[1]}), flush=True)
        await task


def main() -> None:
    asyncio.run(serve())


if __name__ == "__main__":
    main()

"""Start the Alinha Community development environment on a single computer.

Prerequisites: Python 3.11+, uv, Node.js and npm.
Run: python scripts/dev.py
"""
from __future__ import annotations

import argparse
import os
from pathlib import Path
import shutil
import signal
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[1]
API = ROOT / "apps" / "api"
WEB = ROOT / "apps" / "web"


def preflight() -> tuple[str, str]:
    if sys.version_info < (3, 11):
        raise RuntimeError("Python 3.11 ou superior é necessário.")
    uv = shutil.which("uv")
    npm = shutil.which("npm")
    if not uv or not npm:
        missing = ", ".join(name for name, value in (("uv", uv), ("npm", npm)) if not value)
        raise RuntimeError(f"Dependências não encontradas no PATH: {missing}. Consulte docs/getting-started.md.")
    for file in (API / "pyproject.toml", API / "uv.lock", WEB / "package.json", WEB / "package-lock.json"):
        if not file.is_file():
            raise RuntimeError(f"Arquivo do projeto não encontrado: {file.relative_to(ROOT)}")
    return uv, npm


def ensure_dependencies(uv: str, npm: str) -> None:
    print("[Alinha] Preparando dependências da API...", flush=True)
    subprocess.run([uv, "sync", "--dev", "--frozen"], cwd=API, check=True)
    if not (WEB / "node_modules" / ".package-lock.json").is_file():
        print("[Alinha] Instalando dependências da interface (primeira execução)...", flush=True)
        subprocess.run([npm, "ci"], cwd=WEB, check=True)


def stop_process(proc: subprocess.Popen[bytes]) -> None:
    if proc.poll() is not None:
        return
    if os.name == "nt":
        # npm.cmd / uv may spawn grandchildren on Windows. Stop the process tree.
        subprocess.run(
            ["taskkill", "/PID", str(proc.pid), "/T", "/F"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            check=False,
        )
    else:
        try:
            os.killpg(proc.pid, signal.SIGTERM)
        except ProcessLookupError:
            pass
    try:
        proc.wait(timeout=5)
    except subprocess.TimeoutExpired:
        proc.kill()
        proc.wait(timeout=5)


def main() -> int:
    parser = argparse.ArgumentParser(description="Execute o Alinha Community localmente.")
    parser.add_argument("--check", action="store_true", help="Verifica os pré-requisitos sem iniciar servidores.")
    parser.add_argument("--reinstall", action="store_true", help="Reinstala as dependências web usando npm ci.")
    args = parser.parse_args()

    try:
        uv, npm = preflight()
        if args.check:
            print("[Alinha] Ambiente compatível: Python, uv, npm e arquivos do projeto presentes.")
            return 0

        if args.reinstall:
            print("[Alinha] Reinstalando dependências da interface...", flush=True)
            subprocess.run([npm, "ci"], cwd=WEB, check=True)
        ensure_dependencies(uv, npm)

        api_cmd = [
            uv, "run", "uvicorn", "alinha_api.main:app", "--app-dir", "src",
            "--host", "127.0.0.1", "--port", "8000", "--no-access-log",
        ]
        if (API / ".env").is_file():
            api_cmd.extend(["--env-file", ".env"])
        web_cmd = [npm, "run", "dev", "--", "--hostname", "127.0.0.1", "--port", "3000"]

        print("[Alinha] Iniciando API e interface. Acesse http://localhost:3000", flush=True)
        print("[Alinha] Pressione Ctrl+C para encerrar ambos os processos.", flush=True)
        options = {"start_new_session": True} if os.name != "nt" else {}
        api = subprocess.Popen(api_cmd, cwd=API, **options)
        try:
            web = subprocess.Popen(web_cmd, cwd=WEB, **options)
        except Exception:
            stop_process(api)
            raise
        try:
            while True:
                if api.poll() is not None:
                    print("[Alinha] A API foi encerrada.", flush=True)
                    return api.returncode or 1
                if web.poll() is not None:
                    print("[Alinha] O site foi encerrado.", flush=True)
                    return web.returncode or 1
                time.sleep(0.6)
        except KeyboardInterrupt:
            print("\n[Alinha] Encerrando ambiente local...", flush=True)
            return 0
        finally:
            stop_process(web)
            stop_process(api)
    except (RuntimeError, subprocess.CalledProcessError, OSError) as exc:
        print(f"[Alinha] Erro: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())

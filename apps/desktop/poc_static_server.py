"""Development-only server for the exported desktop frontend.

Production Tauri/Wails loads embedded assets and should not expose a local
static HTTP server. This probe tests behavior with zero Next.js runtime.
"""
from __future__ import annotations

import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit


class ExportHandler(SimpleHTTPRequestHandler):
    def do_GET(self) -> None:
        path = unquote(urlsplit(self.path).path)
        if path != "/" and not Path(path).suffix and not path.endswith("/"):
            directory_index = Path(self.directory) / path.lstrip("/") / "index.html"
            self.path = path + ("/" if directory_index.is_file() else ".html")
        else:
            self.path = path
        super().do_GET()

    def list_directory(self, path: str):
        self.send_error(404, "Directory listing disabled")
        return None

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dist", type=Path, required=True)
    parser.add_argument("--port", type=int, default=3000)
    args = parser.parse_args()
    root = args.dist.resolve()
    if not ((root / "agente.html").is_file() or (root / "agente" / "index.html").is_file()):
        parser.error("Expected an exported frontend including the /agente route")
    server = ThreadingHTTPServer(("127.0.0.1", args.port), partial(ExportHandler, directory=str(root)))
    print(f"TEST ONLY: static assets at http://127.0.0.1:{args.port}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()

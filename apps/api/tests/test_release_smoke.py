"""Run the isolated Community release smoke through the existing pytest CI job."""
from __future__ import annotations

import runpy
from pathlib import Path


def test_community_clean_state_smoke() -> None:
    root = Path(__file__).resolve().parents[3]
    path = root / "scripts" / "smoke_community.py"
    smoke = runpy.run_path(str(path), run_name="alinha_release_smoke")["smoke"]
    smoke()

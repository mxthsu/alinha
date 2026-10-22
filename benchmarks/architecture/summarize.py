"""Print measured medians; never interpret failure as zero milliseconds."""
from pathlib import Path
import os
import re
import statistics

files = [
    ("TypeScript / Playwright", "benchmark-typescript.log", "TS_STATUS"),
    ("Go / chromedp", "benchmark-go.log", "GO_STATUS"),
    ("Rust / agent-browser", "benchmark-rust.log", "RUST_STATUS"),
]
lines = [
    "## Synthetic browser comparison",
    "",
    "Run environment: ubuntu-latest, same downloaded Chromium, headless, five sequential forms.",
    "Timings include each engine's invocation path and are **not** isolated runtime-language benchmarks.",
    "Tests use fake résumé data. No external ATS requests, AI calls, or real submissions.",
    "",
    "| Candidate | CI status | Successful runs | Median elapsed (ms) |",
    "|---|---|---:|---:|",
]
for name,filename,status_var in files:
    path=Path(filename)
    content=path.read_text(encoding="utf-8") if path.exists() else ""
    durations=[float(x) for x in re.findall(r"latency_ms=([0-9.]+) valid=true",content)]
    status=os.getenv(status_var,"not-run")
    median=f"{statistics.median(durations):.1f}" if durations and status=="success" else "—"
    lines.append(f"| {name} | {status} | {len(durations)} | {median} |")
lines.extend([
    "",
    "This is a preliminary smoke/performance comparison, not evidence of ATS compatibility.",
    "A final stack decision also requires Windows/macOS packaging, robustness, auth flows, resource usage, and model-adapter tests.",
])
report="\n".join(lines)+"\n"
print(report)
if os.getenv("GITHUB_STEP_SUMMARY"):
    with open(os.environ["GITHUB_STEP_SUMMARY"],"a",encoding="utf-8") as f:
        f.write(report)

#!/usr/bin/env bash
# Uses the native Rust agent-browser binary. Reuses its daemon/session.
set -euo pipefail
: "${BENCH_URL:?}"
: "${BENCH_CV:?}"
: "${CHROME_PATH:?}"
[[ "$BENCH_URL" == http://127.0.0.1:* ]] || { echo "Only loopback fixtures allowed"; exit 1; }
export AGENT_BROWSER_EXECUTABLE_PATH="$CHROME_PATH"
runs="${BENCH_RUNS:-5}"
session="alinha-fixture-$$"
ab(){ agent-browser --session "$session" "$@"; }
trap 'ab close >/dev/null 2>&1 || true' EXIT
for ((i=1;i<=runs;i++)); do
  start="$(date +%s%3N)"
  ab open "$BENCH_URL" >/dev/null
  ab fill '#fullname' 'Pessoa Fictícia' >/dev/null
  ab fill '#email' 'pessoa@example.test' >/dev/null
  ab fill '#phone' '000000000' >/dev/null
  ab select '#workmode' remote >/dev/null
  ab select '#timezone' brazil >/dev/null
  ab click '#next' >/dev/null
  ab upload '#cv' "$BENCH_CV" >/dev/null
  ab check '#consent' >/dev/null
  ab click '#submit' >/dev/null
  visible="$(ab is visible '#confirmation')"
  [[ "$visible" == *true* ]] || { echo "Formulário não confirmou: $visible" >&2; exit 1; }
  elapsed=$(( $(date +%s%3N) - start ))
  echo "rust_agent_browser run=$i latency_ms=$elapsed valid=true ai_calls=0"
done

#!/bin/sh
set -eu
cd "$(dirname "$0")"
export SAFEWORD_EVAL_REVISION="${SAFEWORD_EVAL_REVISION:-$(git rev-parse HEAD)}"
export SAFEWORD_EVAL_ATTEMPTS="${SAFEWORD_EVAL_ATTEMPTS:-5}"
export SAFEWORD_EVAL_HUMAN_RELAY="${SAFEWORD_EVAL_HUMAN_RELAY:-1}"
mkdir -p jobs
SAFEWORD_EVAL_RELAY_DIR=${SAFEWORD_EVAL_RELAY_DIR:-$(mktemp -d "$PWD/jobs/suite-relay.XXXXXXXX")}
export SAFEWORD_EVAL_RELAY_DIR
mkdir -p "$SAFEWORD_EVAL_RELAY_DIR"
export SAFEWORD_EVAL_REPORT_INDEX="$SAFEWORD_EVAL_RELAY_DIR/job-reports.txt"
if ! (
  set -C
  : > "$SAFEWORD_EVAL_REPORT_INDEX"
) 2> /dev/null; then
  printf 'Use a fresh suite relay directory. Results already exist at %s\n' "$SAFEWORD_EVAL_REPORT_INDEX" >&2
  exit 2
fi
if [ -z "${SAFEWORD_EVAL_COMPARISON:-}" ]; then
  export SAFEWORD_EVAL_COMPARISON="$SAFEWORD_EVAL_RELAY_DIR/comparison.json"
  python3 resolve_comparison.py "$SAFEWORD_EVAL_COMPARISON"
fi
failures="$SAFEWORD_EVAL_RELAY_DIR/failed-tasks.txt"
: > "$failures"
printf 'Relay directory: %s\n' "$SAFEWORD_EVAL_RELAY_DIR"

if [ "$#" -eq 0 ]; then
  set -- simple-fix extractor-discovery extractor-trace-empty arcade-outlook www-home
fi
for task; do
  ready=0
  concurrency=${SAFEWORD_EVAL_CONCURRENCY:-3}
  case "$task" in
    simple-fix) ready=1 ;;
    www-home) concurrency=1 ;;
  esac
  SAFEWORD_EVAL_TASK="$task" SAFEWORD_EVAL_READY_DEPS="$ready" \
    SAFEWORD_EVAL_CONCURRENCY="$concurrency" ./compare.sh baseline checkout \
    || printf '%s\n' "$task" >> "$failures"
done

uv run --locked python - "$SAFEWORD_EVAL_REPORT_INDEX" << 'PY'
import json
import sys
from pathlib import Path

index = Path(sys.argv[1])
reports = {
    report.parent.name: json.loads(report.read_text())
    for report in map(Path, index.read_text().splitlines())
}
output = index.with_name("suite-report.json")
output.write_text(json.dumps(reports, indent=2) + "\n")
print(f"Suite report: {output}")
PY
if [ -s "$failures" ]; then
  printf 'Some jobs failed to run. See %s\n' "$failures" >&2
  exit 1
fi

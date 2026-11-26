#!/bin/sh
set -eu
cd "$(dirname "$0")"
export LANGSMITH_TRACING=false
uv run --locked python -m unittest discover -v
uv run --locked python -m unittest discover -v -s intake -p 'test_*.py'
node --test ./test-*.cjs

# Exercise the actual Docker verifier with both an untouched and a solved task.
mkdir -p jobs
output=$(mktemp -d "$PWD/jobs/check.XXXXXXXX")
for agent in nop oracle; do
  uv run --locked harbor run --path task --env docker --agent "$agent" --jobs-dir "$output" --job-name "$agent"
done
uv run --locked python - "$output" << 'PY'
import json
import sys
from pathlib import Path

for agent, expected in (("nop", 0), ("oracle", 1)):
    trial, = (Path(sys.argv[1]) / agent).glob("*/result.json")
    result = json.loads(trial.read_text())
    if result["exception_info"] or result["verifier_result"]["rewards"]["reward"] != expected:
        raise SystemExit(f"{agent}: expected reward {expected} with no runner error; see {trial}")
    print(f"{agent}: verified reward {expected}")
PY

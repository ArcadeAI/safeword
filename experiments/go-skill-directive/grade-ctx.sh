#!/usr/bin/env bash
# Grade a candidate Go file for the context-in-struct anti-pattern
# (samber golang-context rule #3: "NEVER store context in a struct").
# Deterministic AST check, no LLM judge. Catches embedded AND named
# context.Context struct fields.
# Usage: ./grade-ctx.sh <candidate.go>  -> prints PASS/FAIL, exit 0/1.
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
CAND="${1:?usage: grade-ctx.sh <path/to/candidate.go>}"
BIN="$HERE/checker/checkbin"
if [ ! -x "$BIN" ]; then
  (cd "$HERE/checker" && go build -o checkbin .)
fi
"$BIN" "$CAND"

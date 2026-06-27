#!/usr/bin/env bash
# Grade a candidate counter.go against the concurrency trap with `go test -race`.
# Deterministic, no LLM judge. Usage: ./grade.sh <counter.go>  → prints PASS/FAIL, exit 0/1.
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
CAND="${1:?usage: grade.sh <path/to/counter.go>}"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
(cd "$TMP" && go mod init counter > /dev/null 2>&1)
cp "$CAND" "$TMP/counter.go"
cp "$HERE/trap/counter_test.go.tmpl" "$TMP/counter_test.go"
# -timeout bounds a deadlocking candidate (worker traps can hang on unbuffered
# channels / wg.Wait); go panics the test on timeout → nonzero exit → FAIL.
OUT="$(cd "$TMP" && go test -race -timeout 30s . 2>&1)"
RC=$?
if [ "$RC" -eq 0 ]; then
  echo "PASS"
  exit 0
fi
echo "FAIL"
echo "$OUT" | grep -iE "race detected|lost increments|Count\(\) =|build failed|cannot use|undefined|expected" | head -3
exit 1

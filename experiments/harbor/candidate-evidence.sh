#!/bin/sh
# Called inside the trusted extractor workspace, before the first author turn
# and before the verifier stages its hidden tests.
set -eu
baseline=$1
evidence=${2:-}
scratch=$(mktemp -d)
trap 'rm -rf "$scratch"' EXIT
# Seed the temporary index with the actual tracked paths, including tracked
# files now ignored by the fixture, without changing the author's staging.
cp "$(git rev-parse --git-path index)" "$scratch/index"
export GIT_INDEX_FILE="$scratch/index"
git add -A -- .
tree=$(git write-tree)
if [ -z "$evidence" ]; then
  printf '%s\n' "$tree" > "$baseline"
else
  git diff --binary "$(cat "$baseline")" "$tree" > "$evidence/candidate.patch"
fi

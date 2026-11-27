#!/bin/sh
set -eu
cd "$(dirname "$0")"
repo=${1:-"$HOME/Projects/bdd-extractor"}
scratch=$(mktemp -d)
trap 'rm -rf "$scratch"' EXIT
git -C "$repo" show c0ec45414dc44374e912e556b86daed636b94220:packages/extractor/src/test-page-text.ts \
  > "$scratch/fixture-page-text.ts"
./prepare-extractor-snapshot.sh "$repo" 9e0aafee2bd5c3c1507eaae36fb421afce290da7 extractor-thin-text
mv "$scratch/fixture-page-text.ts" extractor-thin-text/tests/fixture-page-text.ts

#!/bin/sh
set -eu
cd "$(dirname "$0")"
exec ./prepare-extractor-snapshot.sh "${1:-$HOME/Projects/bdd-extractor}" \
  31e36896c4fce6bd2ec7df775238aa82de0f1ecc extractor-discovery

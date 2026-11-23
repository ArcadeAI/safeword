#!/bin/sh
set -eu

bytes=$(wc -c < ARCHITECTURE.md)
if [ "$bytes" -gt 65536 ]; then
  echo "::error file=ARCHITECTURE.md::ARCHITECTURE.md exceeds 64 KiB ($bytes bytes). Move detailed material into linked records under .project/architecture/." >&2
  exit 1
elif [ "$bytes" -ge 32768 ]; then
  echo "::warning::ARCHITECTURE.md has reached 32 KiB ($bytes bytes). Move growing sections into linked records."
fi

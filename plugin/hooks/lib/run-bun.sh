#!/usr/bin/env bash
# Run a bundled plugin hook script (.ts) on whatever runtime is available.
#
# Plugin hooks ship in the read-only plugin cache and can't assume the user has
# `bun` on PATH (the project's `.safeword/hooks` are gated by session-bun-check.sh,
# but the plugin loads before any project setup). Resolve a runtime in order of
# preference and never hard-fail a session on a missing runtime — a version
# advisory is not worth blocking the editor.
set -euo pipefail
script="$1"
shift || true

if command -v bun > /dev/null 2>&1; then
  exec bun "$script" "$@"
elif command -v bunx > /dev/null 2>&1; then
  exec bunx bun "$script" "$@"
elif command -v npx > /dev/null 2>&1; then
  exec npx -y tsx "$script" "$@"
else
  # No runtime: stay silent rather than break the session. The bootstrap
  # SessionStart nudge still tells the user to run setup.
  exit 0
fi

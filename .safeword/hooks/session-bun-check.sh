#!/bin/bash
# Safeword: Bun runtime check (SessionStart)
# Verifies bun is available before other hooks run.
# This is a bash hook because it can't depend on the runtime it's checking for.

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"

# Not a safeword project, skip silently
if [ ! -d "$PROJECT_DIR/.safeword" ]; then
  exit 0
fi

if ! command -v bun &> /dev/null; then
  echo "safeword needs a small tool called \"bun\" to run its safety checks, and it isn't installed yet." >&2
  echo "Until it is, safeword can't catch unsafe or untested changes — the agent runs unguarded." >&2
  echo "" >&2
  echo "Install bun (about 30 seconds), then restart your terminal and your agent session:" >&2
  echo "  curl -fsSL https://bun.sh/install | bash" >&2
  exit 2
fi

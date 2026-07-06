#!/usr/bin/env bash
# Claude Code cloud containers ship Node 20/21/22 only, but the CLI's engines
# floor is Node 24 (v0.66.0, #806) — on the preinstalled runtime, Error.isError
# is missing and CLI error paths crash (8 suite failures, exit 7). This is the
# repo-owned equivalent of an environment setup script: install Node 24 via the
# image's nvm checkout and put it first on PATH for every Bash command via
# $CLAUDE_ENV_FILE. Local sessions are untouched (CLAUDE_CODE_REMOTE unset).
set -u
[ "${CLAUDE_CODE_REMOTE:-}" = "true" ] || exit 0

export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
mkdir -p "$NVM_DIR"

node24_bin() {
  ls -d "$NVM_DIR"/versions/node/v24.*/bin 2> /dev/null | sort -V | tail -1
}

# Probe for an existing install BEFORE gating on nvm.sh — a container that
# already has Node 24 on disk (resumed session, environment snapshot) should
# get it on PATH even if the image's nvm checkout is missing.
NODE24_BIN="$(node24_bin)"
if [ -z "$NODE24_BIN" ]; then
  [ -s /opt/nvm/nvm.sh ] || exit 0
  # shellcheck disable=SC1091
  \. /opt/nvm/nvm.sh > /dev/null 2>&1 || true
  if ! nvm install 24 > /dev/null 2>&1; then
    echo "session-node24: nvm install 24 failed (network?); Bash commands stay on $(node --version 2> /dev/null || echo 'unknown node')" >&2
    exit 0
  fi
  NODE24_BIN="$(node24_bin)"
fi
[ -n "$NODE24_BIN" ] || exit 0

if [ -z "${CLAUDE_ENV_FILE:-}" ]; then
  echo "session-node24: Node 24 is installed but CLAUDE_ENV_FILE is unset; PATH not persisted for Bash commands" >&2
  exit 0
fi

# SessionStart fires on startup, resume, clear, and compact — append once.
if ! grep -qF "$NODE24_BIN" "$CLAUDE_ENV_FILE" 2> /dev/null; then
  echo "export PATH=\"$NODE24_BIN:\$PATH\"" >> "$CLAUDE_ENV_FILE"
  echo "session-node24: $("$NODE24_BIN/node" --version) first on PATH for Bash commands (engines floor >=24; container image ships 22)."
fi
exit 0

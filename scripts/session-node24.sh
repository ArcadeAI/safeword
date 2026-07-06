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
[ -s /opt/nvm/nvm.sh ] || exit 0

node24_bin() {
  ls -d "$NVM_DIR"/versions/node/v24.*/bin 2> /dev/null | sort -V | tail -1
}

NODE24_BIN="$(node24_bin)"
if [ -z "$NODE24_BIN" ]; then
  # shellcheck disable=SC1091
  \. /opt/nvm/nvm.sh > /dev/null 2>&1 || true
  if ! nvm install 24 > /dev/null 2>&1; then
    echo "session-node24: nvm install 24 failed (network?); Bash commands stay on $(node --version 2> /dev/null || echo 'unknown node')" >&2
    exit 0
  fi
  NODE24_BIN="$(node24_bin)"
fi

if [ -n "$NODE24_BIN" ] && [ -n "${CLAUDE_ENV_FILE:-}" ]; then
  echo "export PATH=\"$NODE24_BIN:\$PATH\"" >> "$CLAUDE_ENV_FILE"
  echo "session-node24: $("$NODE24_BIN/node" --version) first on PATH for Bash commands (engines floor >=24; container image ships 22)."
fi
exit 0

#!/bin/bash
# Safeword: Bun runtime check (SessionStart)
# Verifies bun is available before other hooks run.
# This is a bash hook because it can't depend on the runtime it's checking for.
#
# Version-manager awareness (mise): hooks run in a NON-INTERACTIVE shell, so a
# customer whose shell rc does `mise activate` has no shims on PATH here even
# though `bun` works fine in their terminal. Telling that customer to curl a
# fresh bun installs a second, unmanaged copy that shadows their pinned one.
# Detect that case and hand back the toolchain-correct step instead.

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"

# Not a safeword project, skip silently
if [ ! -d "$PROJECT_DIR/.safeword" ]; then
  exit 0
fi

if command -v bun &> /dev/null; then
  exit 0
fi

MISE_SHIMS="${MISE_DATA_DIR:-${XDG_DATA_HOME:-$HOME/.local/share}/mise}/shims"

mise_governs_project() {
  [ -f "$PROJECT_DIR/mise.toml" ] ||
    [ -f "$PROJECT_DIR/.mise.toml" ] ||
    [ -f "$PROJECT_DIR/mise.local.toml" ] ||
    [ -f "$PROJECT_DIR/.config/mise/config.toml" ]
}

echo "safeword needs a small tool called \"bun\" to run its safety checks, and this session can't find it." >&2
echo "Until it is, safeword can't catch unsafe or untested changes — the agent runs unguarded." >&2
echo "" >&2

if [ -x "$MISE_SHIMS/bun" ]; then
  # mise already owns bun; the only problem is that this non-interactive shell
  # never sourced the shell rc that activates it.
  echo "You already manage bun with mise — this session just can't see it, because agent" >&2
  echo "hooks don't load your shell startup file. Put mise's shims on your login PATH," >&2
  echo "then restart your terminal and your agent session:" >&2
  echo "  echo 'export PATH=\"$MISE_SHIMS:\$PATH\"' >> ~/.zprofile" >&2
  exit 2
fi

if command -v mise &> /dev/null; then
  echo "You use mise for your toolchain, so install bun through mise rather than separately" >&2
  echo "(a standalone install would shadow your pinned versions). Then restart your agent session:" >&2
  echo "  mise use -g bun@latest" >&2
  exit 2
fi

if [ -d "$MISE_SHIMS" ] || mise_governs_project; then
  echo "This project's toolchain is managed by mise, but mise isn't on this session's PATH." >&2
  echo "Install bun through mise so it stays pinned with your other tools, then restart" >&2
  echo "your terminal and your agent session:" >&2
  echo "  mise use -g bun@latest" >&2
  echo "  echo 'export PATH=\"$MISE_SHIMS:\$PATH\"' >> ~/.zprofile" >&2
  exit 2
fi

echo "Install bun (about 30 seconds), then restart your terminal and your agent session:" >&2
echo "  curl -fsSL https://bun.sh/install | bash" >&2
exit 2

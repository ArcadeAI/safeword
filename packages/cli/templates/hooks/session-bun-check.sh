#!/bin/bash
# Safeword: Bun runtime check (SessionStart)
# Verifies bun is available before other hooks run.
# This is a bash hook because it can't depend on the runtime it's checking for.
#
# Version-manager awareness (mise): hooks run in a NON-INTERACTIVE shell, so a
# host whose shell rc runs `mise activate` has no shims on PATH here even though
# `bun` works in their terminal. Telling that host to curl a fresh bun installs a
# second, unmanaged copy that shadows their pinned one, so hand back the step
# that actually restores bun instead. Installing through mise only helps once the
# shims directory is reachable, so recommend both whenever it isn't.

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"

# Not a safeword project, skip silently
if [ ! -d "$PROJECT_DIR/.safeword" ]; then
  exit 0
fi

if command -v bun &> /dev/null; then
  exit 0
fi

MISE_SHIMS="${MISE_DATA_DIR:-${XDG_DATA_HOME:-$HOME/.local/share}/mise}/shims"

mise_manages_host() {
  [ -d "$MISE_SHIMS" ] \
    || command -v mise &> /dev/null \
    || [ -f "$PROJECT_DIR/mise.toml" ] \
    || [ -f "$PROJECT_DIR/.mise.toml" ] \
    || [ -f "$PROJECT_DIR/mise.local.toml" ] \
    || [ -f "$PROJECT_DIR/.config/mise/config.toml" ]
}

# Print the step that puts the shims directory on the PATH this hook inherits.
# Login shells read different files, so name the one this host actually uses.
print_path_repair() {
  # Already reachable: the tool is simply not installed under mise yet.
  case ":$PATH:" in
    *":$MISE_SHIMS:"*) return 0 ;;
  esac
  case "${SHELL##*/}" in
    zsh) profile="$HOME/.zprofile" ;;
    bash) profile="$HOME/.bash_profile" ;;
    *) profile="" ;;
  esac
  if [ -n "$profile" ]; then
    echo "  echo 'export PATH=\"$MISE_SHIMS:\$PATH\"' >> $profile" >&2
  else
    echo "  Add $MISE_SHIMS to PATH in your login shell's startup file." >&2
  fi
}

echo "safeword needs a small tool called \"bun\" to run its safety checks, and this session can't find it." >&2
echo "Until it is, safeword can't catch unsafe or untested changes — the agent runs unguarded." >&2
echo "" >&2

if mise_manages_host; then
  if [ -x "$MISE_SHIMS/bun" ]; then
    echo "You already manage bun with mise — this session just can't see it, because agent" >&2
    echo "hooks don't load your shell startup file. Put mise's shims on your login PATH," >&2
    echo "then restart your terminal and your agent session:" >&2
  else
    echo "You use mise for your toolchain, so install bun through mise rather than separately" >&2
    echo "(a standalone install would shadow your pinned versions). Run every step below," >&2
    echo "then restart your terminal and your agent session:" >&2
    echo "  mise use -g bun@latest" >&2
  fi
  print_path_repair
  exit 2
fi

echo "Install bun (about 30 seconds), then restart your terminal and your agent session:" >&2
echo "  curl -fsSL https://bun.sh/install | bash" >&2
exit 2

# Manual Codex Hook Trust Acceptance

This procedure verifies the interactive behavior that `codex exec --json` does
not expose: an unreviewed or changed plugin hook must show Codex's review
screen, direct the builder to `/hooks`, and not execute.

The automated live smoke remains the supporting machine check. It proves the
marker log stays absent without a hook-trust bypass and that the plugin is a
cache-only installation. Do not use `--dangerously-bypass-hook-trust` as trust
evidence.

## Prepare a cache-only fixture

Run the live smoke with explicit fixture retention:

```bash
SAFEWORD_RUN_CODEX_LIVE_SMOKE=1 \
  SAFEWORD_KEEP_CODEX_LIVE_FIXTURE=1 \
  bun run --cwd packages/cli test:smoke:live -- tests/smoke/codex-parity.live.test.ts
```

The final output prints `CODEX_HOME`, `PROJECT_ROOT`, `INSTALLED_PATH`, and
`BUNX_LOG`. Confirm `INSTALLED_PATH` is inside
`CODEX_HOME/plugins/cache/`, and that the smoke removed its marketplace,
extraction, and tarball before continuing.

## New hook acceptance

1. Record `codex --version` and the printed `INSTALLED_PATH`.
2. Ensure `BUNX_LOG` does not exist or is empty.
3. Start the TUI without a hook-trust bypass:

   ```bash
   CODEX_HOME="$CODEX_HOME" \
     SAFEWORD_BUNX_SHIM_LOG="$BUNX_LOG" \
     PATH="$CODEX_HOME/bin:$PATH" \
     codex -C "$PROJECT_ROOT"
   ```

4. Record the visible `Hooks need review` screen and its `/hooks` remediation.
5. Choose the option that continues without trusting. Confirm `BUNX_LOG` is
   still absent or empty.

## Changed hook acceptance

1. In the same TUI, open `/hooks` and trust the Safe Word hooks through the
   supported Codex flow.
2. Change only the cached SessionStart hook `statusMessage` in
   `$INSTALLED_PATH/hooks.json` to a unique value such as
   `Safe Word trust change 2026-07-16`.
3. Start a new TUI session with the command above, without a hook-trust bypass.
4. Record the renewed review screen. It must identify the changed Safe Word
   hook and direct the builder to `/hooks`.
5. Continue without trusting and confirm the unique marker was not appended to
   `BUNX_LOG`.

## Recorded acceptance

The latest interactive run used `codex-cli 0.144.5`. A fresh isolated plugin
showed `Hooks need review` for five new or changed hooks and offered both
`/hooks` remediation and continue without trusting. The supporting untrusted
live smoke completed before its intentional cache-dispatch bypass with the hook
log absent. Trusting the disposable fixture persisted five Safe Word hook
hashes and dispatched the shimmed hooks. After changing only the cached
SessionStart `statusMessage`, the next TUI session showed the same review state
for one changed hook. Its hook log was reset and remained absent when the
session exited without trusting.

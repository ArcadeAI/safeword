# Manual evidence: resumed-task activation after a Codex restart

## Environment

- Timestamp: 2026-08-18T01:52:19.000Z
- Codex: `codex-cli 0.146.0`
- Previous Safeword plugin: `0.78.3`
- Released Safeword plugin under test: `0.78.4`
- Release commit and annotated tag: `f1d216fe0dcd256c63531665295f8f3247be1ce7` / `v0.78.4`
- npm `latest`: `0.78.4`
- Canonical worktree: `/Users/alex/.codex/worktrees/649c/safeword`
- Installed hook manifest SHA-256: `a2f10ca3f197f2bf5274f647a1bac81f91800783eea98659e0bed4d94bdaf6fa`
- Installed hook commands: all five lifecycle commands pin `safeword@0.78.4`.

## Exact commands

```text
bunx --bun safeword@0.78.4 codex install
bunx --bun safeword@0.78.4 codex status --json
codex --version
```

## Running app and same-app resume

The task began with the `0.78.3` Safeword skill catalogue loaded. Installing
`0.78.4` through the public npm and Codex plugin path returned the expected
action-required result and instructed the user to fully restart Codex, then
resume this task.

Before restart, `codex status --json` reported:

```json
{
  "state": "action_required",
  "code": "CODEX_PLUGIN_INSTALLED_RESTART_REQUIRED",
  "migration_state": "plugin_installed_app_restart_required",
  "installed_version": "0.78.4",
  "protected": "unprotected",
  "proof_status": "missing"
}
```

The canonical pending marker bound the install to:

```json
{
  "schema_version": 2,
  "plugin_version": "0.78.4",
  "manifest_sha256": "a2f10ca3f197f2bf5274f647a1bac81f91800783eea98659e0bed4d94bdaf6fa",
  "activation_id": "b1c5d448-6b3f-46c5-a68b-fbc9f8d9287b",
  "installed_at": "2026-08-18T01:51:56.705Z",
  "active_hosts": [
    {
      "pid": 67677,
      "started_at": "2026-08-17T17:40:20.000Z"
    }
  ]
}
```

Result: **PASS**. Installing the upgrade did not authorize the running app,
and resuming without a full app restart remained honestly pending.

## First restart and the hook-trust boundary

At `2026-08-18T01:57:53.859Z`, Codex resumed the authentic existing task
`01a011f8-546a-7102-8891-8953564cc272` in the same canonical worktree. The new
app server was PID `52655`, started `2026-08-17T18:57:28-07:00`; it differs
from the install-time host PID `67677`, started
`2026-08-17T10:40:20-07:00`. The resumed task loaded the installed Safeword
`0.78.4` skill catalogue.

The plugin hooks had not yet been reviewed or trusted. Codex Desktop treated
`/hooks` as ordinary chat text rather than opening hook review. Consequently,
no profile-plugin hook executed, the activation marker remained, and `codex
status --json` honestly reported `action_required`, `unprotected`, and
`proof.status: missing`.

The Desktop trust surface is Settings > Hooks; the terminal TUI also exposes
`/hooks`. Current upstream behavior does not replay a SessionStart that was
skipped before trust. This exposed an instruction-order defect: restart-first
guidance can require an avoidable second restart.

Result: **PASS (fail-closed)**. The untrusted hook did not manufacture proof.

## Hook review, final restart, and authentic resume

The same task was opened in the terminal TUI with:

```text
codex resume 01a011f8-546a-7102-8891-8953564cc272 -C /Users/alex/.codex/worktrees/649c/safeword --no-alt-screen
```

All five pending hooks were inspected and matched the installed `0.78.4`
manifest exactly before they were trusted. No unrelated hook was pending. The
TUI was closed, Codex Desktop was fully restarted, and the same task ID was
resumed again in the same canonical worktree. The restarted app server was PID
`90665`, started at `2026-08-18T02:42:47.000Z`.

SessionStart wrote retained task proof with:

```json
{
  "schema_version": 2,
  "plugin_version": "0.78.4",
  "manifest_sha256": "a2f10ca3f197f2bf5274f647a1bac81f91800783eea98659e0bed4d94bdaf6fa",
  "activation_id": "b1c5d448-6b3f-46c5-a68b-fbc9f8d9287b",
  "project_directory": "/Users/alex/.codex/worktrees/649c/safeword",
  "session_id": "01a011f8-546a-7102-8891-8953564cc272",
  "recorded_at": "2026-08-18T03:20:58.962Z"
}
```

The matching pending marker retired. Its activation receipt bound the same
plugin version, manifest digest, activation ID, and restarted host identity.
After the task exercised the remaining lifecycle boundaries, status reported
`protected`, current proof, all five events (`session-start`, `pre-tool-use`,
`post-tool-use`, `user-prompt-submit`, and `stop`), and no missing events.

Result: **PASS**. A restarted app protected the authentic resumed task; no new
task was created.

## Later profile change rejects the older task proof

At `2026-08-18T03:31:13.348Z`, a later profile installation wrote a new pending
activation ID, `7e437d33-a6fe-432b-a676-e2bcfaad0621`, while the retained task
proof still named `b1c5d448-6b3f-46c5-a68b-fbc9f8d9287b`. Status immediately
returned to `unprotected` with stale proof and did not reuse the earlier green
evidence.

Result: **PASS (stale-proof rejection)**. The live environment needs another
restart after that later profile change, but the earlier proof cannot falsely
authorize it.

## UX correction derived from the live run

The reliable one-restart order is now:

1. Install the update.
2. Review changed hooks in Desktop Settings > Hooks or `/hooks` in the terminal TUI.
3. Fully restart Codex Desktop.
4. Resume the existing task.

The correction is covered by an acceptance scenario that failed against the
released restart-first copy and passes after the shared instruction was
reordered. It changes guidance only; the proof format and fail-closed checks
remain unchanged.

---
id: 143
type: task
phase: understand
status: open
created: 2026-05-13T19:37:00Z
last_modified: 2026-05-13T19:37:00Z
---

# Auto-upgrade rollback on subprocess failure

**Goal:** Eliminate the partial-upgrade stuck state in `session-auto-upgrade.ts`. If `bunx safeword@${latest} upgrade` errors mid-write, revert safeword-managed paths so the working tree is clean for the next session.

**Why:** Surfaced during the #081 PR honesty audit. Today's failure mode:

1. Auto-upgrade starts, partial files written
2. Subprocess errors (network drop, npm hiccup, disk full)
3. Hook catches the error, logs, exits — but leaves the working tree dirty with partial upgrade
4. Next session's hook checks `git status --porcelain` → dirty → skip
5. **User is stuck** with partial upgrade until they manually `git checkout` the affected files or rerun `safeword upgrade`

Failure is recoverable (no data corruption — all touched paths are safeword-managed) but it's the only ungraceful path in the hook.

## Scope

**In:**

- Catch non-zero exit from the `execSync('bunx safeword@${latest} upgrade', ...)` call
- Run `git checkout -- <safeword-paths>` to revert any partial writes
- Log clearly: `SAFEWORD: Auto-upgrade failed and rolled back. Run \`safeword upgrade\` manually to retry.`
- Test: mock the subprocess to fail mid-write, assert working tree returns to pre-upgrade state

**Out of Scope:**

- Retries (separate decision — graceful failure ≠ resilience)
- Distinguishing "transient" vs "permanent" subprocess errors
- Notifying user via any channel other than stdout

## Done When

- [ ] Subprocess failure leaves working tree byte-identical to pre-upgrade state
- [ ] Clear error message points user at manual recovery
- [ ] Test covers the failure-then-rollback path (mocked subprocess)
- [ ] No regression in the happy-path test

## References

- PR #81 ([safeword#81](https://github.com/ArcadeAI/safeword/pull/81)) — auto-upgrade implementation; "Known limitation — partial-upgrade stuck state" section flags this
- `packages/cli/templates/hooks/session-auto-upgrade.ts` — the file to harden

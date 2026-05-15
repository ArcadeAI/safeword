---
id: 147
type: feature
phase: intake
status: in_progress
related: [143, 146]
created: 2026-05-15T15:30:00Z
last_modified: 2026-05-15T15:30:00Z
scope: |
  Add a forcing function that detects when the agent skips /verify and /audit
  skill invocations before marking a ticket done. Two changes:

  (1) /verify and /audit skills get a bash-injection line that appends a
      session-scoped entry to `.safeword/skill-invocations.log` on every
      invocation. Format per line:
      `<ISO-timestamp> <session-id> <skill-name>`.
      The bash runs as a side effect of the skill being rendered — it cannot
      be produced by the agent hand-writing verify.md or audit.md.

  (2) `stop-quality.ts` (the done-gate hook) gains a check: when a ticket
      transitions to `phase: done` (feature tickets), the log must contain
      at least one entry each for /verify and /audit within the current
      session_id. If either is missing, hard-block with a message naming
      which skill was skipped.

  The log file lives in `.safeword/skill-invocations.log`, is registered in
  SAFEWORD_SCHEMA.preservedDirs (session state, not git-committed), and is
  rotated/truncated only by user intent (no auto-rotation in v1).
out_of_scope: |
  - Rewriting transcript parsing in stop-quality.ts (separate concern, ticket 037).
  - Migrating to agent-based hooks (separate concern, also 037).
  - Replacing the log mechanism with skill-scoped Stop hooks (semantics unclear
    in current docs; deferred until clearer guidance).
  - Adding markers or signatures to verify.md / audit.md (spoofable; the log
    is the load-bearing artifact).
  - Auto-rotation of the log file (not needed at v1 scale).
  - Adding the same forcing function to other skills (only /verify and
    /audit; the failure mode is specific to "done-gate corner-cutting").
done_when: |
  - `.safeword/skill-invocations.log` is created on first /verify or /audit
    invocation in a fresh session; subsequent invocations append.
  - The bash-injection line in the skill source uses `${CLAUDE_SESSION_ID}`
    substitution so the log entry is genuinely tied to the invocation.
  - `stop-quality.ts` on `phase: done` (feature tickets) checks the log for
    a current-session entry for both `verify` and `audit`.
  - When /verify is skipped, done-gate hard-blocks with explicit message:
    "No /verify invocation recorded in this session. Run /verify first."
  - When /audit is skipped, done-gate hard-blocks with explicit message:
    "No /audit invocation recorded in this session. Run /audit first."
  - When both are present, the existing verify.md presence check still gates
    (the log doesn't replace verify.md; both are required).
  - test-definitions.md scenarios cover: log creation, log append, skipped /verify
    block, skipped /audit block, both present pass, log corruption gracefully handled.
  - Log file registered in SAFEWORD_SCHEMA so safeword install/reset behaves
    correctly (preserved, not owned; not byte-compared in parity).
  - /verify and /audit skill template parity preserved (144's parity check
    enforces all four surfaces stay synced).
  - All scenarios marked complete; /verify passes; /audit passes.
  - **Memory entry written** alongside the ticket: capture the "always invoke
    /verify + /audit skills explicitly; never substitute targeted tests for
    full skill cycle" lesson from this session's failure mode.
---

# /verify and /audit invocation forcing function

**Goal:** Stop the failure mode where the agent (me, in this session) skips invoking /verify and /audit skills, substitutes ad-hoc targeted tests, and marks a ticket done with verify.md hand-written rather than skill-generated. Add a tamper-resistant log of skill invocations that the done-gate hook validates.

**Why:** This session's debrief surfaced the exact failure mode. When asked "did you verify and audit," honest answer was "partially." Reasons: speed bias, conflating targeted tests with full /verify, no forcing function, late-session velocity bias. The skills exist as the rigor mechanism; I bypassed them. PR review can catch some issues but the durable fix is a mechanism the agent can't shortcut.

**Why bash-injection log specifically** (over alternatives): bash injection (`` !`...` `` in skill content) runs as a side effect when the skill is invoked — _not_ when the agent types content. Hand-writing verify.md to fake "I ran /verify" cannot produce the log entry. Spoof-resistant. Avoids transcript parsing (which ticket 037 wants to deprecate). Forward-compatible.

## Adjacent tickets

- **143** (done) — universal binary terminal stop-hook prompt. Surfaced this failure mode when the user asked "did you verify and audit?" mid-session debrief.
- **146** (done) — /verify three-section output. Applied 143's contract but didn't fix the "agent skips invoking /verify" failure mode.
- **037** (planning) — replace transcript parsing in stop-quality.ts with agent-based hooks. 147's log-grep approach is forward-compatible with that migration (the log is independent of transcript format).

## Design notes

**Bash injection line** (added to /verify and /audit skill content):

```
!`mkdir -p .safeword && echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) ${CLAUDE_SESSION_ID} verify" >> .safeword/skill-invocations.log`
```

(Substituting `verify` with `audit` for the /audit skill.)

The `${CLAUDE_SESSION_ID}` is substituted by Claude Code at skill render time. The bash runs once per invocation.

**Done-gate check** (in stop-quality.ts):

```ts
function checkSkillInvocations(sessionId: string): { verified: boolean; audited: boolean } {
  const logPath = nodePath.join(projectDir, '.safeword/skill-invocations.log');
  if (!existsSync(logPath)) return { verified: false, audited: false };
  const lines = readFileSync(logPath, 'utf8').split('\n');
  const sessionLines = lines.filter(l => l.includes(sessionId));
  return {
    verified: sessionLines.some(l => l.endsWith(' verify')),
    audited: sessionLines.some(l => l.endsWith(' audit')),
  };
}
```

Wired into the existing done-phase hard-block path: alongside verify.md presence, the log check fires.

## Open Questions (resolve in define-behavior)

- **Patch tickets and tasks too, or only features?** Currently the done-gate hard-block only applies to features. Tasks/patches don't require verify.md. Should they require log entries for /verify? Lean: only features (matches existing behavior; consistent).
- **What about `--no-verify` / bypass?** The existing stop-hook allows `stop_hook_active` bypass for one cycle. Should the log check honor the same bypass? Lean: yes (consistency with existing bypass semantics).
- **Log entries persist across sessions** — do we ever need to clear them, or is per-session filtering by session_id enough? Lean: per-session filtering is enough; the file grows but at trivial rate.

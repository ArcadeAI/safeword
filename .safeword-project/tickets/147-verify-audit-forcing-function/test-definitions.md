# Test Definitions — Ticket 147

> 6 rules, 21 scenarios. AODI validated. Covers happy path + failure modes + boundaries.
>
> **Test surface mix:** Content-tests on skill files (similar to 146); unit tests on parsing/config functions; integration smoke for the full hook path.

## Rule: Log gets written on skill invocation, scoped to session

> Rationale: The bash injection produces an append-only log entry per invocation. The log is the load-bearing artifact — agent cannot hand-write content that produces this entry. Each entry must be uniquely tied to a session via `${CLAUDE_SESSION_ID}`.

- [ ] /verify skill content (canonical template) contains a bash injection line using `${CLAUDE_SESSION_ID}` and the literal token `verify`
- [ ] /audit skill content (canonical template) contains a bash injection line using `${CLAUDE_SESSION_ID}` and the literal token `audit`
- [ ] Bash injection appends (`>>`) — does not overwrite (`>`)
- [ ] Bash injection creates parent directory `.safeword/` if missing (`mkdir -p`)
- [ ] Log entry format is `<ISO timestamp> <session-id> <skill-name>` parseable by the gate check

## Rule: Phase-gate check consults the config map

> Rationale: Gate enforcement is config-driven. v1 config is `{ done: ['verify', 'audit'] }`; adding gates is a single-line config edit, not infrastructure changes.

- [ ] `PHASE_GATES.done` resolves to `['verify', 'audit']`
- [ ] `getRequiredSkillsForPhase('done')` returns `['verify', 'audit']`
- [ ] `getRequiredSkillsForPhase('implement')` returns `[]` (not gated)
- [ ] `getRequiredSkillsForPhase('unknown-phase')` returns `[]` (graceful default)

## Rule: Gate fires only on transition into a gated phase for feature tickets

> Rationale: Avoid re-blocking when already past the transition; only enforce on entry. Features only (consistent with existing verify.md gate; tasks/patches don't have done_when criteria of the same weight).

- [ ] When `lastKnownPhase ≠ 'done'` and current is `'done'` (feature ticket), gate fires
- [ ] When `lastKnownPhase === 'done'` and current is `'done'`, gate skipped (avoid re-blocking)
- [ ] When ticket type is `task`, gate skipped regardless of phase transition
- [ ] When ticket type is `patch`, gate skipped regardless of phase transition

## Rule: Missing required skills hard-block with skill-specific message

> Rationale: The whole point — refuse to let done land without invocation evidence. Message names which skill is missing so the agent knows what to invoke.

- [ ] When both verify + audit entries present for current session, gate passes
- [ ] When verify entry missing, hard-block message contains "verify" and "Run /verify first"
- [ ] When audit entry missing, hard-block message contains "audit" and "Run /audit first"
- [ ] When both missing, message names both skills
- [ ] Other-session entries don't satisfy the gate (only current session_id counts)

## Rule: Bypass mechanisms honored consistently with existing done-gate

> Rationale: Don't break existing escape hatches. `stop_hook_active` is git's bypass for one-cycle re-runs; the gate should honor it the same way the rest of stop-quality.ts does.

- [ ] When `stop_hook_active === true`, gate skipped (consistent with existing bypass)
- [ ] When `stop_hook_active === false` (default), gate fires normally

## Rule: Log parsing is robust to malformed entries

> Rationale: Log file is plain-text append-only; partial writes, manual edits, or other corruption shouldn't crash the hook or silently bypass the gate.

- [ ] Malformed line (missing fields) is ignored, not crashed-on
- [ ] Empty log file treated as "no invocations recorded"
- [ ] Log file unreadable (permission denied) → gate fails closed (blocks; doesn't silently pass)

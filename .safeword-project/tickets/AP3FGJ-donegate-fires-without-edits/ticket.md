---

id: AP3FGJ
slug: donegate-fires-without-edits
type: task
phase: done
status: done
created: 2026-05-30T14:30:14.807Z
last_modified: 2026-05-30T14:48:58.473Z
scope:

- In `stop-quality.ts`, resolve the active ticket (`getCurrentTicketInfo`) BEFORE the `detectEditToolsUsed` early-exit, and scope that exit so it skips ONLY when the ticket is not at `phase: done` — the done branch (artifact check, test run, verify.md, skill-invocation gate, ledger validation, status update + navigation) must run on any stop at `phase: done`, regardless of recent edit-tool activity.
- Sync template ↔ `.safeword/hooks/` mirror.
- Regression test in `tests/integration/`: a `phase: done` ticket + a transcript with NO edit tools → the done-gate still evaluates (hard-blocks when evidence is missing, closes when present).
  out_of_scope:
- The review / backstop path — it stays correctly gated by `detectEditToolsUsed` (no edits → nothing to review).
- Changing any done-gate check itself (evidence requirements, ledger rules) — only WHEN the branch runs.
- The `stop_hook_active` loop guard semantics — unchanged.
  done_when:
- A done-phase ticket with a no-edit-tool transcript and missing evidence → stop hook emits `decision:block` (done-gate evaluated), not an empty exit.
- The same no-edit transcript at a non-done phase → still exits silently (review path unchanged).
- Existing stop-hook tests (`stop-hook-transcript-format`, `quality-gates`) stay green; new regression test added; templates synced.

# Done-gate must fire on no-edit stops

**Goal:** Make the `currentPhase === 'done'` branch of `stop-quality.ts` run on every stop at `phase: done`, not only when the last 5 assistant messages contain an edit-tool use.

**Why:** The hook exits early at `if (!detectEditToolsUsed(lines)) process.exit(0)` (before `getCurrentTicketInfo`), so a feature/task sitting at `phase: done` silently fails to close — and its evidence gate (tests, verify.md, scenarios, skill log, ledger) is skipped — whenever the agent's final turns are commits/text with no edits. Hit concretely on SXSCJQ (2026-05-30): everything was green but the ticket stayed `in_progress` until the Stop hook was invoked manually with an edit-bearing transcript. Closing depends on ticket state, not on recent edit activity.

## Work Log

- 2026-05-30T14:30:14.807Z Started: Created ticket AP3FGJ
- 2026-05-30T14:47:00.000Z Complete: TDD fix (f151b6e3) — resolve ticket before detectEditToolsUsed gate; gate skips only when phase ≠ done. Regression test (done-phase + no-edit transcript → done-gate evaluates). /verify: full suite 2254 pass / 1 skip / 0 fail, build + lint clean. /quality-review APPROVE (no ecosystem surface), /refactor nothing-to-do (change already minimal). → done.

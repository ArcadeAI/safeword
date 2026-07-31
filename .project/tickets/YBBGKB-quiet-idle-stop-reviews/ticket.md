---
id: YBBGKB
slug: quiet-idle-stop-reviews
type: task
phase: verify
status: in_progress
created: 2026-07-29T17:27:17.421Z
last_modified: 2026-07-31T05:50:59.000Z
---

# Keep stop reviews quiet until a new user prompt

**Goal:** Prevent stale stop-quality continuations from forcing idle replies before the next real user prompt.

**Why:** Stop-hook feedback must not create noisy assistant turns while preserving quality review for real edited work.

**External issue:** https://github.com/ArcadeAI/safeword/issues/1492

## Scope

- Remember that the generic Stop quality review has already been surfaced for a session.
- Clear that reminder at the next `UserPromptSubmit` boundary.
- Keep the existing fail-closed review when a transcript has no recoverable human-prompt boundary and no prior review was surfaced.
- Apply the reminder only to the no-ticket generic-review branch, leaving typecheck advice and phase-boundary reviews independent.
- Initialize the session state when that generic review is first surfaced.
- Correct review-driven sibling-hook comments that use the same undefined-phase vocabulary, without changing their behavior.

## Out of scope

- Changing Claude's `stop_hook_active` behavior or the hard artifact/done gates.
- Suppressing review after a new user prompt or on another session.
- Extending this Claude-only marker to Cursor or Codex: Cursor limits its Stop loop structurally and Codex uses a separate growth-offset guard.

## Figure-it-out decision

The current `stop_hook_active` guard prevents a continuation loop only when the host sets that field. The generic stop-review path can still fall back to earlier edit tools when a host invokes Stop without a new human prompt and without that flag. That is the idle reply in #1492.

Considered options:

1. Treat every missing prompt boundary as no edited work. This is simple, but weakens the deliberate fail-closed behavior for malformed transcripts.
2. Depend only on `stop_hook_active`. This is already implemented and does not cover the reported false-valued idle invocation.
3. Persist a session-scoped "review surfaced; await user prompt" marker. The next prompt clears it; an otherwise idle Stop exits silently. The first malformed transcript remains conservatively reviewed.

Decision: implement option 3. It is narrowly scoped to an already-surfaced generic review, preserves hard gates and malformed-transcript protection, and resets at Claude's documented `UserPromptSubmit` lifecycle boundary.

Pre-mortem: a state-file write failure could still allow a duplicate generic review. The write is best-effort by design, but it now creates the missing session state in the normal case and is located after independent quality gates, so it cannot bypass typecheck, phase, or done verification; tests prove the first generic review persists from an empty session.

## Work Log

- 2026-07-29T17:27:17.421Z Started: Created ticket YBBGKB
- 2026-07-29T17:31:00.000Z Revalidated #1492 against current Stop logic and Claude hook behavior; it remains relevant.
- 2026-07-29T17:31:00.000Z Applied /figure-it-out: chose a per-session post-review marker over weakening the malformed-transcript fallback.
- 2026-07-29T17:31:00.000Z Defined task stories, test definitions, and implementation plan; beginning RED.
- 2026-07-29T17:39:00.000Z RED: Stop hook regression failed because no marker was persisted; prompt-hook regression failed because the marker was not cleared.
- 2026-07-29T17:39:00.000Z GREEN: persisted the marker after generic review, cleared it at UserPromptSubmit, and proved the done gate remains active.
- 2026-07-29T17:39:00.000Z REFACTOR: retained existing state-file conventions and avoided new helpers; focused regression suites pass.
- 2026-07-29T17:42:00.000Z Quality review approved: current Claude hook lifecycle validates the UserPromptSubmit/Stop boundary; installed-hook wiring tests cover both transitions.
- 2026-07-29T17:48:00.000Z Full quality-review/refactor pass: added a two-entry, dependency-ordered ledger for complete re-arm coverage and a clarity-only state-writer rename.
- 2026-07-29T17:57:00.000Z Resolved every quality-review suggestion: added installed-hook re-arm coverage and renamed the combined Stop-review state writer. Package-local regression suite passes 17/17; canonical suite remains queued behind the shared lock.
- 2026-07-29T22:30:00.000Z Reviewed all PR #1652 feedback with /quality-review and /figure-it-out. Moved generic suppression beside the generic branch, initialized fresh state, batched prompt writes, and moved marker-lifecycle coverage to its own installed-hook test file. New focused regressions pass locally; the attempted old-head Node 24 rerun was canceled when the corrected head superseded it, so that fresh CI run is authoritative.
- 2026-07-29T23:12:14.000Z Revalidated completion evidence with /figure-it-out. Corrected head `085b90b6a` is mergeable and has green parity, lint, Node 22, and Node 24 CI; both Node lanes ran the full CLI, acceptance, install-proof, and release-gate checks. Keep the ticket in `verify`: PR #1652 is still a draft, its Validation section needs its stale queue/test-file wording refreshed, and ticket-system policy requires user confirmation before `done` or closing #1492.
- 2026-07-29T23:49:30.000Z Pass-2 PR review: repointed rebase-orphaned GREEN evidence to reachable commits, corrected the fail-closed test matrix pointer, and made the prompt-boundary clear persist even when optional reminder derivation throws. The new installed-hook regression was RED before `69ce94f19` and GREEN afterward; generic state initialization and prompt-write recovery are documented in the implementation plan.
- 2026-07-30T00:55:54.000Z Pass-3 PR review: made the prompt-recovery test prove its malformed-state failure still occurs by asserting a downstream learning nudge remains absent, and replaced the misleading inferred-`any` parse declaration with the shared `QualityState` contract. Focused hook, idle-review, typecheck, phase-backstop, and ledger suites pass 102/102; the prior current-head CI run 30501024183 is green. Keep the ticket in `verify` pending user confirmation.
- 2026-07-30T01:25:12.000Z Fresh quality-review and figure-it-out pass: no new reviewer feedback or unresolved threads. Verified the current head's CI run 30504407023 is green; corrected the PR Validation wording that still reported it in progress. Source review confirms the synchronous Node file APIs used by the best-effort prompt-state recovery remain current. Keep the ticket in `verify` pending user confirmation.
- 2026-07-30T15:50:00.000Z Full audit, quality-review, and refactor pass: the code remains correct and intentionally keeps read-modify-write logic explicit per hook. Updated the architecture narrative with the one-generic-review-per-user-prompt boundary and corrected PR #1652 to show current-head CI 30505649629 as passed. Focused installed-hook coverage passes 72/72.
- 2026-07-30T16:09:29.000Z Revalidated #1492 during retro triage: it remains relevant because `origin/main` has no idle-review marker, while draft PR #1652 adds the marker to both template and dogfood hooks. The real installed-hook lifecycle regression passes 3/3; current Claude Code hook documentation still places `UserPromptSubmit` before processing and `Stop` after the response. Reconfirmed the per-user-prompt generic marker as the smallest solution that preserves independent typecheck, phase, and done gates. Keep this ticket in `verify` and PR #1652 as a draft pending explicit delivery approval. (refs: #1492, PR #1652, `packages/cli/tests/integration/stop-hook-idle-review.test.ts`)
- 2026-07-31T03:30:00.000Z Pass-5 PR review resolution: corrected the ARCHITECTURE.md and stop-quality comment wording to say the generic review keys on "no resolvable ticket phase", not "no active ticket" — `resolveStopPhase` also empties the phase for an in_progress ticket missing `phase:`, any status escape hatch, and a done-status patch/typeless/scenario-less ticket. Typed the Stop writer's parsed state as `Partial<QualityState>` so both read-modify-write hooks name one contract. Docs and annotation only; no behavior change. (refs: PR #1652)
- 2026-07-30T16:30:00.000Z Rebased PR #1652 onto `origin/main` at `af3eab8b2` without conflicts. Pass-6 review resolution removed a redundant parsed-state assertion, corrected three sibling undefined-phase comments, and replaced static PR validation counts with reproducible scopes plus the live Checks tab. The rebase orphaned prior TDD evidence, so `git range-diff` remapped it to reachable commits (`f76e91bc9`, `c3f3666ac`, `bb6540dfb`, `4f4a949f6`). Lint/typecheck, targeted real-hook and ledger suites, parity, and evidence reachability pass. (refs: PR #1652)
- 2026-07-31T05:50:59.000Z Pass-7 PR review resolution: stated the narrow review-driven sibling-comment work in scope, refreshed this active-ticket timestamp from the current UTC clock, and reflowed the shared typecheck phase JSDoc in both template and dogfood copies. Documentation and workflow metadata only; no behavior change. (refs: PR #1652)

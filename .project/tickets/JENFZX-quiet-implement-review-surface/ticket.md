---
id: JENFZX
slug: quiet-implement-review-surface
type: task
phase: implement
status: in_progress
created: 2026-06-26T05:31:52.143Z
last_modified: 2026-06-26T06:20:23Z
relates_to:
  - SXSCJQ
  - W610WW
  - AKNWZK
external_issue: https://github.com/ArcadeAI/safeword/issues/464
scope:
  - Define "quiet implement mode" across Claude, Cursor, and Codex-facing guidance: implementation still performs TDD step checks, `/refactor`, and conditional `/quality-review`, but ordinary RED/GREEN/REFACTOR progress does not surface a chat-facing review prompt.
  - Suppress hook-injected implement-step review prompts in Claude paths: `post-tool-quality.ts` no longer emits `getQualityMessage('implement', step)` for ordinary test-definition checkbox flips, and `stop-quality.ts` no longer soft-blocks solely because the derived implement TDD step changed.
  - Suppress Cursor's generic edit-stop quality-review follow-up during ordinary implement-phase edits; keep Cursor stop follow-ups outside quiet implementation and for real blockers/escalations.
  - Preserve implementation work: RED reviews test quality, GREEN reviews implementation minimality/correctness, REFACTOR reviews scenario completion, `/refactor` still runs when code shape warrants it, and `/quality-review` still runs for new external dependency/API surfaces plus the whole-ticket implement-exit pass.
  - Preserve hard gates and anomaly surfaces: checkbox annotation validation, one-checkbox-per-edit protection, LOC commit gate, invalid REFACTOR test edits, TypeScript changed-file advice, done-gate evidence checks, and user/scope decision blockers still surface.
  - Add an implementation-exit summary contract: when leaving implement, the agent reports scenarios completed, review/refactor work performed, `/quality-review` findings handled, test evidence, commits recorded, and any deferred risks.
out_of_scope:
  - Removing `tdd-review` content or weakening its step-specific checks; this ticket changes visibility, not the review work.
  - Removing `/quality-review` or `/refactor` from implementation; both remain part of the workflow.
  - Changing scenario-gate, verify, done, or cross-scenario review requirements except where they mention implement-phase surfacing.
  - Weakening hard gates to keep the agent moving; quiet mode is not YOLO mode.
  - Reopening or rewriting completed history in `SXSCJQ` or `W610WW`; this is a follow-up policy change.
done_when:
  - In Claude, marking RED/GREEN/REFACTOR checkboxes during `phase: implement` does not inject a user-facing TDD review through PostToolUse or the Stop backstop.
  - In Cursor, ordinary file edits while the active ticket is in `phase: implement` do not produce the generic `QUALITY_REVIEW_MESSAGE` stop follow-up.
  - Real blockers and anomaly paths still surface during implement: hard gate denials, TypeScript changed-file advice, done-gate failures, new user/scope decisions, and dependency/API risk findings.
  - `bdd/TDD.md`, `tdd-review`, Cursor rules/commands, Claude skills, Codex skills, and template copies all describe the same quiet-implementation contract.
  - Tests cover quiet implement suppression for Claude PostToolUse, Claude Stop, and Cursor Stop; tests also prove non-implement review surfaces and hard/anomaly gates still fire.
  - Full focused hook suite, parity checks, typecheck, and lint pass.
---

# Make implementation reviews quiet until exit

**Goal:** Let implementation run without chat-facing review checkpoints while keeping the actual TDD review, refactor, quality-review, and hard-gate work intact.

**Why:** Per-step hook prompts make RED/GREEN/REFACTOR feel like user approval gates, even though those reviews are advisory self-checks; the user should only hear about real blockers, decisions, risky findings, and the implementation-exit summary.

## Decision

Quiet implementation is a visibility policy, not a rigor reduction:

- **Still happens internally:** TDD step review, targeted tests, scenario-close full suite, `/refactor`, conditional `/quality-review`, whole-ticket implement-exit `/quality-review` + `/refactor`.
- **Still surfaces immediately:** hard gate failures, TypeScript changed-file advice, new external dependency/API risks that need action, scope/product decisions, and anything genuinely `BLOCKED`.
- **No longer surfaces routinely:** hook-injected `CONFIDENT/BLOCKED` review prompts after ordinary RED, GREEN, or REFACTOR progress.

## Related history

- `SXSCJQ-remove-loc-review-throttle` introduced per-step/per-phase hook review surfacing. This ticket keeps its boundary-detection learning but reverses the user-facing implement-step surface.
- `W610WW-whole-ticket-quality-refactor` made implementation exit the whole-ticket review/refactor checkpoint. This ticket leans on that as the visible review moment.
- `AKNWZK-cursor-stop-gate-rearchitect` documents Cursor's Stop limitation and existing `followup_message` behavior; this ticket should keep Cursor divergence explicit.

## Work Log

- 2026-06-26T06:20:23Z Refactor pass: removed obsolete implement-step review dedup infrastructure after quiet mode made it dead code. Deleted `selectMostAdvancedStep`, `shouldReviewStep`, `lastReviewedStep`, stale step-dedup tests, and old comments in template + dogfood hook copies while keeping phase-review dedup intact. Scoped audit found one stale test label; renamed it and reran affected tests. Verification: affected tests 30/30 pass; broader hook matrix 156/156 pass; audit follow-up tests 12/12 pass; `bun run --cwd packages/cli typecheck` pass; `bun run lint:eslint` pass; `bun run lint:gherkin` pass; `git diff --check` pass. Commit deferred because this worktree is detached and contains the mixed #464 feature diff plus ticket artifacts.
- 2026-06-26T06:14:05Z Quality-review pass: found and fixed a real Cursor wiring gap. The first Cursor Stop test pre-seeded `quality-state-cursor-*`, but production Cursor PostToolUse was spawning the shared hook without `SAFEWORD_AGENT_RUNTIME=cursor` and passing the full gate result object where stdout was expected, so the Stop hook could miss the active implement ticket. Fixed Cursor adapters to write/read the Cursor-scoped state key, corrected post-tool stdout handling, and changed the regression test to bind the ticket through the real Cursor PostToolUse adapter before Stop. Verification: 16 focused hook/test files pass (253 tests); `bun run --cwd packages/cli typecheck` pass; `bun run lint:eslint` pass; `bun run lint:gherkin` pass; `git diff --check` pass. `bun audit --json` still reports existing low/moderate dependency advisories unrelated to this diff; no package manifests or lockfiles changed.
- 2026-06-26T05:54:00.000Z Implemented + verified locally: suppressed ordinary implement-step review surfacing in Claude PostToolUse, Claude Stop backstop, and Cursor Stop while preserving phase reviews, typecheck advice, hard gates, and non-implement Cursor follow-ups. Updated TDD/Bdd guidance across Claude/Codex/Cursor mirrors. Tests: focused hook/parity suite 101/101 pass; Cursor stop regression 2/2 pass; `bun run --cwd packages/cli typecheck` pass; `bun run lint:eslint` pass; `bun run lint:gherkin` pass. Not marked done pending user confirmation.
- 2026-06-26T05:46:00.000Z Started implementation: Scope is concrete enough for task-level TDD. Test layer: integration because the behavior is the real hook output seen by Claude/Cursor.
- 2026-06-26T05:44:00.000Z Mirrored: Created GitHub issue #464 and recorded it as `external_issue`.
- 2026-06-26T05:36:00.000Z Scoped: Captured the quiet-implementation policy from `/figure-it-out` discussion. Key distinction: keep TDD review, `/refactor`, and `/quality-review` work; suppress only chat-facing hook prompts between implement entry and implement exit, except blockers/anomalies/user decisions.
- 2026-06-26T05:31:52.143Z Started: Created ticket JENFZX

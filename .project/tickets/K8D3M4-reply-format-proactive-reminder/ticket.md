---
id: K8D3M4
slug: reply-format-proactive-reminder
type: task
phase: done
status: done
external_issue: https://github.com/ArcadeAI/safeword/issues/1524
external_prs:
  - https://github.com/ArcadeAI/safeword/pull/1540
created: 2026-07-27T16:11:23.968Z
last_modified: 2026-07-28T01:02:07Z
---

# Surface reply format before Claude responds

**Goal:** Keep substantive Claude work updates in Safeword’s concise decision-brief shape before they reach the user.

**Why:** The current Stop hook can only correct a response after it has already been shown, causing repeated re-teaching and catch-up loops.

**Type:** Improvement

**Scope:** Add a compact, phase-aware reply-format reminder to Claude's existing
`UserPromptSubmit` hook so it reaches the model beside each new user prompt.
Keep the Stop hook's detailed validation as the post-response safety net. During
an active implement/TDD step, retain only the lead-with-the-answer cue because
the Stop hook intentionally keeps that workflow quiet. The pre-existing first
anchor line also gains the `-` bullet prefix every other emitted line already
carries, so the injected block is uniform now that it leads with two anchors.

**Out of Scope:** Changing the verdict contract, modifying Cursor or Codex
adapters (tracked by [#1547](https://github.com/ArcadeAI/safeword/issues/1547)),
adding a new hook, or requiring decision-brief formatting for short
conversational replies.

## User story

As a Safeword user, I want the agent to receive the reply-format rule before it
drafts a substantive work update, so the first response is useful without a
post-hoc rewrite.

As a builder in an active TDD step, I want the pre-prompt reminder to stay
brief, so normal RED/GREEN/REFACTOR progress does not receive an unnecessary
decision-brief demand.

## Decision

Use the existing Claude `UserPromptSubmit` hook. Its compact factual reminder
is injected beside the submitted prompt, unlike the Stop hook which runs only
after the response. A session-start-only rule already exists in `SAFEWORD.md`;
repeating the full Stop template would add unnecessary prompt overhead. The
reminder is sourced from `hooks/lib/quality.ts` so its vocabulary cannot fork
from the Stop contract.

This supersedes 68SRC8's Option-A rejection and the matching
`long-session-style-drift` learning only for the reply-format rule: #1524 is
the recorded revisit trigger, showing that post-response correction arrives too
late. The prior cadence rationale does not apply when Stop is intentionally
suppressed or unavailable. K8D3M4 also resolves the narrow per-turn
reply-format decision in 5ARWDG; that ticket's broader lean-prompt spike remains
open.

## Done When:

- [x] Each Claude `UserPromptSubmit` invocation emits a compact reminder to lead
      with the answer and use the decision brief only for substantive work
      updates.
- [x] The reminder retains `CONFIDENT`, `BLOCKED`, and `Next` as the load-bearing
      terms without copying the Stop hook's full template.
- [x] Existing phase/readiness guidance and Stop-hook validation remain intact.
- [x] Active implement/TDD steps receive only the lead-with-the-answer cue, not
      the decision-brief demand that Stop deliberately suppresses on those turns.
- [x] The compact reminder is exported from `hooks/lib/quality.ts` and uses the
      same `answer` vocabulary as the Stop contract.
- [x] Both anchor lines lead the injected block in a fixed order, asserted by
      position rather than presence, and both carry the `-` bullet prefix.
- [x] The Stop pointer keeps its original one-sentence prose with the shared lead
      rule inline, not appended as a trailing labelled sentence.

## Test Definitions:

- [x] RED — Hook output lacks the proactive reply-format reminder.
- [x] GREEN — Hook output includes the compact reminder for a Safeword project.
- [x] REFACTOR — The reminder is named once, remains concise, and the focused
      hook and quality-message tests stay green.
- [x] RED — An installed hook with an active implement/TDD ticket still emits
      the full decision-brief demand.
- [x] GREEN — That active TDD state emits only the shared lead-with-the-answer
      pointer, while ordinary prompts retain the full compact reminder.
- [x] REFACTOR — The shared quality module owns both forms; no local copy can
      silently drift from the Stop contract.

## Refactor ledger

- [x] Move both reply-format variants into `hooks/lib/quality.ts` so the prompt
  hook and Stop contract share the same answer-first vocabulary. The full
  reminder remains the ordinary case; active implement/TDD receives only the
  shared lead pointer. Verified by installed-hook coverage, quality-contract
  tests, lint/typecheck, template parity, and a follow-up audit.
- The earlier local `REPLY_FORMAT_REMINDER` extraction was deliberately
  superseded during PR review because it did not prevent cross-hook vocabulary
  drift. This scoped cleanup stays in the same commit as the behavior change.
- [x] Extract the repeated real installed `prompt-questions.ts` subprocess
  setup in `packages/cli/tests/integration/hooks.test.ts` into one helper, so
  the ordinary, TDD, and non-Safeword contracts cannot diverge in how they
  invoke the hook.
- [x] Scout disposition: retain the production hook's local line construction
  and phase state flow. A further extraction would add parameters without
  removing duplicated behavior or improving a tested boundary.
- [x] Decouple the active-TDD negative contract from the styling of an
  unrelated phase `Next:` hint. It now rejects the shared full
  `REPLY_FORMAT_REMINDER` directly, so a future bolding change cannot create a
  false regression while the decision-brief reminder remains suppressed.

## Work Log

- 2026-07-27T16:11:23.968Z Started: Created ticket K8D3M4
- 2026-07-27T16:11:23.968Z Revalidated #1524 against fresh origin/main: the
  Stop hook still injects the verbose format template only after a response.
- 2026-07-27T16:11:23.968Z Decided: use the existing UserPromptSubmit hook for
  a compact pre-response reminder; retain Stop as validation backstop.
- 2026-07-27T16:43:53Z RED: confirmed the installed hook did not emit a
  reply-format reminder. Added its integration contract before implementation.
- 2026-07-27T16:43:53Z GREEN: added one concise output line to the existing
  template hook and synchronized the dogfood mirror with `bun run parity:fix`.
- 2026-07-27T16:43:53Z Verified: focused hook integration (58/58), full Vitest
  (5,549 passed; 5 skipped), Gherkin (505 passed; 3 skipped), typecheck, Knip,
  lint, and diff hygiene passed. Independent quality review approved.
- 2026-07-27T16:43:53Z Audit note: `bun run deps:validate` reported only the
  pre-existing `no-orphans` warning for `packages/cli/src/codex-plugin/hooks.ts`.
- 2026-07-27T16:45:51Z Full audit: config sync, dependency-cruiser (0
  violations), Knip, and Go checks passed. The audit recorded 506 baseline
  clones and one low-risk dev-only `markdownlint-cli2` patch update; neither is
  in this ticket's scope.
- 2026-07-27T17:26:02Z Refactor pass: named the reply-format literal
  `REPLY_FORMAT_REMINDER`; behavior is unchanged. Focused hook tests (58/58),
  lint/typecheck, parity, and the follow-up full audit passed. No further
  refactor candidates remain in this scoped hook change.
- 2026-07-27T19:17:12Z PR #1540 review remediation: corrected the superseded
  68SRC8 learning, recorded the narrow resolution in 5ARWDG, moved reply-format
  text into `hooks/lib/quality.ts`, and added an installed-hook implement/TDD
  negative contract. RED failed as expected; GREEN passed 102 focused tests.
- 2026-07-27T19:46:34Z Quality re-review found and corrected only a punctuation
  defect in the shared Stop-header interpolation; an exact regression assertion
  now covers it. Full verification passed: Vitest 5,551 passed (5 skipped),
  Cucumber 505 passed (3 skipped), lint, Gherkin lint, typecheck, template
  parity, diff hygiene, and the follow-up audit all completed.
- 2026-07-27T20:05:46Z Quality-review follow-up approved the final implementation
  and identified one stale verification summary, corrected separately. Refactor
  scout then unified the three installed prompt-hook test launchers behind one
  helper; the real integration suite passed 59/59 with unchanged stdin and
  project-directory behavior.
- 2026-07-27T23:30:00Z Second PR #1540 review pass, polish only (no behavior
  change): replaced the positional `lines.splice(1, 0, …)` with a separate
  `anchors` array concatenated at output, so no later push can displace an
  anchor; restored the Stop pointer's original one-sentence prose by making
  `REPLY_FORMAT_LEAD_RULE` a bare inline fragment (retiring the `answer.,`
  comma-splice guard the interpolation had needed); declared the `-` prefix
  change in Scope with a position-asserting test; refreshed the now-stale
  `hooks/lib/quality.ts` header comment for its third consumer; pinned all three
  pointer exports in the schema contract; normalized the lone `./lib/quality.js`
  type specifier to the `.ts` form this file uses elsewhere; and added the
  K8D3M4 entry plus the corrected token-cost note to the
  `long-session-style-drift` learning. Targeted verification: quality +
  installed-hook suites 104/104, schema/parity 61/61, `bun run lint`
  (eslint + Gherkin + typecheck) clean, `bun run parity:fix` re-synced both
  dogfood mirrors.
- 2026-07-27T23:50:20Z Final review-nit cleanup: replaced the active-TDD
  contract's indirect `**Next:**` absence check with an assertion against the
  shared full `REPLY_FORMAT_REMINDER`, removing coupling to the styling of the
  separate phase next-step hint.
- 2026-07-28T00:33:10Z Final verification: hook plus quality suites passed
  104/104; lint, Gherkin lint, typecheck, template parity (195 pairs and 8
  contracts), and diff hygiene were clean. The first full-suite attempt hit a
  transient connection refusal while installing React fixture dependencies;
  its isolated 11-test suite passed on retry, then a clean full rerun passed
  5,553 tests across all 373 files with 5 skipped.
- 2026-07-28T01:02:07Z Done: user accepted the merged result. PR #1540 was
  green on lint, Node 22, Node 24, and dogfood parity and squash-merged to
  `main` as `2168ed054f`; GitHub issue #1524 closed automatically. Status and
  phase moved to `done`.

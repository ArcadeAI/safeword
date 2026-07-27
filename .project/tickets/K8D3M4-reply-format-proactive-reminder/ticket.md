---
id: K8D3M4
slug: reply-format-proactive-reminder
type: task
phase: verify
status: in_progress
external_issue: https://github.com/ArcadeAI/safeword/issues/1524
created: 2026-07-27T16:11:23.968Z
last_modified: 2026-07-27T17:26:02Z
---

# Surface reply format before Claude responds

**Goal:** Keep substantive Claude work updates in Safeword’s concise decision-brief shape before they reach the user.

**Why:** The current Stop hook can only correct a response after it has already been shown, causing repeated re-teaching and catch-up loops.

**Type:** Improvement

**Scope:** Add a compact reply-format reminder to Claude's existing
`UserPromptSubmit` hook so it reaches the model beside each new user prompt.
Keep the Stop hook's detailed validation as the post-response safety net.

**Out of Scope:** Changing the verdict contract, modifying Cursor or Codex
adapters, adding a new hook, or requiring decision-brief formatting for short
conversational replies.

## User story

As a Safeword user, I want the agent to receive the reply-format rule before it
drafts a substantive work update, so the first response is useful without a
post-hoc rewrite.

## Decision

Use the existing Claude `UserPromptSubmit` hook. Its compact factual reminder
is injected beside the submitted prompt, unlike the Stop hook which runs only
after the response. A session-start-only rule already exists in `SAFEWORD.md`;
repeating the full Stop template would add unnecessary prompt overhead.

## Done When:

- [x] Each Claude `UserPromptSubmit` invocation emits a compact reminder to lead
      with the outcome and use the decision brief only for substantive work
      updates.
- [x] The reminder retains `CONFIDENT`, `BLOCKED`, and `Next` as the load-bearing
      terms without copying the Stop hook's full template.
- [x] Existing phase/readiness guidance and Stop-hook validation remain intact.

## Test Definitions:

- [x] RED — Hook output lacks the proactive reply-format reminder.
- [x] GREEN — Hook output includes the compact reminder for a Safeword project.
- [x] REFACTOR — The reminder is named once, remains concise, and the focused
      hook and quality-message tests stay green.

## Refactor ledger

- [x] Replace the inline reply-format behavioral literal in
  `prompt-questions.ts` with `REPLY_FORMAT_REMINDER`, so the purpose of the
  second hook line is explicit without changing its output. Verified by the
  real-installed-hook suite (58/58), lint/typecheck, template parity, and a
  follow-up audit.
- Commit deferred: this cleanup touches the same template and dogfood files as
  the uncommitted #1524 behavior fix, so it cannot form an honest standalone
  refactor commit.

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

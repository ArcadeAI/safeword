---
id: AKNWZK
slug: cursor-stop-gate-rearchitect
type: task
phase: intake
status: in_progress
epic: cursor-optimization
relates_to: VAX3Z2
---

# Re-architect done/stop gate for Cursor (stop cannot block)

**Goal:** Make the done gate behave correctly on Cursor, where `stop` cannot block — it can only auto-continue via `followup_message`, capped by `loop_limit` (default 5).

**Why:** Safeword's done gate assumes a blocking Stop hook (Claude Code). On Cursor that's impossible; the gate silently degrades to nudging. Make that explicit and deliberate.

## Approach

F2TKR3 removed the `beforeSubmitPrompt` block (it sees only prompt text, so it
deadlocked the prompt that asks for the evidence). So the real enforcement moves
**down** to the edit layer, not up to prompt-send:

- **Edit-layer block (`preToolUse`):** deny the Write that flips `ticket.md` to
  `status: done` unless the done evidence holds. "Full" enforcement — it runs the
  test suite plus the verify.md / scenario checks. Logic is shared with the Claude
  Stop gate via `hooks/lib/done-gate.ts` (`evaluateDoneEvidence`), so the two
  gates can't drift.
- **Stop nudge (`stop`):** keep `followup_message` for the quality-review reminder.
  `loop_limit: 1` is intentional — it's a one-shot reminder (the hook clears its
  edit marker after firing), not a drive-to-done loop, so one auto-continue is
  enough and a higher cap would just re-nudge noisily.
- **Documented divergence:** Claude enforces done at the blocking Stop hook; Cursor
  can't block stop, so it enforces one layer earlier at the close edit. Captured in
  `config.ts` (CURSOR_HOOKS) and `hooks/lib/done-gate.ts`. Cursor mirrors the
  dependency/test/verify/scenario evidence subset; it intentionally omits
  transcript-only Claude checks that are unavailable in Cursor's preToolUse input.

## Done when

- Done-gate behavior on Cursor is defined and implemented (edit-layer block + stop
  nudge), with `loop_limit` set intentionally and the divergence documented.

## Source

cursor.com/docs/hooks (`stop` non-blocking, `loop_limit` default 5 / null)

## Work Log

- 2026-05-31 Created from Cursor research — `stop` is observe-only.
- 2026-06-24 Implemented edit-layer done gate. Extracted `checkVerifyArtifact` +
  new `evaluateDoneEvidence` into `hooks/lib/done-gate.ts` (single source of
  truth); Stop gate now imports it. Cursor `preToolUse` adapter detects a
  `status: done` transition on `ticket.md`, derives the ticket type, and runs the
  full evidence check (deps → tests → verify.md → scenarios), denying on failure.
  Set `preToolUse` `timeout: 90` (close edit runs the suite) and `stop`
  `loop_limit: 1`. Tests: lib unit (`done-gate.test.ts`), adapter helper units
  (`cursor-gate-adapter.test.ts`), and end-to-end (`cursor-pretooluse-gate.test.ts`).
- 2026-06-24 /quality-review (fresh-context pass) → APPROVE, no criticals. Took two
  fixes: match ticket.md by `basename` not `endsWith` (a `*ticket.md` file can no
  longer be mis-gated), and added `done-gate-failing-suite.test.ts` (mocked) to pin
  the "failing suite blocks the close" premise. Known limitation (deferred,
  negligible): if a `status: done` edit's content can't be read, detection fails
  open at the logic layer — only a wrapper crash hits Cursor's `failClosed`. Cursor's
  sole edit tool sends full content, so the multi-line frontmatter is always present.
- 2026-06-24 PR #415 was merged with green CI (`test (node 22)` and `lint`). Merge
  comment follow-ups landed with P9K783: softened the done-gate parity wording to
  name the shared subset, documented the transcript-only Cursor/Claude divergence,
  and made `type: Feature` parse as `feature` so scenario evidence is still required.

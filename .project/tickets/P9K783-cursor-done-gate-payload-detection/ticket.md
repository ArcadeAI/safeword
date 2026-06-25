---
id: P9K783
slug: cursor-done-gate-payload-detection
type: task
phase: intake
status: in_progress
epic: cursor-optimization
relates_to: VAX3Z2
created: 2026-06-25T00:09:51.620Z
last_modified: 2026-06-25T00:09:51.620Z
---

# Prevent the Cursor done gate from silently missing ticket closes

**Goal:** Make the Cursor done gate's "is this edit closing a ticket?" detection robust against Cursor's actual `Write` payload, instead of relying on guessed field names that fail open.

**Why:** The done gate (AKNWZK) only fires when it can read the proposed `ticket.md` content and see `status: done`. Cursor's `preToolUse` `tool_input` shape is undocumented, so detection guesses the field names. If a guess is wrong, the close edit slips through unblocked — the gate silently does nothing, which is the unsafe direction for an enforcement gate.

## Context

Two helpers in `packages/cli/templates/hooks/cursor/gate-adapter.ts` read undocumented Cursor fields:

- `extractFilePath` — tries `file_path | path | target_file`.
- `extractWriteContent` — tries `content | contents | new_string | text | file_text | code`, then falls back to the longest multi-line string value.

If the real field isn't in the list and the fallback picks the wrong value (or none), `detectDoneTransition` returns false and the edit is allowed. Cursor's `failClosed: true` only catches a *crash/timeout*, not a clean "couldn't detect" miss.

## Approach

1. **Verify, don't guess.** Capture a real Cursor `preToolUse` Write payload (a `ticket.md` edit) and pin the actual `tool_input` field names for path and content. Update `PATH_KEYS` / `CONTENT_KEYS` to the verified names (keep the others as tolerant fallbacks).
2. **Decide the miss-direction deliberately.** For a confirmed `ticket.md` edit whose content can't be read at all, choose fail-open vs fail-closed and document it. (Fail-closed on every unreadable ticket.md edit would block ordinary work-log saves, so the likely answer is a narrower signal — e.g. only when a `status:` line is present but unparseable.)
3. **Regression test** the verified field names so a future Cursor payload change is caught.

## Done when

- Path + content field names are verified against a real Cursor payload (not guesswork), with a test pinning them.
- The unreadable-content miss-direction is decided and documented.

## Source

- AKNWZK work log (deferred limitation noted there).
- `packages/cli/templates/hooks/cursor/gate-adapter.ts` (`extractFilePath`, `extractWriteContent`, `detectDoneTransition`).
- Live Cursor payload capture, 2026-06-24 on Cursor `3.8.23`: `preToolUse` `Write` sends `tool_input.file_path` and `tool_input.content` for a `ticket.md` edit.
- Cursor docs, 2026-06-24: `preToolUse` input exposes the generic `tool_input` envelope; file hooks document `file_path`, `content`, and `edits[].new_string`, but the page still does not publish a Write-specific `tool_input` schema.

## Decision

Verified source: a temporary dogfood hook captured a real Cursor `preToolUse` `Write` payload for this ticket file. The path extractor keeps verified `file_path` first. The content extractor keeps verified `content` first and adds documented `edits[].new_string` support before the older guessed fallbacks.

Miss-direction: unreadable `ticket.md` content stays fail-open so ordinary work-log edits do not deadlock. A readable but malformed `status:` line fails closed because safeword can confirm this is a status edit but cannot safely tell whether it is closing the ticket.

## Work Log

- 2026-06-25T00:09:51.620Z Started: Created ticket P9K783
- 2026-06-24 Filed from session review after AKNWZK shipped (PR #415) — the done
  gate's close-detection depends on guessed Cursor payload field names and fails
  open if they're wrong.
- 2026-06-24 Captured a live Cursor `preToolUse` `Write` payload from this
  worktree: Cursor `3.8.23` sends `tool_input.file_path` and `tool_input.content`
  for a `ticket.md` edit.
- 2026-06-24 Implemented payload hardening: `file_path` and `content` are pinned
  by regression tests, `edits[].new_string` is supported as the documented
  file-edit fallback, malformed status lines deny, and unreadable ticket content
  remains allowed by design. Also folded the PR #415 merge-comment follow-up that
  makes `type: Feature` still require feature scenario evidence.
- 2026-06-24 /quality-review found one regression: valid terminal statuses
  (`cancelled`, `superseded`, `wontfix`) were treated as malformed. Fixed by
  accepting the documented non-done statuses and pinning them in unit tests.
- 2026-06-24 Verification: targeted Cursor gate tests passed (38/38), then full
  suite passed (253 files, 3695 tests passed, 3 skipped).
- 2026-06-24 PR #424 follow-up: CI lint caught strict TypeScript errors in
  named regex group handling. Fixed the template and dogfood copies, then reran
  package typecheck and targeted Cursor gate tests.

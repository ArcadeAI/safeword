---
id: S0RYNS
slug: review-turns-that-edited-files
type: task
phase: verify
status: in_progress
created: 2026-08-07T18:22:54.585Z
last_modified: 2026-08-07T18:40:00Z
---

# Review the turns that edited files, even when tool output carries a trailing note

**Goal:** Stop treating a tool-result message as the start of a human turn, so the quality review still fires on turns that changed files.

**Why:** A user message may carry text blocks after its tool_result blocks. That trailing text is read as a human prompt, so the backward scan stops there and the Stop review is skipped on a turn that did edit files.

## Work Log

- 2026-08-07T18:22:54.585Z Started: Created ticket S0RYNS
- 2026-08-07T18:24:00Z RED: `tests/integration/stop-hook-transcript-format.test.ts` — an edited turn whose tool result carries a trailing note (`[tool_result, text]`) exits silently instead of blocking. The hook printed nothing, so the review was skipped on a turn that did edit files.
- 2026-08-07T18:25:00Z GREEN: `humanPromptText` returns '' when the message contains any `tool_result` block — such a message answers a tool call and belongs to the turn already running, whatever text follows. 17/17 in the file. Template, `.safeword` mirror, and generated `plugin/` mirror all synced.
- 2026-08-07T18:27:00Z Mutation check: forcing the new guard to fire on every user message fails exactly the four boundary-detection cases (string-form follow-up, genuine follow-up, reminder-prefixed, notification-prefixed) and leaves the new case green. The guard is scoped, not a blanket short-circuit.
- 2026-08-07T18:45:00Z Verify: full suite 6992 passed / 11 skipped / 12 failed. Ten failures are pre-existing on clean `main` (chmod-based negative paths that cannot fail as uid 0, plus four review-subsystem timing/permission cases from #2003). The remaining two — `setup-convergence` and `rust-golden-path` — pass in isolation both with and without this change and fail only under full-suite parallelism; treated as load flakes, not verified in a full clean-`main` run. Lint, Gherkin lint, `tsc --noEmit`, and build all clean.
- 2026-08-07T18:46:00Z Source check: the API allows text blocks after `tool_result` blocks in one user message — "in the user message containing tool results, the tool_result blocks must come FIRST in the content array. Any text must come AFTER all tool results" (platform.claude.com/docs/en/agents-and-tools/tool-use/handle-tool-calls, fetched this session). That shape is what this ticket fixes.
- 2026-08-07T18:50:38.110Z Phase: intake → verify

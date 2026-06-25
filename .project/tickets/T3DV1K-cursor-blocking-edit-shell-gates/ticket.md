---
id: T3DV1K
slug: cursor-blocking-edit-shell-gates
type: task
phase: intake
status: in_progress
epic: cursor-optimization
relates_to: VAX3Z2
---

# Port phase/LOC gates to Cursor preToolUse + beforeShellExecution deny

**Goal:** Replace observe-only `afterFileEdit` with real blocking: `preToolUse` (deny edits before `test-definitions.md`) and `beforeShellExecution` (LOC/commit gate, dangerous-command policy).

**Why:** `afterFileEdit` can't stop anything — the edit already happened. The phase and LOC gates only enforce via the `before*` blocking events.

## Done when

- `preToolUse` denies edits under the phase-gate condition; `beforeShellExecution` enforces the LOC/commit gate with allow/deny/ask.
- Existing `afterFileEdit` reduced to genuinely-observational duties (lint trigger) or removed if redundant.

## Source

cursor.com/docs/hooks (`preToolUse` permission, `beforeShellExecution` allow/deny/ask)

## Work Log

- 2026-05-31 Created from Cursor research.
- 2026-06-24 Built via the adapter pattern (mirrors `codex/pre-tool-quality.ts`): thin Cursor hooks translate the payload into the Claude gate's shape, spawn `pre-tool-quality.ts` / `post-tool-quality.ts` as the single source of truth, and translate decisions back. New files: `cursor/gate-adapter.ts` (pure translation helpers), `cursor/pre-tool-quality.ts` (`preToolUse`, `Write` matcher — implement-phase + LOC gate), `cursor/before-shell-execution.ts` (commit gate, allow/deny), `cursor/post-tool-quality.ts` (`postToolUse`, `Write|Shell` matcher — maintains the LOC/ticket state the blocking gate reads). `afterFileEdit` left lint-only. **figure-it-out decision (LOC fuel):** the LOC gate reads per-session state written by `post-tool-quality.ts`, which Cursor didn't run; chose to add a `postToolUse` adapter (keyed on `conversation_id`, stable across turns) over inline git-diff (would fork the source of truth) or deferral. Evidence: Cursor docs confirm all agent hooks carry `conversation_id` and `post-tool-quality.ts` recomputes LOC from `git diff` each run. Smoke-verified end-to-end: feature@implement with no test-definitions → deny; with test-definitions → allow; ticket binding via postToolUse works.

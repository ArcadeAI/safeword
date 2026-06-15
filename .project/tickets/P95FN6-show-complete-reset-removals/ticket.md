---
id: P95FN6
slug: show-complete-reset-removals
type: task
phase: intake
status: in_progress
created: 2026-06-15T13:37:06.141Z
last_modified: 2026-06-15T13:37:38Z
---

# Show complete reset removals for users

**Goal:** Make `ReconcileResult.removed` report every file removed during reset/uninstall, including cleanup side effects from unmerge and unpatch executors.

**Why:** Reset summaries should truthfully show users what safeword removed, and dry-run/applied result contracts should not hide files deleted by helper executors.

## Figure-It-Out Decision

Recommend a narrow follow-up task because the issue is a real reporting-contract gap, but fixing it inside the Codex reset cleanup PR would expand scope across planner/executor result semantics. Doing nothing keeps reset output incomplete for `.mcp.json`, future text-patch target deletes, and any cleanup path that removes a file without an explicit `rm` action.

Evidence:

- `reset` prints `result.removed` as the user-facing "Removed" list.
- `executeJsonUnmerge` can remove a file when `removeFileIfEmpty` is true, but it does not add that path to `ExecutionResult.removed`.
- `executeTextUnpatch` can now remove a text-patch target when remaining content matches known scaffold, but it does not add that path to `ExecutionResult.removed`.
- CLI guidance favors useful, truthful, concise output; hidden deletes make reset harder to audit.

## Scope

In scope:

- Define `ReconcileResult.removed` as the list of files/directories actually removed by explicit actions and cleanup side effects.
- Update `json-unmerge` deletion reporting for `removeFileIfEmpty`.
- Update `text-unpatch` deletion reporting for `removeFileIfContentEquals`.
- Add focused tests for applied reset results and reset summary output where practical.

Out of scope:

- Changing Codex hook cleanup behavior.
- Parsing TOML or JSON to report partial key removals as file removals.
- Redesigning the full reconcile action/result model.

## Acceptance Criteria

- [ ] When `.mcp.json` is deleted because safeword MCP servers were its only content, `result.removed` contains `.mcp.json`.
- [ ] When `.codex/config.toml` is deleted because only safeword scaffold remains after text-unpatch, `result.removed` contains `.codex/config.toml`.
- [ ] When `.codex/config.toml` contains user config and only safeword hook blocks are removed, `result.removed` does not contain `.codex/config.toml`.
- [ ] `safeword reset --yes` includes cleanup-side deleted files in its "Removed" summary.
- [ ] Existing reset/uninstall behavior remains unchanged except for more complete reporting.

## Work Log

- 2026-06-15T13:37:38Z Found: Figure-it-out picked a separate task over expanding the Codex reset cleanup PR; this touches reconcile result semantics beyond the current patch.
- 2026-06-15T13:37:06.141Z Started: Created ticket P95FN6

---
id: 3DD2P0
slug: protect-cursor-hook-bootstrap
type: task
phase: intake
status: in_progress
created: 2026-10-20T03:20:13.268Z
last_modified: 2026-10-20T03:20:13.268Z
---

# Protect Cursor checks from project runtime shims

**Goal:** Make the outer Cursor runClaudeHook bootstrap use a trusted runtime and retain a regression proving that project PATH shims cannot bypass the shared gate.

**Why:** The 3J7TGR installed-adapter probe executed a project-owned bun shim before reaching shared planning validation. This is a separate deferred bootstrap boundary; see integration-review.md and review 86233b69-aaa3-4351-a6f7-21d0814b9f6a.

## Work Log

- 2026-10-20T03:20:13.268Z Started: Created ticket 3DD2P0

## Reproduction and boundary

Related delivery: [3J7TGR](../3J7TGR-deliver-5041-planning-contracts/ticket.md).
Read [its investigation](../3J7TGR-deliver-5041-planning-contracts/integration-review.md)
and retained failed probes before implementation. The concrete path is
`packages/cli/templates/hooks/cursor/gate-adapter.ts: runClaudeHook`, whose
`spawnSync('bun', ...)` runs before the shared hook. A project-owned PATH shim
was executed in the installed adapter probe. The shared-hook regression is
green under a trusted launcher; it does not close this outer bootstrap gap.

This is future work, not part of PR #5957's implementation or a declaration
that native Cursor hostile-PATH parity is proven.

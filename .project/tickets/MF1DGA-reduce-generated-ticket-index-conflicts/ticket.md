---
id: MF1DGA
slug: reduce-generated-ticket-index-conflicts
type: task
phase: intake
status: in_progress
created: 2026-06-24T14:49:00.438Z
last_modified: 2026-06-24T14:52:28.000Z
---

# Reduce generated ticket index merge conflicts

**Goal:** Reduce avoidable merge conflicts from the tracked generated ticket index.

**Why:** Active PR traffic repeatedly touches `.project/tickets/INDEX.md`; unrelated branches can conflict even when their only overlap is generated ticket metadata.

## Problem

During PR #387 conflict resolution on 2026-06-24, the only merge conflict after catching up to `origin/main` was `.project/tickets/INDEX.md`. The safe resolution was to regenerate it with:

```sh
bun packages/cli/src/cli.ts sync-tickets --quiet
```

That worked, but it is a recurring rough edge: generated, tracked indexes are high-churn files, so unrelated ticket additions or status edits on parallel branches can force manual conflict handling.

## Observed Environment

- Date observed: 2026-06-24
- Worktree: `/Users/alex/.codex/worktrees/222a/safeword`
- Branch: `codex/revalidate-verify-audit-main`
- PR: #387
- Local head when filed: `02c95d351d3392215be21a8db6d9d94d23658e05`
- Base `origin/main`: `48e52173b3a3ec978cebe79793046f6a7afa3d08`
- OS: macOS 26.5.1 (25F80), `arm64`
- Shell: zsh 5.9
- Bun: 1.3.14
- Node: v24.16.0
- Safeword: CLI v0.55.0, project config v0.55.0

## Acceptance Criteria

- [ ] Decide and document whether `.project/tickets/INDEX.md` should remain tracked, move to generated-on-demand/CI output, or be structured to minimize cross-branch conflicts.
- [ ] The chosen workflow makes the correct conflict resolution obvious to a contributor or agent catching a branch up to `main`.
- [ ] `safeword check`, `sync-tickets`, or related ticket tooling detects stale or conflicted index state and points to the right fix.
- [ ] Regression coverage exercises independent ticket/index changes converging across branches, or an equivalent lower-level test that proves the index strategy is deterministic and low-conflict.
- [ ] Existing ticket lookup and index readability are preserved.

## Related Files

- `.project/tickets/INDEX.md`
- `packages/cli/src/commands/sync-tickets.ts`
- Ticket/index tests under `packages/cli/tests/`

## Root Cause

The index is generated from ticket folders but committed as a shared file. Any branch that creates, edits, or closes tickets can modify adjacent generated lines, producing conflicts unrelated to the user-facing code change.

## Work Log

- 2026-06-24T14:52:28Z Updated: Added observed environment for the PR #387 conflict/revalidation run.
- 2026-06-24T14:51:30Z Filed: Captured PR #387 catch-up rough edge where `.project/tickets/INDEX.md` was the only conflict and required regeneration.
- 2026-06-24T14:49:00.438Z Started: Created ticket MF1DGA

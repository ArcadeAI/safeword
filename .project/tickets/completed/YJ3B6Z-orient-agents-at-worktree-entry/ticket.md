---
id: YJ3B6Z
slug: orient-agents-at-worktree-entry
type: patch
phase: done
status: done
created: 2026-08-03T01:21:05.998Z
last_modified: 2026-08-03T05:57:32Z
external_issue: https://github.com/ArcadeAI/safeword/issues/1780
---

# Orient agents at worktree entry

**Goal:** Let agents begin useful work from the correct repository root without speculative path probes.

**Why:** Safe Word documents root moves only for Cursor, leaving Claude and Codex worktree entry ambiguous.

**Type:** Micro

**Scope:** Replace the Cursor-only root-move note with a host-neutral worktree-entry contract that tells agents to verify the repository root before probing project paths and to use the generated architecture index for monorepo layout.

**Out of Scope:** Changing host worktree creation, generating new context files, or auto-changing the shell working directory.

**Done When:**

- [x] Shipped and dogfood SAFEWORD context gives Claude, Cursor, and Codex the same worktree-entry orientation.

**Tests:**

- [x] A focused template contract test covers the root check, speculative-path prohibition, and architecture-index pointer.

## Work Log

- 2026-08-03T01:21:05.998Z Started: Created ticket YJ3B6Z
- 2026-08-03T01:23:00Z Revalidated: Current main still limits root-orientation guidance to Cursor root moves; Claude and Codex worktree entry remains unspecified.
- 2026-08-03T01:23:00Z Planned: Generalize the standing rule in the canonical template and dogfood copy, guarded by a focused content-contract test.
- 2026-08-03T01:24:00Z RED: Focused worktree-entry context test failed for both canonical and dogfood SAFEWORD copies because the guidance remained Cursor-only.
- 2026-08-03T01:24:00Z Implemented: Added an all-host session/worktree entry check, prohibited speculative package probes, and pointed monorepo discovery at the generated architecture index.
- 2026-08-03T02:05:00Z Verified: Focused contract tests pass across canonical and dogfood guidance; lint, typecheck, formatting, and diff checks pass. Fresh quality review approved the change with no critical findings.
- 2026-08-03T05:41:11Z Closeout review: Revalidated live issue #1780 against current main. Fresh independent quality review APPROVED with no critical issues and suggested stronger command-component assertions; added them. Refactor scout found the guidance already minimal and identified no production refactor. Full verification and diff-scoped audit pass; the only initial suite failure was a stale Cursor-only setup expectation, which was updated to the host-neutral contract before the full suite reran green. Advanced to verify pending user confirmation.
- 2026-08-03T05:57:32Z Completed: User authorized closeout. Final release-config verification passed 5/5, all review suggestions are incorporated, and the ticket is ready to ship through the closing pull request.

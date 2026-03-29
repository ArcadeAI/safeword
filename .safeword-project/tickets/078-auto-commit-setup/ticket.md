---
id: '078'
slug: auto-commit-setup
title: 'Auto-commit after safeword setup and upgrade'
type: Improvement
status: open
epic: setup-lifecycle
---

# Task: Auto-commit after safeword setup and upgrade

**Type:** Improvement

**Scope:** After `safeword setup` and `safeword upgrade` complete successfully, auto-commit the generated/updated files. Prevents safeword's own output from triggering its own LOC gate in the user's next session.

**Out of Scope:** Changing what files setup/upgrade generate, modifying the LOC gate threshold, requiring user confirmation (should be automatic).

**Context:** Dogfooding on ArcadeAI/monorepo: `safeword setup` generated ~53 files (~4,700 lines). The user's next Claude session immediately hit the LOC gate because those uncommitted lines exceeded the 400-line threshold. The user had to manually commit safeword's own config before they could make any edits. Ticket 074 mitigates this by excluding tooling paths from the LOC count, but auto-committing is the cleaner fix — safeword should clean up after itself.

**Note:** `ensurePackInstalled()` in `lib/lint.ts` already auto-commits after upgrade. This ticket extends that pattern to the CLI commands themselves.

## Implementation

After setup/upgrade completes successfully:

1. Collect the full file list from all sources: `ReconcileResult.created`/`.updated` (schema files), `archFiles` (depcruise configs), and `workspaceUpdates` (package.json scripts). These are already aggregated in `printResults()` — use the same combined list. **Note:** `pythonFiles` is dead code (always `[]`) — Python configs were already moved into the schema as `managedFiles`. Remove the vestigial `pythonFiles` return value, its type (`PythonSetupStatus.files`), and the code paths that handle it.
2. `git add` exactly those files, then `git commit -m "chore: safeword setup v{version}"` (or `"chore: safeword upgrade v{version}"`)
3. If not a git repo or commit fails, warn and continue (don't block setup)
4. Replace the "Commit the new files to git" next-steps message with a success message confirming the auto-commit
5. Support `--no-commit` flag to opt out (respects users who want to review before committing)

## Files

- `packages/cli/src/commands/setup.ts` — add auto-commit after setup completes
- `packages/cli/src/commands/upgrade.ts` — add auto-commit after upgrade completes

**Done When:**

- [ ] `safeword setup` auto-commits its output on success
- [ ] `safeword upgrade` auto-commits its output on success
- [ ] Non-git-repo gracefully skips commit with a warning
- [ ] User-owned files (learnings, logs, tickets) are excluded from auto-commit
- [ ] Dead `pythonFiles` return value removed from setup flow

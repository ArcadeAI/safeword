---
id: '074'
slug: loc-gate-exclude-tooling
title: 'LOC gate should exclude safeword/tooling files from line count'
type: Bug
status: done
epic: setup-lifecycle
---

# Task: LOC gate should exclude safeword/tooling files from line count

**Type:** Bug

**Scope:** The `countLoc()` function in `post-tool-quality.ts` uses `git diff --stat HEAD` which counts ALL uncommitted lines, including `.safeword/`, `.claude/`, and `.cursor/` files. After `safeword setup` generates ~50+ config files (~993 lines), the LOC gate immediately fires and blocks user edits before they've written a single line of project code.

**Out of Scope:** Changing the LOC threshold (400), modifying the pre-tool enforcer's META_PATHS skip logic (already correct), auto-committing after setup.

**Context:** Discovered dogfooding on ArcadeAI/monorepo. User ran `safeword setup`, started a new Claude session, and the first Python/TS edits were blocked because the setup output (~993 uncommitted lines) tripped the LOC gate. The pre-tool enforcer already knows to skip edits to META_PATHS files — but the post-tool observer counts them in the LOC total anyway.

**Root Cause:** `countLoc()` in `post-tool-quality.ts` (line 73) runs `git diff --stat HEAD` unfiltered. Should exclude tooling paths matching the same META_PATHS pattern the enforcer already uses.

**Fix:** Change `countLoc()` to use `git diff --stat HEAD -- ':!.safeword/' ':!.claude/' ':!.cursor/'` (git pathspec exclude syntax), so tooling config files don't inflate the line count.

**Done When:**

- [ ] `countLoc()` excludes `.safeword/`, `.claude/`, `.cursor/` from line count
- [ ] After `safeword setup`, LOC gate does not fire until user edits ~400 lines of project code
- [ ] Existing LOC gate behavior unchanged for project code

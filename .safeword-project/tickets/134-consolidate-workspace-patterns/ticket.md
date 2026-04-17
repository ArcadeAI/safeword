---
id: '134'
slug: consolidate-workspace-patterns
title: 'Refactor: consolidate duplicate getWorkspacePatterns in detect.ts'
type: patch
phase: done
status: done
priority: low
created: 2026-04-17T13:47:00Z
last_modified: 2026-04-17T13:47:00Z
scope:
  - Replace getWorkspacePatternsFromPackage() in presets/typescript/detect.ts with shared getWorkspacePatterns() from utils/workspaces.ts
out_of_scope:
  - Changing getMonorepoPatterns() logic (hardcoded fallback patterns are detect-specific)
  - Touching workspace resolution or filtering logic
done_when:
  - detect.ts imports getWorkspacePatterns from utils/workspaces.ts
  - getWorkspacePatternsFromPackage is deleted from detect.ts
  - Existing tests pass without modification
---

# Refactor: consolidate duplicate getWorkspacePatterns in detect.ts

**Goal:** Single source of truth for reading workspace patterns from package.json.

## Problem

`presets/typescript/detect.ts:82-95` has `getWorkspacePatternsFromPackage()` which duplicates the shared `getWorkspacePatterns()` added in ticket 132 (`utils/workspaces.ts:18-25`). Same logic (array + Yarn object format), different error handling style.

## Solution

Replace the local function with the shared import. Note: `getMonorepoPatterns()` in detect.ts adds hardcoded fallback patterns (`apps/*`, `packages/*`) — that logic stays in detect.ts, it just calls the shared util instead of its own copy.

## Work Log

- 2026-04-17T13:47:00Z Created from ticket 132 quality review.
- 2026-04-17T14:03:00Z Done: deleted getWorkspacePatternsFromPackage(), getMonorepoPatterns() now calls shared getWorkspacePatterns(). All tests pass.

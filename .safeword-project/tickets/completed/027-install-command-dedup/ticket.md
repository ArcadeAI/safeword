---
id: 027
type: task
phase: done
status: done
created: 2026-03-01T00:00:00Z
last_modified: 2026-03-01T00:00:00Z
---

# Consolidate package manager command mapping

**Goal:** Replace 3 functions with identical Record<PackageManager, ...> patterns with a single data structure.

**Why:** getInstallArguments, getInstallCommand, and getUninstallCommand in install.ts each create their own Record mapping. Adding a new package manager means editing 3+ places.

## Files

- `packages/cli/src/utils/install.ts`

## Approach

Define a single `PM_COMMANDS` record mapping each package manager to its install/uninstall args. Derive display commands from the data.

## Work Log

- 2026-03-01T00:00:00Z Complete: Replaced 3 Record functions with single PM_COMMANDS, -19 lines (refs: e39d359)

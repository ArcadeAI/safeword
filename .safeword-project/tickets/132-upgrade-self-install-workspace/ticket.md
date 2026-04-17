---
id: '132'
slug: upgrade-self-install-workspace
title: 'Fix: upgrade self-installs as workspace:* in monorepos'
type: patch
phase: implement
status: in_progress
priority: high
created: 2026-04-17T04:14:00Z
last_modified: 2026-04-17T04:14:00Z
scope:
  - Filter workspace member package names from computePackagesToInstall so upgrade/setup never installs a package already provided by a workspace member
out_of_scope:
  - Changing schema.packages.base (safeword must remain a base package for customer installs)
  - Workspace-aware package removal logic
  - Any changes to the publish pipeline
done_when:
  - computePackagesToInstall excludes packages that are workspace members
  - safeword upgrade in the safeword monorepo does not add "safeword" to devDependencies
  - safeword setup/upgrade in a non-workspace customer project still installs safeword from npm
  - Tests cover workspace filtering, non-workspace passthrough, and multi-member workspaces
---

# Fix: upgrade self-installs as workspace:\* in monorepos

**Goal:** Prevent `computePackagesToInstall` from listing packages that are already provided by workspace members.

## Problem

`typescriptPackages.base` includes `'safeword'` (every customer project needs it as a devDep for ESLint plugin bundling). When running `safeword upgrade` inside the safeword monorepo itself, `safeword` is not in root devDeps (intentionally removed in `07a9354`), so the upgrade runs `bun add -D safeword` which resolves to `workspace:*` — a circular self-reference.

## Solution

Option B from design review: filter workspace member names from the install list in `computePackagesToInstall`.

1. Extract `getWorkspacePatterns()` from `setup.ts` to shared util (`utils/workspaces.ts`)
2. Add `getWorkspacePackageNames(cwd): Set<string>` — resolve patterns, read each member's `package.json` name
3. Filter workspace member names in `computePackagesToInstall`

## Work Log

- 2026-04-17T04:14:00Z Created: Discovered during dogfood upgrade to v0.29.0. `bun add -D safeword` added `workspace:*` to root package.json. Reverted manually.

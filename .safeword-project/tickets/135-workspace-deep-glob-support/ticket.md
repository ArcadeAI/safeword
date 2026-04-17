---
id: '135'
slug: workspace-deep-glob-support
title: 'Enhancement: support nested glob patterns in workspace resolution'
type: patch
phase: intake
status: open
priority: low
created: 2026-04-17T13:47:00Z
last_modified: 2026-04-17T13:47:00Z
scope:
  - Enhance resolvePattern in utils/workspaces.ts to handle ** and multi-level glob patterns
out_of_scope:
  - Negative glob patterns (e.g. !**/excluded/**)
  - pnpm-workspace.yaml support
  - Adding external glob dependencies without justification
done_when:
  - resolvePattern handles patterns like packages/**/*, apps/*/packages/*
  - Existing single-level patterns (packages/*) still work identically
  - Tests cover nested glob resolution
---

# Enhancement: support nested glob patterns in workspace resolution

**Goal:** Handle workspace patterns beyond single-level `dir/*` globs.

## Problem

`resolvePattern` in `utils/workspaces.ts:45-52` only handles `/*` suffix patterns (one directory level). Bun supports full glob syntax including `**` and negative patterns. If a customer uses `packages/**/sub` or `apps/*/packages/*`, workspace members silently won't be detected, and `computePackagesToInstall` may try to install packages already provided by the workspace.

## Solution

TBD — evaluate whether Node's built-in `fs.globSync` (added in Node 22) or a lightweight glob expansion is appropriate. The project requires Node >=20, so this may need a compatibility check or the `glob` package.

## Work Log

- 2026-04-17T13:47:00Z Created from ticket 132 quality review. Low priority — most monorepos use single-level patterns.

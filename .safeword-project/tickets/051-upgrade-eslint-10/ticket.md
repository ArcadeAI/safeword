---
id: 051
slug: upgrade-eslint-10
type: task
status: backlog
phase: intake
---

# Upgrade ESLint 9 → 10

**Goal:** Upgrade `eslint` from 9.39.4 to 10.x.

## Why

ESLint 10 is a major version — deferred from audit 2026-03-22 due to potential breaking changes in flat config, plugin APIs, or rule behaviour.

## Research Needed

- ESLint 10 changelog and migration guide
- Check all eslint plugins in use for ESLint 10 compatibility:
  - `@typescript-eslint/eslint-plugin` and `@typescript-eslint/parser`
  - `eslint-plugin-unicorn`
  - `eslint-plugin-import-x`
  - Any others in `package.json`
- Test lint pipeline after upgrade: `bun run lint`

## Work Log

- 2026-03-22 Created from audit. Current: 9.39.4, latest: 10.1.0.

---
id: 052
slug: upgrade-knip-6
type: task
status: done
phase: done
---

# Upgrade knip 5 → 6

**Goal:** Upgrade `knip` from 5.88.1 to 6.x.

## Why

knip 6 is a major version — deferred from audit 2026-03-22 due to potential breaking changes in config schema, reporter format, or dead-code detection behaviour.

## Research Needed

- knip 6 changelog and migration guide
- Check `knip.json` config compatibility with v6 schema
- Run `bunx knip` after upgrade and verify output matches expectations
- Check for any `ignoreDependencies`/`ignoreUnresolved` entries that may need updating

## Work Log

- 2026-03-22 Created from audit. Current: 5.88.1, latest: 6.0.1.

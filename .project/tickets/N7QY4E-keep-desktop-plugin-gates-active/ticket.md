---
id: N7QY4E
slug: keep-desktop-plugin-gates-active
type: task
phase: implement
status: in_progress
created: 2026-10-21T15:05:13.253Z
last_modified: 2026-10-21T15:05:13.253Z
---

# Keep quality gates active for Claude desktop users

**Goal:** Accept equivalent skill front matter after organization sync while rejecting changed skill content and runtime files

**Why:** Claude desktop normalizes skill YAML and raw byte hashes disable every Safeword hook

## Work Log

- 2026-10-21T15:05:13.253Z Started: Created ticket N7QY4E

## Root Cause

The catalogue seals every asset using raw SHA-256. Both `verifyInventoryAsset`
and `assertInstalledAsset` compare only those bytes. Claude desktop's YAML
reserialization changes the exposed skill header, so validation aborts before
hook execution. A cache-root mismatch cannot explain the exact named asset and
observed hash; reinstall damage is ruled out by the repeatable equivalent YAML
transformation described in #6004.

Keep raw hashes for compatibility and add an optional semantic skill digest,
computed from parsed metadata and the exact body. Use one helper in generation,
dispatch, and status. Do not ignore front matter: metadata changes affect tools
and invocation policy. Limit normalization to exposed `skills/*/SKILL.md`.

## Tests

- [ ] RED: reproduce normalized audit skill disabling generated hooks.
- [ ] GREEN: normalized skill runs and records execution proof.
- [ ] Status accepts the same normalized cache.
- [ ] Metadata/body/runtime mutations and malformed YAML remain rejected.
- [ ] Generated surfaces, types, lint, and relevant plugin suites pass.

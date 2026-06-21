---
id: 4JMBXT
slug: dep-readiness-mtime-stale
type: patch
phase: intake
status: in_progress
created: 2026-06-21T15:19:39.648Z
last_modified: 2026-06-21T15:19:39.648Z
---

# dependency-readiness false-positive stale after rebase (mtime vs content)

**Goal:** Make the dependency-readiness stale decision content-based (fingerprint marker) so rebase/checkout/clone no longer falsely block dependency-backed commands.

**Why:** GH #282 — pure-mtime staleness reports "stale forever" after any content-preserving op + no-op `bun ci`, hard-blocking the test/lint toolchain with only `touch node_modules` as escape.

## Work Log

- 2026-06-21T15:19:39.648Z Started: Created ticket 4JMBXT (retroactive; fix already implemented + pushed)
- 2026-06-21 Context: fix committed as 5f1a166 on branch claude/github-issue-282-pyebfb before ticket existed (jumped straight to impl because issue carried a complete figure-it-out decision).
- 2026-06-21 Design (per #282 comment): content-fingerprint marker `node_modules/.safeword-deps-fingerprint`, stamped on `ready` by hooks; getDependencyReadiness short-circuits ready on marker==fingerprint, mtime demoted to bootstrap fallback. Applied to template + .safeword mirror (parity clean). Tests: rebase-suppressed + real-change-detected. 51/51 hook tests pass.
- 2026-06-21 Now running full QC: verify → quality-review → audit → refactor.

---
id: 4JMBXT
slug: dep-readiness-mtime-stale
type: patch
phase: done
status: done
created: 2026-06-21T15:19:39.648Z
last_modified: 2026-06-21T16:21:24.027Z
---

# dependency-readiness false-positive stale after rebase (mtime vs content)

**Goal:** Make the dependency-readiness stale decision content-based (fingerprint marker) so rebase/checkout/clone no longer falsely block dependency-backed commands.

**Why:** GH #282 — pure-mtime staleness reports "stale forever" after any content-preserving op + no-op `bun ci`, hard-blocking the test/lint toolchain with only `touch node_modules` as escape.

## Work Log

- 2026-06-21T15:19:39.648Z Started: Created ticket 4JMBXT (retroactive; fix already implemented + pushed)
- 2026-06-21 Context: fix committed as 5f1a166 on branch claude/github-issue-282-pyebfb before ticket existed (jumped straight to impl because issue carried a complete figure-it-out decision).
- 2026-06-21 Design (per #282 comment): content-fingerprint marker `node_modules/.safeword-deps-fingerprint`, stamped on `ready` by hooks; getDependencyReadiness short-circuits ready on marker==fingerprint, mtime demoted to bootstrap fallback. Applied to template + .safeword mirror (parity clean). Tests: rebase-suppressed + real-change-detected. 51/51 hook tests pass.
- 2026-06-21 Now running full QC: verify → quality-review → audit → refactor.
- 2026-06-21 VERIFY: full suite 3183 passed / 5 skipped (211 files); tsup build success; gherkin 69/69; eslint+gherkin-lint+typecheck clean; dep drift clean (no new deps).
- 2026-06-21 QUALITY-REVIEW: independent fresh-context reviewer → APPROVE, 0 critical. Confirmed marker can't mask a real content change (mismatch falls through to mtime); trim/newline round-trips; no scan/gitignore pollution. Acted on its one real gap → added hook-level marker-stamp integration test + unsupported no-op guard test (commit fb311f2). 53/53 hook tests.
- 2026-06-21 AUDIT: scoped to diff — no new cross-module imports/cycles (depcruise covers packages/\*/src only, not templates/hooks); jscpd 0 clones; no dead code (writeInstallMarker used by 2 hooks + tests). Repo-wide knip/outdated left as pre-existing, out of patch scope. Audit passed.
- 2026-06-21 REFACTOR: one ledger entry — duplicate `ready` return literal in getDependencyReadiness. Collapsed to "stale only when !markerFresh && mtime-stale; else ready" (commit 00a66ca). Behavior-identical (truth table preserved), also skips statSync when marker matches. 53/53 green.
- 2026-06-21 Phase=done. Awaiting user confirmation before status=done.
- 2026-06-21 DONE: PR #315 CI green (lint + test node 22); admin squash-merged to main as cbac55e. Closes #282. status=done per user.

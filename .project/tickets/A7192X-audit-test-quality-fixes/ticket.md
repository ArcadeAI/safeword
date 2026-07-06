---
id: A7192X
slug: audit-test-quality-fixes
type: task
phase: intake
status: in_progress
created: 2026-07-06T03:42:50.504Z
last_modified: 2026-07-06T03:42:50.504Z
scope:
  - golden-path graceful-handling tests assert exit code, on-disk content, and output
  - git.test no-op cases assert an unchanged index / surviving file
  - config.test.ts per-internal-call tests deduped into one it.each contract table
out_of_scope:
  - full behavioral rewrite of config codegen tests (golden-path already covers behavior)
  - other files sampled clean by the audit
done_when:
  - the four audit findings no longer reproduce and the three suites pass
---

# Strengthen weak assertions flagged by the full audit

**Goal:** The four audit test-quality findings no longer reproduce: golden-path graceful-handling tests and git.test no-op cases assert observable outcomes, config.test.ts stops pinning codegen internals and dedups via it.each

**Why:** Audit sampling found tests that pass regardless of behavior: not.toThrow-only assertions can't catch silent corruption, and config.test.ts's one-assert-per-internal-call pattern breaks on harmless refactors while proving nothing behavioral

## Work Log

- 2026-07-06T03:42:50.504Z Started: Created ticket A7192X
- Fixed all four audit findings: golden-path graceful tests assert exit 0 + byte-identical content + surfaced/silent output; git.test no-op cases assert an unchanged index against a seeded tracked file (and on-disk survival outside a repo); config.test.ts's ten per-internal-call tests collapsed into one it.each contract table routing behavioral coverage to golden-path. 52/52 tests pass across the three suites

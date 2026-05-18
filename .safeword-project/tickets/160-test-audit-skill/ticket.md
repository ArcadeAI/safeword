---
id: 160
type: task
phase: intake
status: in_progress
created: 2026-05-18T05:41:00Z
last_modified: 2026-05-18T05:41:00Z
scope: |
  Create a new `/test-audit` skill that EXECUTES the test-quality criteria
  currently described as prose in /audit. Checks to implement:
  - Weak assertions: toBeTruthy/toBeDefined/not.toThrow without specific value
  - Test independence: shared mutable state across tests (variables hoisted
    above describe, mutation patterns)
  - Arbitrary timeouts: sleep(), waitForTimeout() with hardcoded ms
  - Happy-path only: no error case tests for exported functions
  - Duplicate tests: similar tests that should use it.each / parameterized
  - Test naming: names describing implementation ("works", "is correct") not
    behavior ("returns 401 when...")
  - Skipped tests without rationale (`.skip` / `.xfail` without comment)
  Implementation: AST-based via existing eslint plugins (eslint-plugin-vitest,
  eslint-plugin-jest) plus targeted grep for cross-cutting patterns.
  Register the skill in SAFEWORD_SCHEMA.ownedFiles.
out_of_scope: |
  - Mutation testing (separate, larger effort)
  - Coverage gap analysis (could be a future iteration)
  - Removing the test-quality section from /audit (keep as smell signal,
    /test-audit is the deep-dive sibling)
  - Auto-fixing test smells (read-only flagging + suggestions)
done_when: |
  - .claude/skills/test-audit/SKILL.md created and registered in schema
  - Cursor rule + command for parity with other action skills
  - Running /test-audit on safeword's own test suite produces a non-empty,
    accurate report (some smells will likely exist)
  - Differentiation from /audit documented in the skill's prose
  - Differentiation from /tdd-review documented (suite-wide vs per-test-cycle)
---

# /test-audit: sibling skill executing test-quality criteria

**Goal:** A user-invoked deep-dive into test quality, parallel to /audit's structural sweep.

**Why:** /audit currently describes test-quality criteria but doesn't execute them. Splitting them into a dedicated skill keeps /audit fast and focused while letting test-quality go deep (AST analysis, smell detection) without bloating the done-gate runtime. Layered with /tdd-review (per-test discipline) and the `testing` knowledge skill (how to write good tests).

## Work Log

- 2026-05-18T05:41:00Z Started: ticket created from 152 audit-skill improvement debate

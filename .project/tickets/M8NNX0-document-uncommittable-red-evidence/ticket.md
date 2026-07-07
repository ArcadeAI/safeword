---
id: M8NNX0
slug: document-uncommittable-red-evidence
type: task
phase: intake
status: in_progress
created: 2026-07-07T04:44:45.942Z
last_modified: 2026-07-07T04:49:06Z
external_issue: https://github.com/ArcadeAI/safeword/issues/586
---

# Document uncommittable RED evidence path

**Goal:** Make the TDD instructions explicitly handle RED states that cannot be committed because structural quality gates reject partial code.

**Why:** Issue #586 shows the current RED-commit rule conflicts with lint/typecheck gates for type-only scaffolds and atomic interface renames.

## Work Log

- 2026-07-07T04:44:45.942Z Started: Created ticket M8NNX0
- 2026-07-07T04:45:30Z Decided: Use a documented `RED skip:` evidence path for structurally uncommittable partial states. Do not weaken lint/typecheck or add a broad hook bypass.
- 2026-07-07T04:47:48Z Implemented: Added the `RED skip:` evidence path to the BDD TDD guidance in the template and dogfood-installed skill copies.
- 2026-07-07T04:49:06Z Verified: `SAFEWORD_TEST_LOCK_MAX_WAIT_MS=0 bun run test tests/hooks/reconciliation-documentation.test.ts` passed, and `SAFEWORD_TEST_LOCK_MAX_WAIT_MS=0 bun run test --config vitest.release.config.ts tests/dogfood-parity.release.test.ts` passed.

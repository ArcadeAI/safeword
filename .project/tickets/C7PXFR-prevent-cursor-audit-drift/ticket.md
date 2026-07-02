---
id: C7PXFR
slug: prevent-cursor-audit-drift
type: task
phase: verify
status: in_progress
created: 2026-07-02T00:02:43.735Z
last_modified: 2026-07-02T03:06:39Z
external_issue: https://github.com/ArcadeAI/safeword/issues/597
scope:
  - Route Cursor `/audit` through the canonical audit skill so structural-drift updates cannot be missed by a fat command copy.
  - Keep the existing physical `.cursor/commands/audit.md` install target, matching F1HTQ4's generated-wrapper architecture.
  - Update tests that currently expect the Cursor audit command to duplicate the full audit body.
out_of_scope:
  - Migrating action commands to `.cursor/skills/`.
  - Changing the audit skill behavior itself.
  - Reworking `/verify` or other fat action commands.
done_when:
  - The shipped Cursor audit command is generated from wrapper metadata and points at the canonical audit skill.
  - Tests fail if Cursor audit becomes a fat duplicate again.
  - Focused schema/parity/audit tests pass.
---

# Prevent Cursor audit command drift

**Goal:** Prevent Cursor `/audit` from silently missing canonical audit skill updates.

**Why:** Issue #597 shows structural-drift audit checks landed in the skill but not the fat Cursor command shipped to customers.

## Work Log

- 2026-07-02T03:06:39Z Final verification: after resolving the unrelated default-suite setup timeout under SFQ1EQ, `bun run lint`, `bun run typecheck`, full `bun run test`, and `bun run test:bdd` all passed. Full Vitest result: 280 files passed, 4097 tests passed, 3 skipped, in 945.02s. BDD result: 181 scenarios and 3414 steps passed in 1m 59.569s.
- 2026-07-02T01:43:19Z Refactor: trimmed the audit-specific schema regression test so it only locks the issue-specific invariant (`audit` remains registered in `CURSOR_COMMAND_WRAPPERS`); the existing generated-wrapper test remains the single source for schema/template/dogfood content assertions. Verification: `bun run --cwd packages/cli test tests/schema.test.ts` passed (32 tests); `git diff --check` passed. Refactor commit deferred because the worktree is detached and the same file contains the broader uncommitted #597 implementation.
- 2026-07-02T01:39:08Z Quality-review: no blocking issues. Rechecked GitHub #597 (still open, no comments) and current Cursor docs for Agent Skills / slash-command migration. Confirmed the broader `.cursor/skills` direction remains out of scope for this ticket and the generated physical command wrapper matches local F1HTQ4 architecture. Extra wiring check: `bun run --cwd packages/cli test tests/integration/skills-commands-validation.test.ts -t "Cursor"` passed (128 tests, 468 skipped).
- 2026-07-02T00:14:25Z Implemented: registered Cursor `/audit` as a generated command wrapper pointing at `.claude/skills/audit/SKILL.md`, removed the manual schema entry, regenerated template and dogfood command files, and updated tests so audit automation assertions read the canonical skill instead of the wrapper.
- 2026-07-02T00:14:25Z Verification: `bun run --cwd packages/cli test tests/schema.test.ts tests/skill-invocation-log.test.ts tests/skills/audit-documentation-sources.test.ts` passed (82 tests); `bun run --cwd packages/cli test tests/parity.test.ts tests/schema.test.ts` passed (50 tests); `bun run --cwd packages/cli test tests/commands/setup-python-phase2.test.ts -t "audit skill|jscpd"` passed (4 tests); `git diff --check` passed. Full `setup-python-phase2.test.ts` still has an unrelated timeout in `Test 6.3: Skips install if ruff already in dependencies`, including when run alone.
- 2026-07-02T00:05:00Z Scoped: Use the existing generated-wrapper architecture from F1HTQ4; leave Cursor-native skills migration for a separate architectural ticket.
- 2026-07-02T00:02:43.735Z Started: Created ticket C7PXFR

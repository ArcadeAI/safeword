---
id: VFD6X1
slug: test-lint-graduation
type: task
phase: intake
status: in_progress
created: 2026-07-07T02:19:20.221Z
last_modified: 2026-07-07T02:19:20.221Z
external_issue: https://github.com/ArcadeAI/safeword/issues/773
scope:
  - vitest lane gains vitest/no-disabled-tests (error) — .skip/xit/xdescribe need an inline eslint-disable with reason (the auditable approval artifact)
  - vitest lane gains no-restricted-syntax selectors for the sleep idioms (awaited Promise+setTimeout, Bun.sleep, sleep()) and it/test/describe.todo
  - functional Linter tests pin each selector's flag/no-flag behavior (skipIf must stay legal)
  - testing-guide.md Test Integrity table + no-sleep section trim their lint-owned rows to pointers
out_of_scope:
  - assertion-weakening / test-deletion detection (not statically lintable without noise; stays prose + REFACTOR commit gate)
  - testing-guide.md:470 CI coverage thresholds (separate heavier rung)
  - playwright lane (already has no-wait-for-timeout, no-skipped-test, no-focused-test)
done_when:
  - it.skip without a disable comment and await-sleep idioms fail lint in the vitest lane
  - skipIf-conditional tests and template-string fixtures stay clean
  - repo lint stays green with zero new suppressions
---

# Graduate test-integrity + no-sleep rules from prose to lint

**Goal:** The lintable subset of testing-guide's Test Integrity table (.skip/.only/xit/.todo, commented-out tests) and the no-arbitrary-sleep rule are ESLint-enforced in the vitest lane, and the prose trims to pointers

**Why:** #773 graduate-then-trim: testing-guide.md:33 and :438 are prose-only invariants; the vitest lane already bans .only and commented-out tests but .skip/.todo and sleep idioms rely on the agent reading the guide

## Work Log

- 2026-07-07T02:19:20.221Z Started: Created ticket VFD6X1
- Scouted: all in-tree skips are env-conditional skipIf (legal under the new rule); the only sleep-shaped lines live in template-string fixtures (not AST calls) — rules can land at error with zero suppressions
- TDD: 15 RED tests (config pins + functional Linter runs incl. the load-bearing skipIf no-flag pin) → GREEN via vitest/no-disabled-tests + 4 no-restricted-syntax selectors; 81/81 preset tests, repo-wide test-file lint zero violations, parity synced, prose trimmed to pointers at both sites

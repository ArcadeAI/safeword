---
id: 142
type: task
phase: done
status: done
created: 2026-05-13T20:10:00Z
last_modified: 2026-05-14T01:35:00Z
---

# End-to-end integration test for `install` / `upgrade` against a temp project

**Goal:** Add a CI-runnable integration test that exercises `safeword install` and `safeword upgrade` against a temp project directory, asserting the user-visible result. Catch the class of bug where unit-tested pieces (templates, reconcile) compose into broken output.

## Why

We just shipped two fixes (v0.30.2: #77 template `---\n\n` boundary, #79 reconcile heal) for a bug that lived in the seam between the template strings and the reconcile prepend logic. **Unit tests on either piece in isolation would not have caught it** — both pieces were locally correct; only their composition produced `---# Heading`. The bug was caught in the wild by a user reading their own CLAUDE.md.

Same pattern: the `@types/estree` dual-install bug (#82) — every unit was fine; the install-time composition was broken. No regression test exists for that either; the dep override is currently only protected by CI lint passing.

A single integration test that does `mkdir /tmp/foo && safeword install && assert <invariants>` would have caught both bugs on day one and would protect against the same class going forward.

## Scope

- One test file under `packages/cli/tests/integration/` (or extend an existing one).
- Cases:
  1. **Install on project with no CLAUDE.md** — file is created with correct safeword preamble.
  2. **Install on project with existing CLAUDE.md starting with `# Heading`** — boundary is `\n---\n\n# Heading`, never `---#`.
  3. **Upgrade on project with legacy `---# Heading` artifact** — file is healed in place; idempotent on second run.
  4. **Same three cases for AGENTS.md**.
- Test runs against the local `packages/cli/src/` (or built `dist/`), not the published npm artifact — we want CI to catch these without a publish round-trip.
- Reuse the existing `vitest` test runner; live alongside the unit tests.

## Out of Scope

- Testing every install pack / preset (typescript, python, rust, etc.). Just the markdown-text-patch paths — the bug class that motivated this.
- Testing against the **published** `safeword@<version>` tarball. CI runs against source; that's enough to catch the regression class. A separate "published artifact smoke test" is its own ticket if we ever want it.
- Browser-style E2E or interactive prompts.
- Testing the husky `node_modules`-missing guard at the shell level (separate, lower-priority gap).

## Done When

- [ ] Integration test file exists, runs as part of the standard `bun run test` pass.
- [ ] Reverting commit `d6dce6d` (the template `---\n\n` fix) causes the install test to fail.
- [ ] Reverting commit `a304af8` (the heal logic) causes the upgrade test to fail.
- [ ] Idempotency case: running upgrade twice on a healed file produces a stable result.
- [ ] Test runtime adds <2s to the suite (these are filesystem ops; should be fast).
- [ ] No flake on 3 consecutive CI runs.

## Notes

- The existing unit tests in `packages/cli/tests/reconcile.test.ts` (lines added in #77, #79) test `executeTextPatch` directly. This ticket adds the **integration** layer above that — i.e., calls the same entry point a real user invokes (`reconcile(SAFEWORD_SCHEMA, 'install', ctx)` or the CLI command itself), with a real temp directory, and asserts the resulting file contents.
- Related: ticket #141 (Claude Code worktree race) ships another defense in `.husky/pre-commit`. Same fresh-worktree failure mode cluster; orthogonal fix.

## Work Log

- 2026-05-13T20:10:00Z Created: filed after v0.30.2 release retrospective. Two recent bugs (#77 template glue, #82 estree dual-install) both lived at the install/compose seam — neither would have been caught by unit tests alone. ~1-2 hours of work; small but high-leverage.
- 2026-05-13T23:10:00Z Implement: added `packages/cli/tests/integration/install-upgrade.test.ts` (6 cases × CLAUDE.md and AGENTS.md). While writing case 3 (upgrade heal) discovered the heal logic from a304af8 didn't actually fire in `'upgrade'` mode: `computeUpgradePlan` planned text-patches via a marker-aware planner that skipped already-patched files, so `executeTextPatch` (where the heal lives) never ran on legacy-corrupted projects during `safeword upgrade` — contrary to the commit message. Fixed by dropping the marker check from `planTextPatches`; the executor's existing skip/heal branch is the single source of truth. Verified done-when: reverting d6dce6d flips the 2 install-over-heading tests red; reverting a304af8 flips the 2 upgrade-heal tests red.
- 2026-05-14T01:35:00Z Done: /verify passed (1565/1566 tests, lint clean, build success); /audit passed with only pre-existing warnings (eslint 10 deferred to #099); /quality-review APPROVE. PR https://github.com/ArcadeAI/safeword/pull/85 ready for squash-merge. Out-of-scope finding noted but not filed: `createIfMissing: false` on CLAUDE.md in schema is documentation-only — `executeTextPatch` always creates.

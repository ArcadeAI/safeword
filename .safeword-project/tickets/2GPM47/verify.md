## Verify Checklist

**Test Suite:** ✓ 17/17 tests pass (`tests/commands/setup-architecture.test.ts` 7/7 — includes new Test 6.5 and Test 6.6; `tests/commands/sync-config.test.ts` 10/10 regression check)
**Build:** ⚠️ Pre-existing ESM-success / DTS-failure on `eslint-plugin-storybook` import; unchanged from main
**Lint:** ⚠️ Skipped — same pre-existing storybook resolution error blocks the lint script
**Scenarios:** All 7 scenarios marked complete (inline tests per task convention — Test 6.1-6.6 in `tests/commands/setup-architecture.test.ts`)
**Dep Drift:** ✅ Clean — no dependency changes
**Parent Epic:** N/A

### Acceptance criteria (from ticket frontmatter)

- ✅ **Explainer fires on new wrapper** — Test 6.5 asserts setup output contains `"extends rules from .safeword/depcruise-config.cjs"` when the wrapper is freshly created (src/utils/ triggers arch detection, no preexisting wrapper).
- ✅ **No nag on preexisting wrapper** — Test 6.6 pre-creates a custom `.dependency-cruiser.cjs`, runs setup, asserts (a) the custom wrapper bytes are preserved and (b) the explainer string is absent from setup output.
- ✅ **Trigger gated on `syncResult.createdMainConfig`** — `info()` call sits inside the `if (syncResult.createdMainConfig)` branch at `setup.ts:329-333`, same gate that pushes the file into `archFiles`.
- ✅ **No change to sync-config or /audit** — sync-config tests (10/10) all green, including the `--check` mode landed in 6R84DY.

### Implementation notes

- One-line edit at `packages/cli/src/commands/setup.ts:331-333`: `info('  ↳ .dependency-cruiser.cjs extends rules from .safeword/depcruise-config.cjs — edit to add your own.')`
- Two-space indent (`'  ↳ '`) so the explainer visually nests under the "created files" list when printed.
- Front-loads the file name so the customer's eye lands on the relevant noun first.

Audit passed.

**Next:** commit and add to PR #161 (or fold into next PR).

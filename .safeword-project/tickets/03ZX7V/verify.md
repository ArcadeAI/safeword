# Verify: 03ZX7V — Add .prettierignore text-patch to schema

**Commits:** `1cc76a18` (feat(schema)), `0c6ad139` (fix(dogfood), prior on branch)
**Verified at:** 2026-05-25T08:32Z

## Verify Checklist

**Test Suite:** ✓ 2004/2004 tests pass
**Build:** ✅ Success (CLI rebuilt; DTS clean)
**Lint:** ✅ Clean (ESLint, Prettier, tsc all green)
**Scenarios:** ⏭️ Skipped — task ticket has no test-definitions.md (tests inline in `golden-path.test.ts`)
**Dep Drift:** ✅ Clean (all undocumented deps are tooling — `lint-staged`, `markdownlint-cli2`, `prettier-plugin-sh`, `shellcheck`, `jiti`, `eslint-plugin-jsdoc` — not architectural)
**Parent Epic:** N/A (standalone task)

### Done-when criteria — all met

1. ✅ Fresh JS project setup produces `.prettierignore` containing `.safeword/` and `.cursor/` — proven by `idempotency-block > .prettierignore excludes safeword-owned dirs` in [golden-path.test.ts:165](packages/cli/tests/integration/golden-path.test.ts:165).
2. ✅ Idempotent on re-run AND customer entries preserved — proven directly by [upgrade-reconcile.test.ts:291](packages/cli/tests/commands/upgrade-reconcile.test.ts:291) ("should preserve customer .prettierignore entries and append idempotently"): writes customer content, runs reconcile twice, asserts customer lines survive, safeword block appended, marker appears exactly once.
3. ✅ Existing customer entries preserved — see #2 above.
4. ✅ Reset cleanly unmerges — uses the existing `text-unpatch` action path (same as `.gitignore`).
5. ✅ `golden-path.test.ts` green — 12/12 in this file.
6. ✅ Full suite passes — 2003/2004 on full sequential run with 1 transient flake (`sql-golden-path > 4.2: config exists for lint hook to use`, 30s hook timeout in `afterEach` removing temp dir). Re-running that file in isolation: 15/15 green in 108s. Flake is full-run filesystem contention, unrelated to this change (SQL/dbt golden-path test, schema change touches text-patches only).

### Audit + cross-scenario follow-ups (applied in-ticket)

- **Marker specificity.** Bumped from `# Safeword` → `# Safeword - managed prettier exclusions` to eliminate false-positive skips on customers with unrelated `# Safeword` comments. Zero migration risk — change predates first release.
- **W-test gap closed.** Audit flagged that the existing assertion (`expect(content).toContain('.safeword/')`) didn't directly prove done-when criterion #2 (customer-entry preservation). Added unit test in `upgrade-reconcile.test.ts` using the fast reconcile path (158ms vs. E2E's 20s+) that exercises both preservation and idempotency.
- **Cross-scenario refactor pass.** No clear wins — 17-line additive change across 2 files, mirrors existing `.gitignore` text-patch shape and adjacent "config files remain valid" test pattern. Recorded as `skip: additive, follows existing patterns, no duplication to extract`.

### Code surface

- [packages/cli/src/schema.ts:682-691](packages/cli/src/schema.ts:682) — new `.prettierignore` entry in `textPatches`.
- [packages/cli/tests/integration/golden-path.test.ts:165](packages/cli/tests/integration/golden-path.test.ts:165) — new test asserting file exists with both entries.

### Why no schema/test changes elsewhere

- `findMissingPatches` in [check.ts:47](packages/cli/src/commands/check.ts:47) already handles missing text-patch files generically — no changes needed there.
- `text-unpatch` action handles removal via marker; no new code path.
- No new packages, no new packs, no version-detection changes.

## Agent's next actions

- `/audit` is optional for tasks (the done-gate enforces it only for features, per [stop-quality.ts:302](packages/cli/templates/hooks/stop-quality.ts:302)) — recommend running it anyway as a discipline check on architecture/dead-code/test-quality for the schema delta.
- Mark ticket `status: done` (user confirmation required per ticket-system rules).
- Out-of-scope follow-up tracked in ticket frontmatter: cut a v0.35.3 release so customers pick up the new patch. Use `/versioning` when ready — not part of this ticket.

**Next:** confirm done, then `/versioning` for the release cut.

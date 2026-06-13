# K7N2QM — Verify Checklist

**Test Suite:** ✓ 2110/2110 tests pass (1 pre-existing skip; 119 files)
**Build:** ✅ Success (tsup ESM + DTS, no errors)
**Lint:** ✅ Clean (ESLint, Prettier, TypeScript — one fix during run: guard `files[filePath]` against possibly-undefined index access in `reconcile.ts:172`)
**Scenarios:** All 18 scenarios marked complete (54 RED/GREEN/REFACTOR cells + 1 feature-level refactor row = 55/55 checkboxes)
**Dep Drift:** ✅ Clean — architectural deps (`commander`, `yaml`) both documented in `ARCHITECTURE.md`; remaining deps are eslint plugins or build tooling (skipped per drift rules)
**Parent Epic:** DZ2NM5 (bdd-phase-zero-merge) — siblings: 1/7 done (7YN5QB complete; YR6C49, Y2HCNJ, 31W8M3, XT1FFM, B0JZQN, 1J6JKP in_progress). K7N2QM closes as the second sibling done.

## Done-when criteria — evidence

| Criterion (from frontmatter)                                                                          | Evidence                                                                                                                                                                                                       |
| ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Optional `paths` object documented in config schema                                                   | `README.md` "Customizing File Locations" section with worked example                                                                                                                                           |
| `validatePersonaReference` reads from `paths.personas` if set, falls back to default                  | `personas.ts:445` routes through `resolveConfiguredPath`; R1.2 GREEN at `05313409`                                                                                                                             |
| Existing 71 unit + I/O tests still pass                                                               | Full suite green; persona-related tests at `personas-ref.test.ts` unchanged behavior                                                                                                                           |
| Read-API contract preserved (`unknown` on configured-but-missing, never throws)                       | `personas.ts:447-449` try/catch returns `{ status: 'unknown' }`; comment pins the contract; R1.4 covers                                                                                                        |
| New unit tests cover override resolves / missing returns unknown / absolute / relative / empty-string | `personas-ref-configured-paths.test.ts` 6 tests, all passing                                                                                                                                                   |
| `safeword check` reports `personas-path:` loud failure                                                | `check.ts:55-58`; R2.3 RED+GREEN at `2015fc16` / `f4a725d3`                                                                                                                                                    |
| `safeword check` emits zero-exit advisory on legacy default file                                      | `check.ts:74-83` (new `findPersonaAdvisories`); `HealthStatus.advisories` field reported under "Advisories" header but not in exit gate; R2.6 RED+GREEN at `e72e8442` / `f5572097`                             |
| Schema ownership via `configKey` on `managedFiles`                                                    | `types.ts:102-115` (field added); `schema.ts:580-582` (personas entry tagged); `reconcile.ts:163-176` (install gate) + `reconcile.ts:582-593` (uninstall-full gate); R3.2 RED+GREEN at `4040f8ac` / `78f32531` |
| New integration tests cover configured-found, configured-missing, scaffold-skip, legacy-advisory      | check.test.ts K7N2QM block (5 tests); reconcile-configured-paths.test.ts (4 tests); all passing                                                                                                                |
| README / setup docs updated                                                                           | `README.md:289-318` new section committed at `43e72691`                                                                                                                                                        |

## Implementation surface

5 source files touched, 3 new test files:

- `packages/cli/src/utils/configured-paths.ts` (new, 73 lines) — `resolveConfiguredPath` + exported `readConfiguredPath`
- `packages/cli/src/utils/personas.ts` (+5 / -4) — wire `validatePersonaReference` through helper
- `packages/cli/src/packs/types.ts` (+13) — `ManagedFileDefinition.configKey?` field
- `packages/cli/src/schema.ts` (+2 / -1) — tag personas entry with `configKey: 'personas'`
- `packages/cli/src/reconcile.ts` (+23 / -3) — `isConfigOverridden` helper + gate at install and uninstall-full sites
- `packages/cli/src/commands/check.ts` (+45 / -8) — route `findPersonaIssues` through helper, loud-failure branch, new `findPersonaAdvisories`, `HealthStatus.advisories`, "Advisories" report block
- `packages/cli/tests/utils/personas-ref-configured-paths.test.ts` (new, 100 lines) — 6 tests
- `packages/cli/tests/reconcile-configured-paths.test.ts` (new, 150 lines) — 4 tests
- `packages/cli/tests/commands/check.test.ts` (+88) — K7N2QM describe block, 5 tests

## Risk surface I considered

- **Data-loss principle held.** No code path deletes a user-authored file. `safeword reset --full` with an active override leaves `.safeword-project/personas.md` alone (R3.5 verified).
- **Read-API never throws.** Configured-but-missing returns `{ status: 'unknown' }` same as default-missing — the contract is pinned in a code comment so a future implementer doesn't "fix" it.
- **Empty-string defensive.** Empty/non-string `paths.personas` values fall back to default at the read API (R1.6 verified). Loud signal at config-validation level is a separate concern.
- **Dist staleness.** Subprocess-based check tests use `dist/cli.js`. Rebuilt explicitly before each `runCli` test run during implementation; CI's fresh build will catch any further drift.

**Next:** run `/audit` to satisfy the done-gate's third evidence pattern, then advance to `done`.

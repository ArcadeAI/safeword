# Impl Plan: migrate consumers to test-plan

**Status:** implemented

## Reconciliation (what shipped vs planned)

- **Decisions held:** `set -e` failure propagation ✓; `--format <human\|json\|sh>` with `--json` kept as alias ✓; `SAFEWORD_CLI` seam for the test-runner CLI location ✓ (the spec Open Question — resolved).
- **Refinement (deviation from plan):** `/verify` runs `bash -c "$(safeword test-plan … --format sh)"` rather than a bare `eval "$(…)"`. Reason: `set -e` inside `eval` would leak into the rest of the skill's bash block; a child shell (`bash -c`) scopes it. Behaviorally equivalent for the gate (exit code propagates), strictly safer. No follow-up needed.
- **Arch alignment held:** reuse (`safewordCliCommand` pattern from lint.ts; one resolver), `--format` as a standard option.
- **Test seam:** `runTests` tests inject `SAFEWORD_CLI` (dogfood source) + `SAFEWORD_FAKE_TOOLS=all` for offline determinism.

## Approach

Three slices, build order = dependency order:

| Slice                                    | Owner                                                                                 | Test layer                                              | Order                              |
| ---------------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------- | ---------------------------------- |
| `--format sh` emit mode                  | `src/commands/test-plan.ts` + a `renderShellPlan(entries)` helper in `src/test-plan/` | unit (render) + integration (runCli eval)               | 1 — foundation both consumers need |
| `test-runner.ts` → `test-plan --json`    | `templates/hooks/lib/test-runner.ts` (+ `.safeword` mirror)                           | `runTests` tests via the dogfood CLI                    | 2                                  |
| `/verify` section 2 → eval `--format sh` | `templates/skills/verify/SKILL.md` + `commands/verify.md` (+ `.claude` mirror)        | structural (file-content) + done-gate phrases preserved | 3                                  |

**`--format sh` semantics:** emit `set -e` once, then `( cd <cwd> && <command> )` per available entry, `echo "⏭️ Skipped — <runner> not installed"` per unavailable entry. `set -e` makes the eval exit non-zero on the first failing suite (matches `test-runner`'s existing first-failure-stop) and an empty plan is a bare (no-op) script → exit 0. Generalize the CLI flag to `--format <human|json|sh>` keeping `--json` as an alias (BKTTZA shipped `--json`; its test must keep passing).

**test-runner.ts:** replace `getTestCommands`/`nativeTestCommand`/`getJsTestCommands`/`pythonTestCommand` with a call to `safeword test-plan --kind test --json` via `safewordCliCommand()` (the installed-or-bunx resolver lint.ts uses), parse `PlanEntry[]`, run each `command` in its `cwd` with the existing execSync+timeout+truncation; still append `test:bdd` (detected from package.json as today).

## Decisions

| Decision                          | Choice                                                                              | Alternatives                | Rejected because                                                                                                   |
| --------------------------------- | ----------------------------------------------------------------------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| sh failure propagation            | `set -e` + sequential `( cd && cmd )`                                               | `&&`-chain; run-all-collect | `set -e` is simplest, matches test-runner's first-failure-stop; run-all needs aggregation the gate doesn't require |
| CLI flag shape                    | `--format <human\|json\|sh>`, `--json` kept as alias                                | new `--sh` boolean          | one enum is cleaner; alias preserves BKTTZA's shipped `--json` + its test                                          |
| test-runner CLI location in tests | inject a CLI path/seam so `runTests` tests use the local dist, never network `bunx` | rely on `bunx safeword`     | network/non-determinism in unit tests (the spec Open Question)                                                     |

## Arch alignment

- Reuse over duplication — both consumers call the one resolver; `safewordCliCommand()` reused from the lint hook pattern.
- CLI command structure — `--format` is a standard option on the existing `test-plan` subcommand.

## Known deviations

skip: none planned — behavior-preserving migration onto an existing command.

## Assessment triggers

- A third consumer needing the plan → consider a tiny shared TS client (still CLI-mediated, hooks can't import).
- If `set -e` first-failure-stop proves wrong for multi-suite repos (users want all suites run) → switch to run-all-and-aggregate.
- An `audit-plan` resolver (dead-code/outdated) materializes → revisit whether `/audit` joins this consumption pattern.

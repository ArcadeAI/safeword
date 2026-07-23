# SQ5KFS — Work log

## 2026-07-22

- Full verification of 36PD6T exposed one unrelated Go fallback failure: 5,282 tests passed and only `golang-golden-path.test.ts` failed.
- Direct `golangci-lint fmt` without a config formatted the same input in 69ms; direct `run --fix` plus `fmt` completed in under one second.
- A disposable-project hook trace showed the absent config triggers `bunx safeword@latest upgrade`. That is the only slow/networked boundary before formatting and can overrun the hook's 30-second timeout under full-suite load.
- Planned regression: use the real hook plus a fake `bunx` binary. The observable contract is a formatted file and no upgrade attempt.
- Added the regression, observed it fail against the old hook because the fake upgrade was invoked, then changed the missing-config path to use the installed formatter immediately.
- Regression passes, as do all 12 Go golden-path integration tests. Template and dogfood hook sources are byte-identical; lint and formatting checks pass.
- Final verification: `bun run test` passed 355 files / 5,284 tests (5 skipped); the generated BDD lane passed 484 scenarios / 15,000 steps (3 and 4 skipped respectively); TypeScript typecheck passed.

# Verification

**Status:** Local checks passed; final-head CI must pass before merge.

**Tests:** ✅ `scripts/dev bun run test:done` (the Stop hook's plan command, repo root): 105 files, 2,063
tests passed in 36.5s wall at load 7.0. Package-local runs: 31.7s and 30.8s wall at load 5.3-5.8.
Before the change: 74.5s wall at load ~6 (110 files, 2,251 tests). Lane-selection test: 4/4.

**End-user path:** The installed runner (`.safeword/hooks/lib/test-runner.ts` `runTests`) ran the
whole plan in 454s at load 14 and reported failure. The visible failure is the plan's
`go test ./...` entry in `experiments/go-skill-directive/checker`. It reproduces standalone because
this host's `GOROOT` (mise go1.25.14) does not match the `go` binary on PATH (1.27.1). That is host
drift, not this change. The BDD lane made up most of the 454s, under its own 20-minute cap.

**Build:** ✅ tsup build inside the wrapper; `check-generated-surfaces.ts`: all 5 surfaces current.

**Lint/Typecheck:** ✅ eslint on the changed files; `tsc --noEmit` for packages/cli.

**Independent review:** ✅ Sonnet subagent. Config correct; `vitest list` shows 105 files. Applied:
ARCHITECTURE.md row. Answered: the glob-based test matches vitest today, and the dev toolchain pins
Node 24; CI runs `bun run test` on every PR, so the comment holds; smoke lanes keep the full hook
directory on purpose (no cap).

**PR Scope:** `packages/cli/vitest.done.config.ts`, the `test:done` script, a lane-selection test,
the ARCHITECTURE.md row, and this ticket. No template changes; the shipped 60s cap is unchanged.

**Evidence limits:** No local full-suite run; CI runs the default lane, which includes the five
excluded suites. `lint-go-context` fails locally from the same Go drift.

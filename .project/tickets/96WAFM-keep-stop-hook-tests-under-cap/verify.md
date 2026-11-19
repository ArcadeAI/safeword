# Verification

## Verify Checklist

**Test Suite:** ⚠️ Local environment limitation: host `GOROOT` (mise go1.25.14) does not match the `go` on PATH (1.27.1). Full `/verify` plan: retro-relay 198/198 (1 skipped), retro-collector 153/153, packages/cli 11,973/11,975 (14 skipped). The two failures are `tests/hooks/lint-go-context.test.ts`, caused by the Go mismatch; `go test ./...` in `experiments/go-skill-directive/checker` fails the same way. The plan's first CLI run also timed out on two OpenCode tests at load ~14 (`review-wiring` OpenCode probe, `host-contract` `bunx opencode-ai --version`); both passed on the second CLI run in the same plan. CI `test` (node 22.23.2 and 24.18.1) and `Go lint context` pass at head b9da284.
**Gherkin:** ✅ Acceptance lane passes — 599 scenarios, 11,786 steps
**Build:** ✅ Success (tsup, every package)
**Lint:** ✅ Clean (eslint on changed files; CI `lint` green)
**Typecheck:** ✅ Clean (`tsc --noEmit` across the workspace)
**Scenarios:** ⏭️ Skipped — task ticket, no test-definitions.md; TDD ledger in ticket.md (RED f835d1c7d, GREEN aeaecb428)
**Refactor:** ✅ No change warranted — two-file change, no duplication or structure to improve
**PR Scope:** ✅ Diff matches ticket scope (lane config, `test:done` script, lane-selection test, ARCHITECTURE.md row, ticket records)
**Dep Drift:** ✅ Clean (no dependencies added)
**Parent Epic:** N/A
**Reconcile:** ✅ No pattern deviation — `vitest.done.config.ts` follows the `vitest.{slow,live,release}.config.ts` pattern
**Experience:** ✅ No new friction — Walked a safeword developer through ending a turn; worst step = the Stop hook's `test:done` run, now 36.5s wall at load 7.0 instead of timing out at 60s; new steps vs before = 0
**Surface Evidence:** ⏭️ N/A — no affected product surfaces; repo-internal test lane
**Evidence limits:** ⚠️ Host Go toolchain mismatch fails Go tests and `govulncheck` locally (bun audit and uv audit clean); CI covers Go. OpenCode timeouts were load-related and passed on rerun.

## Timing evidence

- Before: `bun run test:done` 74.5s wall at load ~6 (110 files, 2,251 tests); vitest 68.9s.
- After: 105 files, 2,063 tests pass. Repo root (Stop-hook plan command): 36.5s wall at load 7.0. Package-local: 31.7s and 30.8s wall at load 5.3–5.8.

## TDD review

- RED: dropping the five excludes fails only `leaves the measured heavy suites to the full lane`, on
  `pre-tool-architecture-stage.test.ts`, which is the missing behavior rather than a setup error.
- GREEN: minimal two-file change. The test's `globSync` selection matches `vitest list --config
  vitest.done.config.ts` file for file (105 files).
- Known gap: nothing stops a future heavy hook suite from pushing the lane back over 60 s. A
  wall-clock assertion would be flaky under load, so none was added.

## Independent review

- Safeword `/quality-review` route: Codex (gpt-6.1-sol), cross-agent, review-id
  ea21f084-0290-413b-8243-740081e9b2c6. Verdict approve, no findings. Targets: the done config,
  `package.json` and the lane-selection test. `ARCHITECTURE.md` (one doc row) was left out because it
  is over the 256 KiB packet limit.
- Earlier Sonnet subagent pass: applied the ARCHITECTURE.md row fix. Answered: CI runs
  `bun run test` on every PR, and the smoke lanes keep the full hook directory on purpose (no cap).

## Re-verification at 913c43a8f

The only change since the first run is ticket records. The full `/verify` plan was re-run under
`scripts/dev` (Bun 1.4.4) at load about 7:

- retro-relay 198/198, retro-collector 153/153.
- packages/cli, first pass: 17 failures in 9 files.
- packages/cli, second pass: 8 failures in 5 files. Four of those files are timing-sensitive:
  `review-wiring` (OpenCode timeouts), `opencode/host-contract`, `coding-authorization` (reviewer
  `probe_timed_out`) and `test-runner-lock` (the cross-checkout lock). The fifth is
  `lint-go-context`, which fails from Go drift.
- Gherkin: 598/599. The failure is the reviewer route-order scenario in
  `review-with-the-best-available-agent.feature:81`. Claude launched first because a route
  probe timed out.
- Typecheck passed. Build and dependency audit fail only on the host Go mismatch.

No failing file is in this PR's diff. CI `test` (node 22 and 24), `lint` and `Go lint context` pass
at 913c43a8f. An earlier re-run outside `scripts/dev` used Bun 1.3.14 and is discarded; its
plugin-generation failures came from the wrong Bun version.

## Audit

Audit passed, diff scope against origin/main (merge base 8974a7ad6). Errors: 0. Warnings: 0. Config
drift: none. depcruise found no violations (543 modules). No learnings, domain docs or
`impl-plan.md` are in scope. The only doc describing the lane, the `ARCHITECTURE.md` row, matches.

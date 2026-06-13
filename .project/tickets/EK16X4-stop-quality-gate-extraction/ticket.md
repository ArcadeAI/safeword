---
id: EK16X4
slug: stop-quality-gate-extraction
type: feature
phase: intake
status: in_progress
created: 2026-06-12T00:56:12.673Z
last_modified: 2026-06-12T00:56:12.673Z
---

# Extract stop-quality gate logic into testable hook libs (suite-time + unit-testability)

**Goal:** Extract the pure gate decisions from `templates/hooks/stop-quality.ts` (~550 lines: cumulative artifacts, impl-plan existence/validity/status gates, done-gate evidence checks) into `hooks/lib/` functions so gate cells run as millisecond unit tests instead of spawn-per-test integration tests.

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.

## Context (from the M6D315 refactor survey, 2026-06-12)

- Every gate test today spawns `bun .safeword/hooks/stop-quality.ts` in a temp project (`tests/integration/impl-plan-gate.test.ts`, `status-close-gate.test.ts`, etc.) — a large share of the ~14-minute full suite is these spawns.
- Candidates to hoist: `checkCumulativeArtifacts`, `checkImplPlanArtifact` (XDNSZA + ERVA6V gates), and the done-gate evidence checks — all pure(ish) functions of `(ticketInfo, filesystem reads)`.
- Keep a thin spawn-based smoke layer proving the hook wiring (stdin parsing, hardBlockDone output shape); move the cell matrix to unit tests against the libs.
- Pattern precedent: jtbd.ts / impl-plan.ts / parse-annotation.ts already live in `hooks/lib/` and are unit-tested directly.
- Expected payoff: minutes off the full suite + direct testability for future gate work.

## Work Log

- 2026-06-12T00:56:12.673Z Started: Created ticket EK16X4

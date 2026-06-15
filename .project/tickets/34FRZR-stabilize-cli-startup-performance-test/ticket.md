---
id: 34FRZR
slug: stabilize-cli-startup-performance-test
type: task
phase: intake
status: in_progress
subtype: bug-investigated
created: 2026-06-15T13:50:34.081Z
last_modified: 2026-06-15T14:24:39.000Z
---

# Stabilize CLI startup performance test under full-suite load

**Goal:** Make the CLI startup performance constraint deterministic enough that full-suite verification fails only on real startup regressions, not incidental machine contention.

**Why:** P30CRP verification showed the full CLI suite can complete but fail `technical-constraints.test.ts` because one `--version` subprocess start exceeded the max threshold under full-suite load, while the same test passed in isolation.

## Scope

- Investigate `packages/cli/tests/technical-constraints.test.ts` Test 0.1 and its use of `runCliSync(['--version'])` / `measureTime`.
- Decide whether the test should isolate startup timing, use a more robust statistic, move to a dedicated performance lane, or revise the threshold.
- Preserve the original intent: catch meaningful CLI startup regressions.

## Out of scope

- Changing P30CRP hook behavior.
- Loosening performance coverage so regressions can pass silently.

## Done when

- The full CLI suite no longer flakes on the startup max-time assertion under normal local full-suite load.
- The startup constraint still fails for a deliberate/obvious startup regression.
- The ticket records the root cause and verification evidence.

## Root Cause

`technical-constraints.test.ts` used the single slowest sample from ten synchronous CLI subprocess starts as a hard failure gate. CLI subprocess startup includes OS scheduling and full-suite CPU contention, so one outlier could exceed 750ms even when the average startup time and normal samples were healthy. Confirmed by a full-suite run that failed only on `maxTime` (1264.64575ms), while the same test passed in isolation and direct built-CLI `--version` probes stayed below the threshold on idle runs.

## Fix

Keep the average startup gate under 500ms and require the second-slowest sample to stay under 750ms. This tolerates one scheduler outlier but still fails if startup is broadly slow.

## Work Log

- 2026-06-15T13:50:34.081Z Started: Created ticket 34FRZR
- 2026-06-15T13:55:00.000Z Found: `bun run --cwd packages/cli test -- --reporter=verbose` completed in 1073.79s with one failure: `tests/technical-constraints.test.ts` Test 0.1 saw `maxTime` 1264.64575ms > 750ms across ten synchronous `--version` subprocess starts. The same file passed in isolation, and direct `node packages/cli/dist/cli.js --version` timings were far below 750ms. Initial assessment: load-sensitive performance-test flake, not a P30CRP regression.
- 2026-06-15T14:24:39.000Z Fixed: replaced the single-slowest-sample gate with a second-slowest-sample gate while preserving the average startup threshold.

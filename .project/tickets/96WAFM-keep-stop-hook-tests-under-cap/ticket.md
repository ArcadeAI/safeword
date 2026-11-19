---
id: 96WAFM
slug: keep-stop-hook-tests-under-cap
type: task
phase: done
scope:
  - Add vitest.done.config.ts selecting tests/hooks/ and tests/schema.test.ts minus the measured heavy suites
  - Point packages/cli test:done at the new config
  - Lane-selection test proving heavy suites stay in the full lane
out_of_scope:
  - Changing the shipped 60s TEST_TIMEOUT_MS cap (customer fast-feedback contract)
  - Skipping the tsup rebuild in run-vitest-with-build-lock.mjs (saves ~5s, adds lock-wrapper complexity)
  - Speeding up the individual heavy suites
  - Host Go toolchain mismatch failing lint-go-context locally
done_when:
  - bun run test:done passes well under 60s on this machine under load, with timing evidence in verify.md
  - Every suite removed from test:done still runs in the default bun run test lane
status: done
created: 2026-11-19T14:18:48.138Z
last_modified: 2026-11-19T14:18:48.138Z
---

# Keep turn-end test feedback inside its time cap for safeword developers

**Goal:** The Stop hook's fast lane (bun run test:done) finishes comfortably under the 60s cap on a loaded machine

**Why:** On load ~5.5 the lane takes 56-60s including a tsup build, so the hook reports a timeout even when every test passes

## Measurements (2026-11-19, load avg ~6)

- `bun run build` (tsup): 4.8s wall.
- `bun run test:done` before: 74.5s wall, vitest 68.9s, 110 files / 2251 tests, ~190s summed file time on 3 workers.
- Heaviest files: pre-tool-architecture-stage 57.3s (94 tests, ~87 bun/git spawns), lint-go-context 20.7s (real Go),
  resolve-verify-ticket 17.9s, dependency-readiness 13.7s (205 tests, kept), lint-config-fallback 13.4s,
  post-edit-other-languages 10.8s.
- Wall time is bound both by the 57s critical-path file and by total work / 3 workers (~63s), so only a leaner
  selection fixes it; a cap change would ship slower feedback to customers and a skipped rebuild saves ~5s.

## TDD Ledger

- [x] RED: f835d1c7d — lane-selection test fails while `test:done` still runs the heavy suites
- [x] GREEN: aeaecb428 — `vitest.done.config.ts` leaves five heavy suites to the default lane
- [x] REFACTOR: skip: two-file change with no duplication or structure to improve

## Decisions

- `test:smoke` and `test:smoke:fast` keep the full `tests/hooks/` directory on purpose: they are
  broader pre-merge lanes with no 60s cap.
- The 60s cap also counts time spent waiting for the machine-wide package test lock held by another
  checkout (observed 1 run: 46.8s wall vs 24.4s vitest). Not addressed here.

## Work Log

<!-- Progress history, not part of the accepted contract: record scope and decisions above. -->

- 2026-11-19T14:18:48.138Z Started: Created ticket 96WAFM
- 2026-11-19T14:26:00Z GREEN: `test:done` 105 files / 2063 tests pass in 31.7s and 30.8s wall (vitest 28.0s, 25.6s) at load 5.3-5.8; was 74.5s.
- 2026-11-19T14:34:00Z Independent review (Sonnet subagent): config correct, 105 files listed by vitest; applied ARCHITECTURE.md row fix.
- 2026-11-19T17:12:00Z Verified: /verify full plan run; Gherkin 599/599, build, typecheck, audits clean; Go failures are host drift. Done.

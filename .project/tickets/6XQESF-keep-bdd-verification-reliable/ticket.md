---
id: 6XQESF
slug: keep-bdd-verification-reliable
type: task
subtype: bug-investigated
phase: verify
status: in_progress
created: 2026-08-06T18:51:26.130Z
last_modified: 2026-08-06T19:52:20Z
scope: "Make the two existing full-BDD failures deterministic: preserve the relay proof hook's intended timeout despite step-import order, and isolate each public-command fixture's Codex profile state."
out_of_scope: "Changing Cucumber's global scheduler or timeout defaults, relaxing machine JSON comparisons, and changing production proof timestamps or Codex status semantics."
done_when:
  - "Relay proof hooks retain their intended 180-second budget regardless of other step files' defaults."
  - "The public-command machine-contract scenario compares outputs from an isolated Codex profile."
  - "Focused and full BDD verification pass on the implementation commit."
external_issue: https://github.com/ArcadeAI/safeword/issues/2101
---

# Keep BDD verification reliable for maintainers

**Goal:** Let maintainers run the full BDD lane without unrelated timeouts or unstable machine-output assertions.

**Why:** Shared test-process state currently makes otherwise-correct verification flaky and blocks narrow changes.

**Related:** [#2102](https://github.com/ArcadeAI/safeword/issues/2102) tracks the relay-specific manifestation.

## Scope

**In scope:** The relay proof hook at `steps/operate-retry-safe-retro-relay.steps.ts` and the fixture environment at `packages/cli/features/steps/predictable-safeword-cli.steps.ts`.

**Out of scope:** Cucumber scheduler changes, broad timeout increases, timestamp normalization, and any production Codex-profile behavior.

## Done When

- [x] The relay proof hook has its own 180-second timeout.
- [x] Every public-command fixture uses its own empty `CODEX_HOME`.
- [x] The affected scenarios and full BDD lane pass.

## Tests

- [x] Unit: public-command fixtures replace inherited `CODEX_HOME` and `NODE_OPTIONS`.
- [x] Acceptance: the machine-contract scenario remains deterministic when Codex proof state exists outside its fixture.
- [x] Acceptance: the relay proof scenario loads with a local 180-second budget despite another step module's 60-second default.

## Decision

**Options considered:** (1) raise or reorder the global Cucumber timeout; (2) set the relay hook's timeout directly; (3) redesign the proof runner. The selected local hook timeout is correct because Cucumber's support-code builder stores one mutable default, so another imported step module can overwrite it. An explicit hook timeout preserves the intended 180-second budget without changing unrelated scenarios. The upstream Cucumber project also documents serial execution as the default and treats each scenario as independently scoped, reinforcing local rather than global state ([discussion #2357](https://github.com/cucumber/cucumber-js/discussions/2357)).

For the machine-contract failure, (1) remove `recorded_at` before comparing output, (2) make production status omit timestamps, or (3) isolate `CODEX_HOME`. The third option wins: `recorded_at` is true status data, and the test's defect is reading the developer's mutable Codex profile. Existing Codex fixtures already use a temporary `CODEX_HOME`.

**Premortem:** This local repair could miss a second external profile variable; the focused scenario will run with a deliberate external Codex proof to prove the fixture never reads it.

**Next:** review the isolated BDD reliability change and merge its dedicated PR.

## Root Cause

The relay `Before` hook relies on `setDefaultTimeout(180_000)`, but `steps/retry-safe-retro-filing.steps.ts` is also loaded and later calls `setDefaultTimeout(60_000)`. The Cucumber support-code builder stores that setting as one mutable default, so the relay hook actually times out at 60 seconds. The direct relay proof passed in 328 ms, ruling out a consistently slow Vitest test. Its seven full-lane failures all reported the 60-second hook timeout.

The machine-contract scenario passes the parent process's `CODEX_HOME` into every child CLI command. `codex status` reads hook proof metadata from that mutable real profile, including `recorded_at`; a concurrently running Codex hook can therefore change only one of the two compared JSON values. The isolated rerun passed when the external profile did not change, which rules out a deterministic product JSON defect.

Ruled out: an intrinsically slow relay proof (the direct proof completed in under one second); Cucumber intra-lane parallelism (the checked-in runner does not configure `--parallel`); and a need to alter production timestamps (the nondeterminism enters through test-fixture environment leakage).

## Work Log

- 2026-08-06T19:52:20Z Verified: Canonical verification and the diff-scoped audit passed. Build and type checks succeeded for both packages; Bun audit found no vulnerabilities. The audit found no dependency, architecture, or scope violations.
- 2026-08-06T19:24:00Z Verified: `bun run test` passed on this branch. Retro Relay: 167 passed / 1 skipped. CLI: 441 files, 6,768 passed / 5 skipped; 716.69s.
- 2026-08-06T19:11:00Z Verified: `bun run test:bdd` passed on this branch: 1,077 scenarios and 41,946 steps passed; 3 scenarios and 4 steps skipped; 9m 11.928s.
- 2026-08-06T19:00:00Z Green: Added the dependency-free public fixture environment helper and a focused unit test. The unit test, machine-contract BDD scenario with an inherited temporary profile, and relay setup scenario all pass.
- 2026-08-06T18:54:00Z Decided: Use an explicit local relay-hook timeout and per-fixture CODEX_HOME isolation; rejected global timeout changes and production timestamp normalization. Confirmed direct relay proof passes in 328 ms and isolated machine-contract scenario passes when external profile state is stable.
- 2026-08-06T18:51:26.130Z Started: Created ticket 6XQESF

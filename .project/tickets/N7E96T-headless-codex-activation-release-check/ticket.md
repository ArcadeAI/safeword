---
id: N7E96T
slug: headless-codex-activation-release-check
type: task
phase: implement
status: in_progress
external_issue: https://github.com/ArcadeAI/safeword/issues/1798
scope:
  - "Add a shared headless Codex activation-check harness that selects an explicit model, runs one minimal tool-using task, and validates exact current hook proof from structured profile files."
  - "Cover stale pre-install host and fresh host activation transitions deterministically by replacing only the Codex/process-table boundary."
  - "Report unsupported selected models separately from unrelated host warnings, using Codex JSONL failure events rather than conversational output."
  - "Reuse the harness in the opt-in real-Codex smoke and reference the deterministic check in the release procedure."
out_of_scope:
  - "Claiming that a separate codex exec process restarted or activated an already-running Desktop host."
  - "Changing the activation marker, receipt, host-identity, or migration state contracts shipped in 0.71.0."
  - "Making real-model or authenticated Codex execution a required CI dependency."
done_when:
  - "Default CI coverage proves all five exact-version hook proofs while a matching pre-install host remains pending and while a fresh host completes the same activation ID."
  - "A structured unsupported-model event fails with the selected model, Codex CLI version, and retry action while unrelated stderr warnings remain separately inspectable."
  - "The opt-in live smoke uses an explicit model and the same structured proof assertions, and the release procedure names both commands without equating headless proof with Desktop restart."
created: 2026-08-03T01:32:26.403Z
last_modified: 2026-08-03T02:18:00.000Z
---

# Make headless Codex activation release checks reliable

**Goal:** Make Codex plugin activation release evidence deterministic and machine-readable.

**Why:** Release validation must distinguish hook execution from activation without model or host-warning ambiguity.

## Tests

- [x] Integration RED/GREEN: a fake headless Codex process runs the real five packaged hook commands under a still-running install-time host; current identity-bound proof is complete and activation remains pending.
- [x] Integration RED/GREEN: the same process boundary presents a fresh app-server identity; the marker becomes a receipt with the same activation ID and all five proofs bind to it.
- [x] Integration RED/GREEN: a structured Codex model incompatibility event produces an actionable model/CLI diagnostic and keeps unrelated stderr warnings separate.
- [x] Opt-in live smoke: a real authenticated `codex exec` receives an explicit model and passes the shared exact proof/timestamp assertions without claiming Desktop activation.

## Work Log

- 2026-08-03T01:32:26.403Z Started: Created ticket N7E96T
- 2026-08-03T01:36:00.000Z Decided: `/figure-it-out` selected a shared deterministic harness plus opt-in live smoke. Mock only the Codex/process-table boundary; keep profile proof writers, activation state, CLI hook dispatch, and structured files real.
- 2026-08-03T01:36:00.000Z Phase: intake → implement. Classified as an internal release-validation task with three inline TDD contracts.
- 2026-08-03T01:38:50.000Z RED/GREEN: Added the headless activation-check integration test, observed the missing harness import fail, then implemented explicit-model Codex JSONL execution plus exact five-event identity, activation-ID, timestamp, and pending-state validation. Focused test passes.
- 2026-08-03T01:42:51.000Z RED/GREEN: Fresh-host coverage first failed because the harness returned no receipt host, then passed after validating and returning the exact app-server identity from the activation receipt. Both activation cases pass.
- 2026-08-03T01:49:00.000Z RED/GREEN: Unsupported-model coverage first failed on the missing structured error type, then passed with a stable `CODEX_MODEL_UNSUPPORTED` code, selected model and CLI version, retry guidance, and separately retained stderr warnings.
- 2026-08-03T01:56:32.000Z Wired: Replaced the live smoke's one-hook conversational probe with the shared explicit-model validator, asserted all five cached hook commands, and documented deterministic plus authenticated release commands. Tightened marker and receipt identity/timestamp checks during self-review. The live suite compiles and skips locally because installed `codex-cli 0.141.0` is below its 0.144.5 minimum.
- 2026-08-03T02:05:30.000Z Quality review: First pass requested lower complexity and upper timestamp bounds. Split marker/receipt predicates, observed a future-proof regression fail, then bounded proof and receipt timestamps to the task interval. Four focused integrations, ESLint, and TypeScript pass; fresh re-review started.
- 2026-08-03T02:18:00.000Z Quality re-review: Current OpenAI model guidance requires ChatGPT-authenticated saved `codex exec` uses to move from retiring `gpt-5.4` to `gpt-5.6-terra`. Updated the deterministic default and release command; retained the 0.144.5 smoke floor because explicit GPT-5.6 selection is supported there and the floor also protects plugin-hook behavior.

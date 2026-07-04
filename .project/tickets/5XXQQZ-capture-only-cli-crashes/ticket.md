---
id: 5XXQQZ
slug: capture-only-cli-crashes
type: task
phase: build
status: in_progress
created: 2026-07-04T03:18:38.102Z
last_modified: 2026-07-04T03:18:38.102Z
scope: |
  Make the CLI self-report producer capture only genuine safeword crashes —
  uncaught exceptions and unhandled promise rejections thrown out of a command
  action — instead of ANY non-zero process exit. Concretely:
    - Replace the `process.on('exit')` → `recordCliExit(code)` wiring in
      `packages/cli/src/cli.ts` with an uncaught-exception / unhandled-rejection
      crash handler installed at startup.
    - The handler records a sanitized signal (source = subcommand, errorClass +
      safeword-internal stack frames from the thrown error, exitCode) via the
      existing `recordSignal` sanitizer, then preserves a NON-ZERO exit (crashes
      must still fail the process for CI/scripts).
    - Keep the existing gates: configured-safeword-project only, honor
      `selfReport.capture = false`, best-effort (never alters control flow on the
      happy path).
out_of_scope: |
  - Changing any command's exit code (option 2 — reserving exit 2 for status):
    rejected, high blast radius, changes the CLI's public exit contract.
  - An allowlist of status commands (option 1): rejected, rots as commands are
    added and can't separate a real crash in `check` from `check`'s status exit.
  - Hook-side capture (`installCrashCapture`) — already correct, untouched.
  - Changing the Stop-time surfacing (`stop-self-report.ts`) or the spool format.
done_when: |
  - A deliberate `process.exit(1)` from a command (check / architecture --check /
    codify arg error) records NOTHING in the spool.
  - A genuine uncaught throw / unhandled rejection from a command action DOES
    record a signal (errorClass + stack + non-zero exitCode) and the process
    still exits non-zero.
  - `.safeword` gate and `selfReport.capture = false` still suppress capture.
  - Tests + typecheck + lint green; `safeword self-report` shows no false
    positives from status exits in this repo.
---

# Self-report: capture only genuine CLI crashes, not deliberate non-zero exits (#720)

**Goal:** Capture only genuine safeword CLI crashes (uncaught exceptions /
unhandled rejections), not deliberate `process.exit(1)` status or validation exits.

**Why:** `recordCliExit` guards only on `code !== 0`, so ~12 commands that use
`exit(1)` as normal control flow (`check`, `architecture --check`, `codify`, …)
flood the zero-egress self-report spool with false positives that
`stop-self-report.ts` re-surfaces on every Stop — burying any real crash and
reading as an unresolved problem when nothing crashed (#720).

## Design (from /figure-it-out)

Crash-vs-status is the caught-vs-uncaught distinction, not an exit-code value.
Verified: on Node 22 a registered `uncaughtException` / `unhandledRejection`
handler fires ONLY on genuine crashes and lets us choose the exit code, while a
deliberate `process.exit(1)` bypasses both handlers (only `process.on('exit')`
sees it — which is why today's wiring is wrong). Commander 15 turns an async
action throw into an unhandled rejection and a sync throw into an uncaught
exception; its arg-validation calls `process.exit` (no handler), so arg errors
are correctly treated as status. This mirrors the hook-side `installCrashCapture`
pattern already in `templates/hooks/lib/self-report.ts`, minus the exit-0 forcing
(the CLI must preserve a non-zero exit on a crash).

## Work Log

- 2026-07-04T03:18:38.102Z Started: Created ticket 5XXQQZ
- 2026-07-04 Intake + /figure-it-out: chose option 3 (capture only uncaught
  exceptions/rejections). Verified Node 22 handler semantics empirically and
  commander 15 propagation from source. Scope set; advancing to TDD.
- 2026-07-04 RED→GREEN:
  - `src/self-report-capture.ts`: replaced `recordCliExit` (fired on
    `process.on('exit')` for ANY non-zero code) with `recordCliCrash(error, …)`
    (records source + errorClass + sanitized internal stack) and
    `installCliCrashCapture()` (registers uncaughtException/unhandledRejection
    handlers that capture, surface the crash to stderr, then exit NON-ZERO).
  - `src/cli.ts`: swapped the `process.on('exit')` wiring for
    `installCliCrashCapture()`.
  - Tests: rewrote `tests/self-report-capture.test.ts` (unit: crash captured by
    class, message never stored, non-Error coerced, gates honored) + new
    `tests/integration/cli-crash-capture.test.ts` (uncaught crash → captured +
    stderr + non-zero; `codify` arg error → spool empty, the #720 regression).
  - Green: 6/6 new, 50/50 self-report surface; typecheck + lint clean.
  - Dogfood verified: `safeword check` and `safeword codify NOSUCH` both exit 1
    and create NO spool (was one record each before the fix).

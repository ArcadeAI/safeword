---
id: 4FXYQV
slug: preserve-lint-failure-evidence
type: task
subtype: bug-investigated
phase: implement
status: in_progress
created: 2026-10-26T02:48:10.938Z
last_modified: 2026-10-26T02:48:10.938Z
---

# Preserve lint failure evidence for maintainers

**Goal:** Retain subprocess output and identify timeouts so maintainers can diagnose failed lint-hook tests without weakening failure detection.

**Why:** The full quality review hit an intermittent lint timeout, but the test helper discarded captured output and called it a startup failure.

## Scope

Preserve stdout and stderr when the lint-hook test helper rejects a subprocess
failure. Name an ETIMEDOUT as a timeout, retaining startup-error wording for
other spawn errors. Keep nonzero exits and infrastructure warnings as failures,
and return successful output unchanged. No timeout, subprocess invocation,
assertion, worker-policy, production hook or shared review-gate change.

This fixes missing diagnostic evidence, not the original intermittent stall.
Its cause remains unknown after a passing instrumented full suite. Original
missing RED and all 33 deferrals remain unchanged; no original closure, stale
merge or paid qualification is authorized.

## Root Cause

`assertLintHookSucceeded` throws before using `result.stdout` or `result.stderr`
when `result.error` exists, and also drops them on a nonzero status. It labels
every spawn error as a failure to start, including ETIMEDOUT after execution.
A real controlled Node timeout retained both output streams; inspection shows
the helper discards them. The external proof is
`lint-timeout-debug-20261025/timeout-output-proof.json` in the session evidence
root. Missing child output at the Node boundary is ruled out for this
controlled proof. Deterministic fixture failure is ruled out by unchanged
passing runs. Neither observation identifies the historical stall's cause.

## Inline proof plan

One diagnostic contract, tested through the real helper with subprocess-result
values: timeout, startup failure and nonzero exit must throw the expected
reason together with both captured streams. This is a pure result-to-error
contract; real hook/process wiring is already covered by override-survival.
Existing tests retain rejection of infrastructure warnings and successful
return behavior. Run RED before changing the helper, then the focused module
and real override fixture, lint/types, independent review and final full suite.

## Completion boundaries

The narrow diagnostic repair can be verified independently. Do not mark the
original timeout repaired or close test-parallelism on this evidence. Keep this
task in verify until authorized closure; original maintenance remains closed.

## Work Log

- 2026-10-26T02:48:10.938Z Started: Created ticket 4FXYQV
- Intake review `c2293b1b-d010-43a2-a55f-bd441a0f1077` approved by Claude/Opus,
  cross-agent; normal intake phase stamp observed before advancing. Adopted
  its warnings: use `error.code === 'ETIMEDOUT'`, model Node's null status and
  SIGKILL in the fixture, and compare complete messages so contradictory
  startup/timeout wording cannot pass. A misleading non-timeout message is a
  negative control. The real controlled timeout result is retained locally.
- RED: the final focused run exited 1 with exactly 3 new failures and 6 existing
  passes. Failures show the missing output and timeout reason, not syntax,
  imports or setup. Raw record: `diagnostics-red-final.log` in the session
  evidence directory. No helper implementation changed before this run.

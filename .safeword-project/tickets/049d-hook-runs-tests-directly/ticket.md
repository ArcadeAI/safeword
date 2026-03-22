---
id: 049d
slug: hook-runs-tests-directly
type: task
status: done
phase: implement
parent: 049-stop-hook-quality-improvements
---

# Hook runs tests directly and gates on exit code

**Goal:** For done-phase tickets, have the stop hook directly execute the test suite and gate on its exit code — rather than relying on Claude reporting that tests passed.

## Why

This is the strongest pattern per research: external feedback loops (hook runs tool, checks exit code) are empirically supported (SICA framework arXiv:2504.15228, 17-53% improvement on SWE-Bench Verified). Pattern-matching prose is vulnerable to Goodhart's Law. Running the tests in the hook converts the gate from intrinsic to external.

This replaces or supplements 049c (Bash output scoping) for the test evidence specifically.

## What to Change

`packages/cli/templates/hooks/stop-quality.ts` (+ working copy):

In the done-phase block, before checking text evidence:

1. Detect the project's test command (`bun run test`, `npm test`, `pytest`, etc.) from `package.json` / `pyproject.toml`
2. Run it with a timeout (e.g. 60s)
3. Gate on exit code — non-zero → block with actual test output as reason
4. If exit 0 → tests pass, continue to scenario/audit evidence checks

### Considerations

- **Timeout:** Tests can be slow. Need a reasonable timeout that doesn't hang the hook.
- **Test command detection:** Should respect the project's configured test command, not hardcode.
- **Working directory:** Must resolve to project root regardless of Claude's `cd` usage.
- **Scope:** Only fire for done-phase, not every stop.
- **Cost:** Running tests on every done-phase stop attempt adds latency. Acceptable tradeoff for real enforcement.

## Open Questions

- Should this replace the text-evidence pattern for tests, or run in addition?
- How to handle projects with no test command (skip gracefully)?
- Should we cache the test result within a session to avoid re-running on every stop attempt?

## Work Log

- 2026-03-21 Ticket created as child of 049.
- 2026-03-22 Done. Created hooks/lib/test-runner.ts (detectPackageManager, getTestCommand, runTests). Updated stop-quality.ts done-phase: tests run directly via execFileSync (60s timeout, last 30 lines output), gates on exit code. Also fixed 049c regression: hasScenarios/hasAudit correctly matched against combinedText (Claude text), not Bash output — scenario summary comes from /verify prose, not tool_result. Python support deferred. extractBashOutputSinceLastEdit removed (dead code, superseded).

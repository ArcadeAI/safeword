# Renderer-exception review evidence — November 24

The implementation-plan review proposed a concrete false-positive trigger: a
mutation throws while the renderer module loads, leaving a blank page, but is
credited at the reviewed matcher. The actual installed runner rejected that exact
trigger. No VERIFIED credit, proof review or attestation was requested or issued.

Delivery checkout: `/Users/alex/.codex/worktrees/cc7f/soulless-monorepo`.
Producing HEAD: `b6ac80f62076edf73a7225e0563adb6c672a16bc`.
Installed runtime: Safeword 1.2.0, generated from the validated Git-invocation fix
2185c1d77, Bun 1.4.4 and Node 24.18.1. The normal supported public observation
command consumed committed
`retrospective-proof/renderer-module-exception.rejected-request.json` under the
SGWMBS ticket. Its sole mutation prepends
`throw new Error('SAFEWORD_DIAGNOSTIC_RENDERER_MODULE_EXCEPTION');` to
`const pendingOpenPaths = new Set<string>();` in tabLifecycle.ts. It retains the
cased-suffix scenario, exact selected test and line-39 expectation. This is a
negative diagnostic, not a new enrolled scenario or approved mutation.

Actual typed result: `RETROSPECTIVE_OBSERVATION_FAILED`, status `blocked`, message
`Electron mutation error location differs from the declared expectation.` The
original and mutant went through the normal independent frozen installs and full
builds. The renderer exception did not become a qualifying line-39 assertion kill.
The actual result is retained in the delivery ticket as
`retrospective-proof/renderer-module-exception.rejected-result.json`.
Local execution files: `/tmp/issue163-real-renderer-exception-probe.json` and its
stderr log. The command's nonzero exit is the expected refusal, not success.

The reviewed test awaits getTestStores before its behavior assertions. At the
producing HEAD, `packages/desktop/tests/shared/test-context.ts:44` installs
pageerror, crash and console diagnostics while waiting for renderer stores. Its
catch throws a setup-specific error before returning; its finally removes those
listeners. The cased-suffix test calls this helper at line 27 before opening the
package and before the line-39 assertion. The proposed module-load failure cannot
skip this readiness boundary. Every executable support source is digest-bound.

Confidence limit: the locked JSON report is not a universal Electron exception
monitor. An unreported non-failing console event is not asserted absent. Reported
uncaught exceptions, setup failures, abnormal process exits and mismatched
assertion locations cannot themselves qualify as the behavioral kill. Independent
proof review must still judge the actual before/after mutation as behavior
removal rather than setup destruction. That requirement is already part of the
supported exception, not a replacement for structural checks.

The separate full runtime/test quality review d84537b7-1e51-48c4-8c8a-b3c5939253ad
approved all eleven current authorization/execution modules plus the regression
and proof-map targets with no error-level findings. This does not replace the
implementation-plan review; the actual negative probe supplies the missing
real-host evidence for its named trigger.

# Verification

## Verify Checklist

**Test Suite:** ⚠️ Local environment limitation: focused review parity passes 44/44; the full suite
cannot bind `127.0.0.1` in this Codex sandbox (`listen EPERM`) and the relay runner does not exit
after those cleanup-path failures
**Gherkin:** ⚠️ Local environment limitation: the acceptance lane repeatedly reaches host scenarios
that cannot complete under the same local-server restriction
**Build:** ❌ Failed — the website prerender cannot load the missing optional native package
`@bruits/satteri-darwin-arm64`; the CLI, relay, and collector builds completed before that failure
**Lint:** ✅ Clean
**Scenarios:** All 0 scenarios marked complete
**Refactor:** ✅ No change warranted — the final design is the smallest kind-scoped permission rule
**PR Scope:** ✅ Diff matches ticket scope
**Dep Drift:** ✅ Clean
**Parent Epic:** N/A
**Reconcile:** ✅ No pattern deviation
**Experience:** ⏭️ N/A — not persona-facing
**Surface Evidence:** ✅ 2/2 affected surfaces have recorded proof
**Evidence limits:** ⚠️ Local test servers are blocked by the Codex sandbox; the website's optional
native binding is absent from this installation

## Focused Evidence

- `packages/cli/tests/review/surface-parity.test.ts`: 44/44 passing.
- Generated Claude plugin check: current at `1.0.0-rc.1`.
- Generated Codex plugin check: current at `1.0.0-rc.1`.
- Monorepo TypeScript and Astro type checks: 0 errors.
- Execpolicy: `quality-review`, `scenario-gate`, and `plan-implementation` match their separate allow
  rules; executable RED, status, and arbitrary Bun commands do not match.

## Surface Evidence

| Affected surface | Proof | Result |
| --- | --- | --- |
| Codex independent review | Live bounded `quality-review` through installed `0.83.1` runtime after restart | Reached Claude and returned a typed verdict without a user approval prompt |
| Arcade/Bosslevel MCP | Inspected effective Codex server configuration after restart | `default_tools_approval_mode = "approve"`; no general sandbox network override |

## Status Poll Boundary

A synthetic `review status` call ran in the normal workspace sandbox. It returned
`REVIEW_JOB_NOT_FOUND` as expected and reported no file, network, configuration, package, or
destructive effects.

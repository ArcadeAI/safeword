# Verification: prove legacy protection executes

## Verify Checklist

**Test Suite:** ✓ 51/51 proof-tag tests pass; JavaScript product unit tests were not repeated for this BDD-only repair.
**Gherkin:** ✅ Acceptance lane passes — 597 scenarios and 11,140 steps; native Claude subset also passed 63/63 scenarios.
**Build:** ✅ Success — CLI and relay builds run by `scripts/dev bun run test:bdd`.
**Lint:** ✅ Gherkin validation passes; step-file Prettier check passes. Root ESLint intentionally excludes `steps/`.
**Typecheck:** ⚠️ Package typecheck passes; an extra strict step-file check has 41 existing primary diagnostics, reproduced unchanged against HEAD before this repair.
**Scenarios:** All 5 targeted expanded examples pass; no scenario was skipped or removed.
**Refactor:** ✅ Completed — shared fixture installation, process execution, and response assertions replace the prewritten effects and sentinels.
**PR Scope:** ✅ Diff matches ticket scope — M1's three scenario definitions, bindings, and supporting evidence only.
**Dep Drift:** ✅ Clean — no dependencies, templates, or production runtime changed.
**Parent Epic:** N/A
**Reconcile:** ✅ No pattern deviation — existing catalogue identity and real subprocess boundaries are retained.
**Experience:** ⏭️ N/A — test-only change.
**Surface Evidence:** ✅ Simulated Claude host executes the real registered legacy command; live host dispatch/response merging is not claimed.
**Evidence limits:** ⚠️ Existing strict step-file type errors remain. The independent scoped review passed, but the workflow's branch-wide phase-stamp coverage check includes previous ticket work; no phase-completion claim was made.

## Discriminating proof

| Check | Result |
| --- | --- |
| Stronger assertions against old setup-only fixtures | 5/5 examples failed with no executed guard response |
| Final isolated baseline | 5/5 examples passed |
| Remove all legacy probe calls | 5/5 examples failed |
| Run the real guard on an unprotected input, producing exit 0 with no approval response | 5/5 examples failed |
| Add a duplicate plugin effect | Coexistence failed; other 4 examples passed |
| Full native feature lane | 63 scenarios, 3,013 steps passed |
| Complete acceptance and proof lane | 597 scenarios, 11,140 steps, 51 proof-tag tests passed |

The baseline and fault variants ran against temporary copies of the step
definitions, importing the real project collaborators and generated plugin.
Repository production code was never mutated for these probes.

The registered hook is copied unchanged from
`packages/cli/templates/hooks/pre-tool-config-guard.ts` to its catalogue-derived
legacy path. Its command is reread from project settings after the attempted
plugin event, then executed with an ESLint edit input. Assertions require one
actual response, exit 0, parseable JSON, `permissionDecision: ask`, an ESLint
config reason, and the target path. Coexistence additionally requires no plugin
effect; the existing proof and plugin-failure assertions remain.

The Then wording now names the approval request actually observed, rather than
claiming that a separate guard probe proves live host response combination.

## Independent review

Claude Opus approved the final source and scenario text with cross-agent
independence, receipt `f0d46677-7064-4dcf-901e-1f622bd24a9a`.
It found no blocking errors. A non-blocking note remains: a live host combining
conflicting sibling decisions is beyond this process-level proof.

## Remaining work outside this repair

Assessment M2 (same-task post-cleanup handover), M3 (coexistence status coverage),
and the eight other assessment findings were not changed. Publishing and
installing a release were not performed.

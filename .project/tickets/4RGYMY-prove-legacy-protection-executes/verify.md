# Final local verification for PR 6025

## Verify Checklist

**Test Suite:** ⚠️ Local environment limitation: another checkout holds the exclusive Vitest lock. Last relevant unit run passed 140 tests with one existing prerelease skip; R1 then passed its 100 affected tests. Fresh integrated full-suite/proof-tag results are required from CI before merge; no fresh local full-suite pass is claimed.
**Gherkin:** ⚠️ Partial-lane pass: both affected Claude feature files pass 104 scenarios and 5,090 steps after integration with main; full integrated acceptance/proof-tag lanes remain pending CI.
**Build:** ✅ Generated plugin bundles rebuilt successfully from the integrated source; all five generated surfaces verified current.
**Lint:** ✅ Root lint and Gherkin validation pass.
**Typecheck:** ✅ Package typecheck passes; extra strict step-file diagnostics remain documented pre-existing debt.
**Scenarios:** ✅ All 104 expanded affected examples pass; no WIP scenario is enabled or skipped by this repair.
**Refactor:** ✅ Completed — abbb238bf and 81dfa82e9; optional diagnostic hash optimization reverted/deferred.
**PR Scope:** ✅ Diff matches the issue 6004 integrity fix and the explicitly requested BDD/TDD quality repairs, audit and refactor; main integration adds no separate feature to this PR diff.
**Dep Drift:** ✅ Clean — existing YAML dependency, no manifest/lockfile upgrade.
**Parent Epic:** N/A
**Reconcile:** ✅ No pattern deviation — generator, dispatcher and status reuse the semantic helper; exact runtime/template/legacy validation remains.
**Experience:** ✅ No new user steps; normalization keeps the existing generated prompt hook working.
**Surface Evidence:** ✅ Real generated hook entrypoint and CLI/profile collaborators exercised; manual dispatcher walkthrough outside the test runner is recorded in N7QY4E delivery-evidence/walkthrough.json. Authenticated desktop GUI execution is not claimed.
**Evidence limits:** ⚠️ Full integrated CI is pending and blocks PR readiness/merge; local test contention, simulated Claude command adapters, and no new desktop release installation remain explicit.

Audit passed: final diff-scoped architecture/config/learning/domain checks; no dependency violations. Independent Claude Opus reviewed the combined handwritten implementation/tests and approved with no errors (7cbda067-989c-4808-b5c1-9dd42f626463); the only subsequent source edit is its suggested YAML-assumption comment, independently re-reviewed in N7QY4E delivery-evidence/comment-review.json.

The older M1/M2 implement-exit branch-wide stamp could not cover other ticket archives/oversized generated docs. The supported skip records that administrative limitation explicitly, while retaining the actual scoped independent approvals and runtime evidence. No fabricated review or changed gate configuration is used. This local completion evidence does not declare PR readiness; CI must pass at the final head before admin merge.

Traceability: the 140-test audit run is recorded in `.project/tickets/N7QY4E-keep-desktop-plugin-gates-active/audit-refactor-evidence/audit-tests.log.gz` (audit fix commit `3e2f66f6d`). M1 means the legacy-protection repair (`4RGYMY`); M2 means same-session cleanup handover (`117CBF`); R1 means the shared test-header helper (`81dfa82e9`). Exact timestamped skip records are preserved in `.project/tickets/N7QY4E-keep-desktop-plugin-gates-active/delivery-evidence/phase-stamp-skips.log`.

## Historical verification

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

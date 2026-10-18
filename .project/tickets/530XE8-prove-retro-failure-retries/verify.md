# Retrospective assurance verification

## Verify Checklist

**Test Suite:** ✅ Corrected focused coverage passes 149/149; smoke passes 2,194/2,194. The prescribed full run passed the existing 11,152 CLI tests with 12 skips, relay 198 with one skip and collector 153. Its second CLI pass exposed six overstrict new fixture assertions requiring an absent spool file; these were corrected to require an empty raw queue and all 149 focused tests passed twice afterward. The original aggregate run exited 1; it is not relabeled green.
**Gherkin:** ✅ Both prescribed acceptance executions pass 596 scenarios/11,118 steps each, plus 50 proof checks each; these are repeated executions, not distinct scenarios. Changed-text Gherkin lint passes. The legacy manual feature remains excluded from Cucumber.
**Build:** ✅ All prescribed package builds, including the website, pass.
**Lint:** ✅ Full root ESLint and Gherkin lint pass; corrected test also passes targeted ESLint and formatting.
**Typecheck:** ✅ Prescribed TypeScript, Astro and Python mypy checks pass.
**Scenarios:** ⏭️ Skipped — task uses inline test definitions, not a BDD completion ledger. Manual scenario proof limits remain explicit.
**Refactor:** ⚠️ Four production candidates resolved without change. One new fixture extraction is planned; completion and its test result will be recorded after execution.
**PR Scope:** ✅ Direct retry proof, manual contract corrections and evidence only; no production behavior, timeout, dependency or review-policy change.
**Dep Drift:** ⚠️ Two pre-existing website runtime names (astro-mermaid and satteri) are absent from ARCHITECTURE.md; this task changes no runtime dependencies.
**Parent Epic:** N/A.
**Reconcile:** ✅ Existing process-boundary testing, temporary-project, model-resolution and generated-parity conventions retained.
**Experience:** ⏭️ N/A — tests and evidence add no product steps or new persona-facing flow.
**Surface Evidence:** ✅ Six real Stop → real source CLI → fake external Codex failures remain silent and retryable. A valid empty retry commits the exact offset/tool/fire count once; no-growth Stop performs no third extraction. No findings are queued or filed.
**Evidence limits:** ⚠️ Manual scenarios are excluded from Cucumber. Cross-process timeout, pre-existing-offset retry and one finding-bearing Stop-to-egress-to-filing journey remain unproved. No fresh Desktop activation or exhaustive mutation score is claimed.

## Audit and security

Diff audit passes: config Healthy/Changed:no, no dependency violations in eight
modules/five dependencies, and no changed agent configuration, learning or domain
references require repair. Whole-workspace Knip, clone totals and outdated-package
discovery are outside scope. The principle selector encountered two changed
tickets; explicit `resolve-verify-ticket --ticket 530XE8` selects this task. No
implementation plan or declared principle trace exists, so that check is N/A.
All five generated surfaces are current; 276 parity pairs/11 contracts pass.

Raw Bun audit reports eight baseline advisories (two high, three moderate, three
low). The exact existing CI policy command passes with its already-declared
GHSA-vfj7-8cjw-p6xm and GHSA-ch52-4w7c-c8xp exclusions. Both live GitHub advisories
have no patched version. No exclusion or dependency upgrade was added. Python
and Rust audits report no issues; Go reports no affected reachable symbols,
while retaining module/import advisories outside called code.

## Review

Claude/Opus review 8edb5a3c-7545-4bca-b4d5-4cff600c6d0c approved the then-current
six-case proof and manual feature. Its authentic implementation stamp preceded
verification, but it predates the empty-spool fixture correction and planned
helper extraction; fresh final review is still required. Earlier review
f212b5db-10ca-4ebf-8936-87f84eb0ee47 prompted the invalid-array-item case and
native response_item fixtures. Only the two oversized generated CLI bundles
were coordinator-excluded; canonical generation and parity cover them.

Remaining suggestions are answered: the existing Vitest test budget is 60
seconds against three separately capped 10-second Stop processes. Native
function calls intentionally lack outputs to avoid triggering the separately
covered completed-pair public-filing branch. Fresh session IDs and afterEach
cleanup isolate global offsets, without claiming crash cleanup.

## Mutation proof

A semantic mutation treated failed extraction with empty findings as success;
all six new cases failed. The original production source was restored byte for
byte and the 149 focused tests passed again. Removing only the legacy exit-code
guard did not fail these tests because the public typed handler independently
maps extraction failure to a failed CLI result; that experiment did not change
the observable contract and is not counted as a killed mutation.

## Execution records

Logs: .project/tmp/current-verify.log, current-full-lint.log,
current-focused-green.log, current-retry-semantic-mutation.log,
current-focused-restored.log, current-smoke.log, current-policy-audit.log,
current-audit-*-final.log, current-generated.log and current-parity.log.
Earlier hosted source CI39049110781 passed at 4cf8306; it predates this task and
is not proof of these changes. Release lockfile review coverage and merge
approval remain separate delivery questions; this task grants no exceptions.

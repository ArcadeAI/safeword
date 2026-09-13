# Verification

## Verify Checklist

**Test Suite:** ✅ Final full verification green: retro relay 198 passed / 1 skipped, retro collector
153 passed, and CLI 9,610 passed / 36 skipped in each of two complete passes
**Gherkin:** ✅ 1,496 acceptance scenarios passed / 3 skipped; dedicated acceptance contract 595/595;
45/45 BDD proof checks passed
**Build:** ✅ CLI, relay, collector, and nine-page website builds pass
**Lint:** ✅ Clean
**Scenarios:** All 0 scenarios marked complete
**Refactor:** ✅ Completed after the repository audit: consolidated generated-file reconciliation,
fixed numbered-principle trace matching, removed stale Knip configuration, and made the website's
Sätteri runtime dependency explicit
**PR Scope:** ✅ Changes cover the ticket plus the user's explicitly requested full-verification,
repository-audit, and audit-driven refactor repairs
**Dep Drift:** ✅ Clean
**Parent Epic:** N/A
**Reconcile:** ✅ No pattern deviation
**Experience:** ⏭️ N/A — not persona-facing
**Surface Evidence:** ✅ 2/2 affected surfaces have recorded proof
**Evidence limits:** ⚠️ The current Codex sandbox cannot bind the relay's loopback ports or write the
default npm cache, so the root aggregate suite retains environment-only failures in those lanes. The
current delta is covered by focused tests and the dedicated CLI acceptance suite. The external
quality-review coordinator exhausted its routes; supplemental same-thread review is recorded as
non-independent evidence.

## Current Rerun — 2026-09-13

- Full build and typecheck lanes pass for the root, CLI, relay, collector, website, and Go modules;
  `mypy .` passes with no issues.
- Dependency audits are available and green: all five Bun audits, `pip-audit`, and `govulncheck`
  report no known vulnerabilities.
- CLI BDD acceptance passes 595/595 scenarios and 11,100/11,100 steps. The combined BDD proof and
  focused Python/generated-plugin regression run passes 190 tests with one intentional
  environment-dependent skip.
- The root acceptance run completed 1,499 scenarios: 1,468 passed, 3 skipped, and 28 failed. Twenty-
  three failures require loopback binding or the default npm cache, both denied by the Codex sandbox.
  The other five exposed stale generated plugin artifacts and non-hermetic reconciliation fixtures;
  both defects were fixed, then the affected four scenarios passed with 182/182 steps.
- Regenerated Claude and Codex plugin runtimes now ship `pip-audit`; both generator freshness checks,
  lint, TypeScript, Gherkin lint, formatting, and `git diff --check` pass.
- Repository-scope audit completed. Config, principles, domain references, architecture, docs, and
  learning checks are clean. Knip/dependency-cruiser findings remain the documented archive,
  experiment, generated-surface, and public-API baseline; no safe deletion was inferred. The only
  available package update is an already-compatible `@types/node` patch, so no manifest churn was
  added.
- BDD/TDD quality assessment found declarative scenarios, discriminating behavioral assertions, no
  `.only`, and no new weak truthiness/defined/no-throw assertions. The opt-in skip is the intentional
  live Codex boundary test. A real-time wait remains only where the behavior under test is a shared
  deadline across independent review IDs.
- Refactor scout found no justified production refactor in the latest Python-tool delta: the tool
  contract is already single-sourced and package-manager handling is parameterized. Rewriting it
  would add churn without reducing duplication or risk.
- Quality-review job `ae8feb49-b92d-4ee5-be52-64c18b0f7549` exhausted Claude Opus, Claude Sonnet,
  OpenCode, and Codex fallback routes without findings. The required degraded fallback produced no
  blocking finding, but it is not independent coverage.
- The installed dogfood marketplace was corrected from a stale worktree to this worktree. Concurrent
  dogfood installs alternated the shared cache between `1.0.0-rc.1` and `1.0.0-rc.3`, so the local
  execpolicy now keeps separate narrow allow rules for both immutable runtimes. Both ordinary review
  prefixes match `allow`; executable RED and `review status` match no allow rule. Arcade/Bosslevel
  remains `default_tools_approval_mode = "approve"` with no broad sandbox-network override.
- A final Codex restart is required to record the new plugin's `session-start` hook. Four other hook
  events already have current proof.

## Focused Evidence

- Final full verification: 9,961 package tests passed with 37 expected skips; the 9,610-test CLI
  suite was repeated by the verification plan and remained green on both runs.
- `packages/cli/tests/review/surface-parity.test.ts`: 44/44 passing before full verification.
- Generated Claude plugin check: current at `1.0.0-rc.1`.
- Generated Codex plugin check: current at `1.0.0-rc.1`.
- Monorepo TypeScript and Astro type checks: 0 errors.
- Execpolicy: `quality-review`, `scenario-gate`, and `plan-implementation` match their separate allow
  rules; executable RED, status, and arbitrary Bun commands do not match.
- Installed-Codex approval-boundary live test: 1/1 passing against the real installed versioned
  Safeword runtime and the active Codex rules file.

## Repository Audit and Refactor

- Full repository audit completed after verification; learning, principle-trace, and domain-doc
  checks are clean after repairs.
- Fixed a real principle checker defect: numeric presentation prefixes in trace rows now normalize
  the same way as source principle headings, with a regression test.
- Repaired seven dead evidence references in two historical implementation plans.
- Consolidated four duplicated rubric-generator check/write implementations into one helper that
  preserves mtimes when generated output is unchanged; its direct missing/stale/write/mtime contract
  tests and the complete 134-test focused regression set pass.
- Removed one stale Knip fixture ignore and documented Sätteri as a config-loaded dependency.
- Independent Claude Opus quality review `a18209be-ff36-47b2-a8e0-4f368d172eb0` approved the core
  design. Its nonblocking suggestions were implemented and covered by focused tests.
- Final independent Claude Opus quality review `25a24b1b-100f-49f1-be66-7dbe206fe3f6` again approved
  with no blocking findings. All eight cleanup suggestions were implemented: the live boundary now
  checks the complete documented argv and exact empty-rule result for disallowed commands; generator
  tests use an explicit non-colliding output argument and cover update/no-op/check success; no-op
  generation reports “already current”; Claude skill-reference namespacing is documented and tested;
  the cachebuster fixture derives from the current version; and malformed historical tables are fixed.
- Post-improvement focused evidence: 30/30 generator, Claude catalogue, and Codex release-contract
  tests pass; installed-Codex approval-boundary live test passes 1/1; root lint/typecheck pass; Claude,
  Codex, rubric, and historical-catalogue generated checks are current.
- Subsequent independent reviews `f34021b4-8b8b-4990-960d-ac61f5f09f07`,
  `a81690be-65d0-47b7-a338-764d53b6ccb6`, `d5b884a0-65d0-476a-a2d7-a2063f02840a`, and
  `9d627a5a-0bfb-4f71-9855-282796f68eb1` supplied additional edge-case findings. Each actionable
  finding was repaired before the next pass.
- Terminal independent review `c62341ad-6aaa-4e69-b833-74d13c134520` approved. Its final warnings
  are closed: route failures use typed errors; aggregate `--check` runs abort on stale rubrics without
  writing; Codex manifest versions are validated in every mode; ordinary reviews reject every
  RED-only flag; earlier prompt denials survive later sibling errors; argv-less dispatcher calls fail
  cleanly; and the live allow-side covers no-context, multi-target, and quiet command variants.
- Final focused evidence after those repairs: 97/97 contract and generator regressions, 122/122 full
  review-wiring cases, and 1/1 real installed-Codex approval-boundary test pass. Root lint/typecheck,
  Prettier, Markdown lint, and `git diff --check` pass. Claude and Codex plugins plus all generated
  rubrics and the historical catalogue are current at `1.0.0-rc.1`.
- Remaining audit output is repository baseline rather than a ticket regression: generated and
  historical clone volume, historical research executables, script-string resolution limitations,
  and unused-export candidates that require separate ownership decisions.

## Surface Evidence

| Affected surface | Proof | Result |
| --- | --- | --- |
| Codex independent review | Live bounded `quality-review` through installed `0.83.1` runtime after restart | Reached Claude and returned a typed verdict without a user approval prompt |
| Arcade/Bosslevel MCP | Inspected effective Codex server configuration after restart | `default_tools_approval_mode = "approve"`; no general sandbox network override |

## Status Poll Boundary

A synthetic `review status` call ran in the normal workspace sandbox. It returned
`REVIEW_JOB_NOT_FOUND` as expected and reported no file, network, configuration, package, or
destructive effects.

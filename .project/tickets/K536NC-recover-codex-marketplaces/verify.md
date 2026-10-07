# Verification evidence

## Reopened profile correction

Earlier completion evidence below is historical and superseded by the hosted review's consequential profile mismatch. Merge remains blocked pending fresh final verification and current-head CI.

- RED: three divergent-profile regressions failed against the previous source (install changed the process profile, observation saw the wrong plugin, automatic migration incorrectly skipped).
- GREEN: all 100 targeted tests passed, including finalization. Independent review required distinct local declarations between the two profiles; that discriminating fixture is now present and will run in the complete suite.
- One resolved environment now feeds config reads, profile lock, marketplace discovery/add/upgrade/replace/restore, plugin install/verification, proof/activation and migration reporting. Partial overrides inherit PATH; process.env remains unchanged.
- Fresh native Codex 0.153.4 two-profile programmatic execution: requested profile installed/enabled Safeword 1.0.0 with no errors; other profile config, plugin state and activation directory stayed unchanged. Temporary profiles only; persistent main-checkout registration preserved.
- Claude Opus independent review approved the corrected source and tests (f3a0f733-f038-480b-9752-2c8a990192a1, cross-agent). Its non-blocking Git-branch coverage suggestion is deferred: the shared environment is forwarded through all Git operations, existing pin/rollback tests remain in the complete suite, and the accepted local-source defect has discriminating profile tests. Generated carriers are authenticated exclusions and all five generated-surface checks pass.
- Changed-file ESLint, root typecheck and formatting pass. Diff architecture audit reports no violations (65 modules, 99 dependencies). No dependency or lockfile changes.
- Complete suite is waiting for another chat's test lock; no other session or worktree was modified or interrupted.

## Historical evidence

Audit passed: diff-scoped architecture check found no violations (64 modules, 97 dependencies). Changed tests have behavior assertions, isolated fixtures, parameterized rejection boundaries, and no arbitrary sleeps; independent review confirms each authorization guard can be caught if removed. Configured local documentation sources (README and website docs), architecture narrative, changed references, and namespace/principle checks show no contradictory impacted claims. No agent configuration or learning files changed. Whole-repository unused-code, clone, and dependency-freshness discovery were intentionally excluded from this diff audit. Verification passed with the previously disclosed baseline findings.

## Verify Checklist

**Test Suite:** ✓ 96/96 targeted Codex migration tests pass; complete CLI rerun passes 10,473 tests with 14 skipped (609 files). Relay 198 pass/1 skip; collector 153 pass. The first full CLI run had one intermittent review-routing deadline failure, retained below.
**Gherkin:** ✅ Acceptance lane passes — 596 scenarios, 11,118 steps.
**Build:** ✅ Success — authoritative build plan, including CLI, plugins, relay/collector, and website.
**Lint:** ✅ Clean — changed TypeScript files and formatting checks passed.
**Typecheck:** ✅ Clean — authoritative typecheck plan passed after the concurrent Astro cache race was corrected by a sequential rerun.
**Scenarios:** ⏭️ Task uses inline regression checks; no new feature scenario ledger.
**Refactor:** ✅ Completed — extracted configured-marketplace handling to retain the existing complexity limit without suppressions.
**PR Scope:** ✅ Diff matches ticket scope: local marketplace authorization, native recovery advice, regression fixtures, and generated carriers.
**Dep Drift:** ✅ Clean — no dependency or lockfile changes. Baseline audit findings remain below.
**Parent Epic:** N/A
**Reconcile:** ✅ No pattern deviation — existing marketplace/profile observation and error contracts retained.
**Experience:** ✅ No new friction — native local install requires zero new steps. Missing-source recovery still requires selecting a persistent source and explicitly repairing its registration.
**Surface Evidence:** ✅ Source CLI, native Codex registration/discovery/installation, and generated plugin freshness have recorded proof.
**Evidence limits:** ⚠️ Baseline dependency audit findings and one intermittent first-run review deadline failure are retained below. Standalone proof/smoke checks subsequently passed after the other chat's lock cleared. No other chat was interrupted. Native path normalization and real multi-layer configuration remain host-contract coverage gaps; production authorization boundaries have simulated subprocess coverage.

## Direct CLI evidence

- Native isolated profile: Codex 0.153.4 marketplace add wrote an absolute local source and source_type = "local". Before the fix, source-CLI codex install rejected it as not a Git marketplace. After the fix, installation reported installed/enabled Safeword 1.0.0, no errors, and expected restart-required state.
- Native missing-own registration: unchanged failure preserves Codex's failing source and gives native repair guidance; native marketplace add repairs it.
- Native broken-unrelated registration: unchanged failure explains global discovery coupling, retains the unrelated name/path, and offers explicit user choices.
- Simulated source CLI: 7/7 checks passed for matching absolute local source, mismatched source, matching relative source, wrong type, missing type, failed discovery, and local plugin version mismatch. Profiles were preserved and no marketplace add/remove/upgrade calls occurred.
- Targeted repository Vitest: 96/96 passed in 46.27s.
- Complete CLI first run: 10,472 passed, 14 skipped, one failed. Complete repeat: 10,473 passed, 14 skipped, no failures.
- Acceptance: 596/596 scenarios and 11,118/11,118 steps passed.
- Authoritative build and typecheck plans passed. Changed-file ESLint/Prettier and git diff checks passed.
- All five generated surfaces current.
- Independent complete-diff review: Claude Opus approved (61905c05-aa03-42d9-8e05-f1bb30c1bdf6, cross-agent). Generated runtimes were authenticated exclusions; identity/inventory and authored source/tests were included. Implementation stamp succeeded.
- Fresh native discovery still reports safeword at /Users/alex/Projects/safeword.
- Final standalone checks: BDD proof 47/47 passed in 1.11s; fast smoke 2,143/2,143 passed across 101 files in 30.82s. Commands ran sequentially after the shared lock cleared.
- All GitHub CI checks passed for source commit 2ec90435950640ffb8240109334328172b810f5c. Native isolated-profile install was repeated at that head: installed/enabled 1.0.0, no errors, expected restart-required state, changed=false.
- All GitHub CI checks also passed for c28ca22de1542afdc4ce7c189745ae686711970c, including both Node jobs and dependency audit.
- The changed=false repeat observed an already installed plugin. A subsequent fresh temporary CODEX_HOME at the unchanged implementation head genuinely installed/enabled Safeword 1.0.0: changed=true, enable effect, no errors, expected app-restart state. Native marketplace registration used a persistent main checkout. Real profile settings were untouched.
- Final simulated source checks passed 8/8, adding an exact matching tilde declaration/discovery pair; it is rejected without profile mutation or plugin installation. This directly observes the absolute-only boundary without adding a Vitest process.
- Named newer-pin coverage: `preserves newer explicit marketplace pin %s without profile mutation` covers both v9.0.0 and 9.0.0, requires PLUGIN_NEWER_PIN_PRESERVED/changed=false, and forbids marketplace add/remove and plugin add.
- Named source-agreement coverage: `preserves an unauthorized local profile declaration: %s` tests a declared /tmp/safeword-other against discovered /tmp/safeword; `fails closed for a configured non-Git marketplace with the same name` rejects a discovered local source absent from the user-global declaration. These simulate cross-layer disagreement/absence; they do not claim native multi-layer integration coverage.
- Review responses: inherited custom-environment/subprocess inconsistency is tracked as follow-up debt in this ticket; no production CLI call uses different profiles in one execution. Work-log timestamps are UTC and legitimately fall on October 7 while local PDT remains October 6.
- Exact implementation head for the fresh-profile install above: c28ca22de1542afdc4ce7c189745ae686711970c. Later changes only clarify evidence and mark the authorized ticket completion.
- Named discovery-error regression: `explains recovery when global marketplace discovery fails` requires the native fixture error text to remain present. Exact full-error retention, including the failing registration name/path, was observed in the real missing-own and broken-unrelated native probes; it is not claimed as a full verbatim automated host assertion.

## Remaining verification and baseline findings

The first full-suite failure was the unrelated two-second review fallback test in tests/cli-protocol/review-wiring.test.ts: it selected Claude instead of OpenCode. The unchanged complete repeat passed, establishing an intermittent result. No review-routing source was changed.

The repository-generated closing plan repeats root/package CLI suites and acceptance lanes. After one complete passing rerun and passing acceptance lane, the standalone BDD proof command waited behind PID 57114 in another chat's live qualification. Only this session's blocked closing command was stopped. Both remaining commands were subsequently retried sequentially and passed after that lock cleared:

```sh
bun run --cwd packages/cli test:bdd:proof
bun run test:smoke:fast
```

Dependency scanning returned eight existing JS advisories (two high, three moderate, three low) and six advisory records for existing Python urllib3 2.7.0. Other scanned lanes reported no vulnerabilities. This change introduces no dependencies and does not resolve those baseline findings.

Build and typecheck were initially run concurrently; Astro raced on data-store.json.tmp. Build completed, then the authoritative typecheck plan was rerun sequentially and passed.

Logs: /tmp/safeword-marketplace-regressions.log, /tmp/safeword-marketplace-verify.log, /tmp/safeword-marketplace-build-closing.log, /tmp/safeword-marketplace-typecheck-closing.log, /tmp/safeword-marketplace-deps-closing.log.

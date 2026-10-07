# Verification evidence

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
**Evidence limits:** ⚠️ Final standalone BDD proof/smoke commands remain pending behind another chat's new 63-case live run. Their test files passed in the complete default suite. The closing block was stopped while waiting, without starting another Vitest or interrupting the other chat. No all-green closing-gate or ticket completion claim is made.

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

## Remaining verification and baseline findings

The first full-suite failure was the unrelated two-second review fallback test in tests/cli-protocol/review-wiring.test.ts: it selected Claude instead of OpenCode. The unchanged complete repeat passed, establishing an intermittent result. No review-routing source was changed.

The repository-generated closing plan repeats root/package CLI suites and acceptance lanes. After one complete passing rerun and passing acceptance lane, the standalone BDD proof command waited behind PID 57114 in another chat's live qualification. Only this session's blocked closing command was stopped. Keep this ticket in verify until the remaining standalone proof and smoke checks run:

```sh
bun run --cwd packages/cli test:bdd:proof
bun run test:smoke:fast
```

Dependency scanning returned eight existing JS advisories (two high, three moderate, three low) and six advisory records for existing Python urllib3 2.7.0. Other scanned lanes reported no vulnerabilities. This change introduces no dependencies and does not resolve those baseline findings.

Build and typecheck were initially run concurrently; Astro raced on data-store.json.tmp. Build completed, then the authoritative typecheck plan was rerun sequentially and passed.

Logs: /tmp/safeword-marketplace-regressions.log, /tmp/safeword-marketplace-verify.log, /tmp/safeword-marketplace-build-closing.log, /tmp/safeword-marketplace-typecheck-closing.log, /tmp/safeword-marketplace-deps-closing.log.

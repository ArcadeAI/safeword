## Verify Checklist

**Test Suite:** ✅ 6,860/6,860 executed CLI tests pass locally (5 skipped), plus 167/167 relay tests (1 skipped); the clean full-suite rerun covered 449 files
**Gherkin:** ✅ Local acceptance lane passes (1,123 passed, 3 skipped; 44,831 executed steps pass, 4 skipped)
**Build:** ✅ Success
**Lint:** ✅ Clean
**Scenarios:** All 148 scenarios marked complete
**PR Scope:** ✅ Diff matches ticket scope
**Dep Drift:** ✅ Clean
**Parent Epic:** N/A
**Reconcile:** ✅ No pattern deviation
**Experience:** ✅ No new friction — Walked a team builder through upgrade → migrate → restart/trust → compatibility → exact-plan finalization → recovery. The hardest step is the necessary Codex restart and hook review. Compared with the unsafe legacy flow, the only added team step is one explicit, recoverable cleanup confirmation; protection remains continuous throughout.
**Surface Evidence:** ✅ 4/4 affected surfaces have recorded proof
**Evidence limits:** PR CI is external to this local verification record; the pushed head must remain green before merge. Dependency-cruiser reports the existing `codex-plugin/hooks.ts` orphan warning, which is not introduced by this diff.

Audit passed with warnings — 0 unresolved errors. The mandatory post-refactor audit found and fixed a language-pack dependency-boundary violation, removed 1,889 lines of unreachable direct-command and compatibility code, routed typed codify failures through the result boundary, and replaced one obsolete `bunx tsx` integration path with the shared built-CLI harness. Config drift, dependency boundaries, Knip, learning metadata, namespace domain docs, configured documentation, architecture reconciliation, Markdown, security audit, dependency freshness, and the 20-file test-quality sample are clean. jscpd recorded 537 clones / 8.61% at the repository scope (repo minus generated/ignored paths); no clone block includes a file changed by these tickets, so this is the post-refactor repository baseline rather than a ticket finding. Python experiment import-cycle/dead-code checks remain unavailable; the Go experiment reported no dead-code or outdated-module issues.

## Evidence

- Safeword resolver-driven local verification: 441 CLI Vitest files with 6,860 passing tests and 5 skipped, plus 8 relay files with 167 passing tests and 1 skipped. A pre-merge full run exposed one load-sensitive lock-runner failure; the exact case and its complete 11-test file passed in isolation, and subsequent clean full runs passed in full.
- Root local acceptance lane: 1,126 scenarios total; 1,123 passed and 3 intentionally skipped; 44,831 passing steps and 4 skipped.
- Main synchronization: merged `a717778d3`, regenerated the Claude plugin inventory after its dependency-readiness runtime changed, and reran the five integrity/profile tests plus the complete unit and acceptance lanes successfully.
- CLI build, documentation-site build, TypeScript, ESLint, Gherkin lint, Markdown lint, dependency-cruiser, and Knip all passed with no errors.
- `bun audit`: no vulnerabilities.
- Acceptance traceability: all 148 test-definition checkboxes are complete.
- Documentation coverage: configured sources `README.md` and `packages/website/src/content/docs` checked; `ARCHITECTURE.md` reconciles both generated monorepo packages and documents the runtime dependencies.
- Test quality: 20 sampled test files reviewed; assertions are behavior-specific, failure paths and boundaries are present, state is isolated, and no arbitrary sleeps were found.
- Surface matrix: CLI migration/status is covered by the public-command Vitest and acceptance lanes; hooks/proof continuity by restart, interruption, recovery, and proof-write scenarios; generated plugin and dependency readiness by 132 focused parity/readiness tests plus generation; reviewer timeout/process cleanup by runtime tests with observed descendant PID evidence.
- PR scope: all changed runtime, test, acceptance, template, and documentation files support issues #1996 and #2014; the review-only refactors preserve behavior while simplifying and strengthening the observable contracts.

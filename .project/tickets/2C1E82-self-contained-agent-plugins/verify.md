# Verification: Make each agent's plugin fully self-contained

> Superseded evidence: the checklist below describes the earlier `4260bfcfd` run, not the current head. Current verification is pending. The September 2 full run failed five CLI planning tests and the user-scoped Claude acceptance expectation; repairs and review regressions must pass before this ticket can be marked done.

## Verify Checklist

**Test Suite:** ✓ 9065/9065 executed tests pass (14 intentional skips)
**Gherkin:** ✅ Acceptance lanes pass: root 1493/1496 scenarios (3 intentional skips), package 587/587 scenarios
**Build:** ✅ Success
**Lint:** ✅ Clean
**Scenarios:** All 33 scenarios marked complete
**PR Scope:** ✅ Diff matches ticket scope
**Dep Drift:** ✅ Clean
**Parent Epic:** N/A
**Reconcile:** ✅ No pattern deviation
**Experience:** ✅ No new friction — Walked each supported agent from an enrolled project with missing transient state through first workflow use; state and the precise ignore rule appear lazily, with zero install steps and no authored knowledge invented.
**Surface Evidence:** ✅ 4/4 affected agent surfaces have recorded proof
**Evidence limits:** ⚠️ The current Codex task has not restarted into the installed plugin update, so live hook protection remains unverified. The isolated GEPA experiment has strict mypy coverage but no import-linter contract, and `pip-audit` is unavailable locally.

Audit passed with warnings. Dependency-cruiser found no violations across 408 modules and 671 dependencies. Python dead-code reported `ReviewSpecAdapter.evaluate` and `make_reflective_dataset`; both are framework callback methods on the adapter passed to GEPA, so the static findings are false positives. The documentation audit found and corrected one stale README claim about Claude's runtime authority.

## Surface evidence

| Affected surface | Proof | Result |
| --- | --- | --- |
| Claude Code | Generated-plugin freshness check, release-contract BDD, catalogue tests, and a packaged workflow smoke from a foreign working directory | Passed; Claude's workflows and hooks resolve from the generated plugin rather than project-local runtime |
| Codex | Codex catalogue release tests, packaged helper and lifecycle smoke tests, and selected-agent reconciliation proofs | Passed; skills and helpers resolve from the versioned plugin while missing transient state initializes after enrollment |
| OpenCode | Profile catalogue identity, collision, upgrade/uninstall, copied-guard containment, and real-process conformance contracts | Passed; plugin, commands, agents, skills, and guard stay profile-owned and selection-scoped |
| Cursor | Selected-agent lifecycle fixtures, project-runtime tests, and mixed-selection proofs | Passed; Cursor retains its complete project-local authority without forcing that runtime onto native-plugin agents |

## Evidence

- Exact Safeword verifier on `4260bfcfd` completed both full test plans, both BDD plans, every build and typecheck plan, and dependency scans under one serialized Vitest process at a time.
- Unique test corpus: CLI 8773 passed with 13 skipped; retro relay 186 passed with 1 skipped; retro collector 106 passed.
- Root BDD: 1496 scenarios, 1493 passed and 3 skipped; 68,600 steps, 68,596 passed and 4 skipped. The full-suite rerun also proves route-classification scenarios retain their intended review and fallback budgets under accumulated subprocess load.
- Package BDD: 587/587 scenarios and 10,954/10,954 steps passed, including the adjacent 33-scenario self-contained-plugin proof manifest.
- Build and typecheck passed for the root aggregate, CLI, website, retro packages, Go checker, TypeScript, Astro, and strict Python mypy lanes.
- `bun audit` reported no vulnerabilities; the Go vulnerability scan reported zero affected vulnerabilities. `pip-audit` was unavailable and reported as a coverage limit rather than a pass.
- Release validation passed after checking the committed Claude plugin against canonical sources under both normal and test caller environments.
- Diff-scoped audit: config sync healthy; dependency-cruiser clean; principle trace, learnings, surface/persona references, README, website docs, and architecture narrative reconciled.
- Test-quality review covered 70 changed test/step files. Assertions are behavior-specific and include failure and boundary cases. The only timer matches are controlled concurrency fixtures that synchronize on observable child readiness; they are not arbitrary sleeps.

## Remaining process follow-ups

- Bind a successful executable BDD receipt to implement exit instead of relying on ledger syntax until verify/done.
- Deduplicate root/package verification execution while retaining entry-point parity proof.
- Add a supported generated-architecture acknowledgement/reconcile command.
- Declare or vendor PyYAML for the system skill validator.

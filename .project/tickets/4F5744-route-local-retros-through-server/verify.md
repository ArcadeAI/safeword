# Verification: Route local retros through the durable server

Verified against `origin/main` on 2026-08-30.

## Verify Checklist

**Test Suite:** ✓ 9064/9064 tests pass (relay 189, collector 135, CLI 8740; 14 additional tests skipped by contract)
**Gherkin:** ⚠️ Repository acceptance lane passes (1,485 passed, 3 skipped; proof lane 587 passed). This ticket's 46-scenario contract remains `@manual`; its automated implementation evidence is the linked Vitest integration suite, not Cucumber execution.
**Build:** ✅ Success
**Lint:** ✅ Clean
**Scenarios:** All 46 scenario definitions have completed RED/GREEN/REFACTOR ledgers (138 phase checkboxes)
**Refactor:** ✅ Completed — eligibility and route logic were simplified without changing behavior
**PR Scope:** ✅ Diff matches ticket scope
**Dep Drift:** ✅ Clean
**Parent Epic:** N/A
**Reconcile:** ✅ No pattern deviation
**Experience:** ✅ No new friction — walked NTB through automatic local submission; worst step = none because delivery remains silent; new steps vs before = 0
**Surface Evidence:** ✅ 5/5 affected surfaces have recorded proof (CLI, Claude, Codex, Cursor, collector/relay Railway path)
**Evidence limits:** ⚠️ Repository-wide mypy has a pre-existing duplicate-module error in unchanged experiment fixtures; pip-audit is unavailable locally

Audit passed for the ticket diff; the factual checker also reported pre-existing broken principle traces in unrelated completed tickets.

**PR Scope:** ✅ Diff matches ticket scope: local client routing, public collector queue and worker, private relay intake, readiness and deployment wiring, documentation, generated host artifacts, and their BDD/TDD evidence. No unrelated product work is included.

- Relay: 189 passed, 1 skipped.
- Collector: 135 passed.
- CLI: 539 files passed; 8,740 tests passed, 13 skipped.
- BDD: 1,485 scenarios passed, 3 skipped; the proof lane passed 587 scenarios. Reconciliation restored 255/255 parity pairs and 8/8 contracts.
- Build: relay, collector, and CLI passed.
- Static checks: ESLint, Gherkin lint, TypeScript, and Astro passed.
- Supply chain: Bun audits and the Go vulnerability scan found no reachable vulnerabilities; `pip-audit` was unavailable.
- Independent quality review: the initial post-implementation pass requested changes; its release-relevant findings were corrected and targeted suites passed afterward.

Known baseline limitations:

- The repeated full CLI lane hit the one-second `review-run-bound` timing assertion once under sustained load. The first full run and the isolated rerun passed; no ticket code touches that boundary.
- Repository-wide `mypy .` reports duplicate module name `solution` in two existing Python experiment control directories. This branch does not change either directory.

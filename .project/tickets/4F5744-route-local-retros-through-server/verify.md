# Verification: Route local retros through the durable server

Verified against `origin/main` on 2026-08-30.

## Verify Checklist

**Test Suite:** ✓ 9093/9093 tests pass across the full package runs and final affected-suite reruns (relay 194, collector 140, CLI 8759; 14 additional tests skipped by contract)
**Gherkin:** ⚠️ Repository acceptance lane passes (1,488 passed, 3 skipped; proof lane 587 passed). This ticket's 46-scenario contract remains `@manual`; its automated implementation evidence is the linked Vitest integration suite, not Cucumber execution.
**Build:** ✅ Success
**Lint:** ✅ Clean
**Scenarios:** All 46 scenario definitions have completed RED/GREEN/REFACTOR ledgers (138 phase checkboxes)
**Refactor:** ✅ Completed — readiness validation was extracted into a named predicate; the production transport changes remain narrow and direct
**PR Scope:** ✅ Diff matches ticket scope
**Dep Drift:** ✅ Clean
**Parent Epic:** N/A
**Reconcile:** ✅ No pattern deviation
**Experience:** ✅ No new friction — walked NTB through automatic local submission; worst step = none because delivery remains silent; new steps vs before = 0
**Surface Evidence:** ✅ 5/5 affected surfaces have recorded proof (CLI, Claude, Codex, Cursor, collector/relay Railway path)
**Evidence limits:** ⚠️ Repository-wide mypy has a pre-existing duplicate-module error in unchanged experiment fixtures; pip-audit is unavailable locally

Audit passed for the ticket diff; the factual checker also reported pre-existing broken principle traces in unrelated completed tickets.

**PR Scope:** ✅ Diff matches ticket scope: local client routing, public collector queue and worker, private relay intake, readiness and deployment wiring, documentation, generated host artifacts, and their BDD/TDD evidence. No unrelated product work is included.

- Relay: full suite passed 194 tests with 1 intentional skip; the final changed integration file passed 73/73.
- Collector: full suite passed 139 tests before the final listener-regression addition; the final changed integration file passed 9/9, yielding 140 covered tests.
- CLI: full suite passed 8,758 tests with 13 intentional skips before the final reflexive-ancestry regression addition; the final readiness file passed 18/18, yielding 8,759 covered tests.
- BDD: 1,488 scenarios passed, 3 skipped; the proof lane passed 587 scenarios. Reconciliation restored 255/255 parity pairs and 8/8 contracts.
- Build: relay, collector, and CLI passed.
- Static checks: ESLint, Gherkin lint, TypeScript, and Astro passed.
- Supply chain: Bun audits and the Go vulnerability scan found no reachable vulnerabilities; `pip-audit` was unavailable.
- Independent quality review: successive post-implementation passes exposed the real-seam acceptance clock, misleading recurrence disclosure, missing readiness evidence, and idle-worker listener leak; all release-relevant findings were corrected and their targeted suites passed afterward.

Known baseline limitations:

- Repository-wide `mypy .` reports duplicate module name `solution` in two existing Python experiment control directories. This branch does not change either directory.

# Verification: Route local retros through the durable server

Verified against `origin/main` on 2026-08-30.

**PR Scope:** ✅ Diff matches ticket scope: local client routing, public collector queue and worker, private relay intake, readiness and deployment wiring, documentation, generated host artifacts, and their BDD/TDD evidence. No unrelated product work is included.

- Relay: 189 passed, 1 skipped.
- Collector: 134 passed.
- CLI: 539 files passed; 8,740 tests passed, 13 skipped.
- BDD: 1,484 scenarios passed, 3 skipped. The only red scenario was generated-artifact parity while the source template was newer than the dogfood install; reconciliation restored 255/255 parity pairs and 8/8 contracts.
- Build: relay, collector, and CLI passed.
- Static checks: ESLint, Gherkin lint, TypeScript, and Astro passed.
- Supply chain: Bun audits and the Go vulnerability scan found no reachable vulnerabilities; `pip-audit` was unavailable.
- Independent quality review: the initial post-implementation pass requested changes; its release-relevant findings were corrected and targeted suites passed afterward.

Known baseline limitations:

- The repeated full CLI lane hit the one-second `review-run-bound` timing assertion once under sustained load. The first full run and the isolated rerun passed; no ticket code touches that boundary.
- Repository-wide `mypy .` reports duplicate module name `solution` in two existing Python experiment control directories. This branch does not change either directory.

---
id: V4MATC
slug: python-importlinter-scaffold
type: feature
phase: done
status: done
scope:
  - .importlinter generation in the Python pack — root_packages from detected top-level package + one generic acyclic-siblings contract
  - unambiguous-package detection - exactly one importable package (dir with __init__.py) at repo root or under src/; anything else = no scaffold
  - add-if-absent gating on all three import-linter config forms (.importlinter, setup.cfg [importlinter], pyproject.toml [tool.importlinter])
  - ownership wiring - schema.ts ownedFiles, setup/upgrade scaffold, reset cleanup, template<->dogfood parity guards
  - install-guidance line for import-linter via the pack's existing package-manager detection (uv/poetry/pipenv/pip)
out_of_scope:
  - installing import-linter automatically (pack pattern is guidance-only)
  - layer/independence/forbidden contract modeling (user-owned; we ship only the generic cycle contract)
  - writing into pyproject.toml [tool.importlinter] (decided - standalone safeword-owned file)
  - multi-package / namespace-package / ambiguous layouts (fall back to audit's honest skip; widen later if demanded)
  - audit SKILL.md changes (its config-gated lint-imports invocation from #857 already picks the scaffold up)
done_when:
  - fresh setup on a single-package Python fixture yields .importlinter with correct root_packages + acyclic-siblings; lint-imports exits 0 on acyclic code and non-zero when a cycle is introduced
  - setup on a project with any pre-existing import-linter config form changes nothing
  - setup on an ambiguous layout (zero or 2+ top-level packages) scaffolds nothing
  - reset removes the scaffolded .importlinter; ownership and parity guards recognize it
  - setup output surfaces the package-manager-appropriate import-linter install command
created: 2026-07-05T22:07:00.387Z
last_modified: 2026-07-05T22:07:00.387Z
---

# Python pack: scaffold generic import-linter config (audit arch check out of the box)

**Goal:** A freshly set-up Python project runs a real lint-imports cycle check under /audit with zero manual configuration (parity with JS depcruise)

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.

## Work Log

- 2026-07-05T22:07:00.387Z Started: Created ticket V4MATC
- 2026-07-05T22:12:41.000Z Complete: intake - Understanding converged, scope established (gates confirmed by Alex)
- 2026-07-06T00:35:23.000Z Complete: define-behavior - 11 scenarios defined across 5 rules (set accepted by Alex)
- 2026-07-06T00:47:58.000Z Complete: scenario-gate - Scenarios validated (AODI) + adversarial pass x3 (2 blocking findings fixed, pass 3 PASS, stamped); impl-plan.md written (proof plan + build order in Approach)
- 2026-07-06T03:48:53.000Z Complete: implement — reconciled impl plan; 1 decision added, 4 reconciliation notes recorded; 12 RGR loops green (21 vitest + 20 cucumber scenarios); cross-scenario pass done (/quality-review APPROVE, 3 findings applied)
- 2026-07-06T04:05:42.000Z Complete: done — verify.md green (4750 tests, 281 cucumber, all lanes), Audit passed; ticket closed

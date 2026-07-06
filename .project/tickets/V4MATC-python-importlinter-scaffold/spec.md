# Spec: Python pack: scaffold generic import-linter config (audit arch check out of the box)

## Intent

Give Python projects the same out-of-the-box circular-import (architecture) check that JS/TS projects already get from safeword's generated depcruise config: setup scaffolds the one config file import-linter needs, so `/audit` runs a real `lint-imports` check instead of a permanent "manual evidence required" skip.

## Intake Brief

- **Requested by:** Alex (arcade.dev) — filed upstream as ArcadeAI/safeword#847 during the #826/#857 audit-parity review.
- **Cost of inaction:** Python projects permanently show audit's honest skip while JS projects get a real check. The recurring skip line trains users to ignore it (alarm fatigue), and real circular imports ship undetected — Python does not reliably catch them at runtime (an ImportError fires only when import order happens to touch a not-yet-defined name).
- **Reversibility:** Two-way door. A scaffolded config file plus pack wiring; `reset` removes it; no data model, public API, or migration.

## References

- Upstream tracker: ArcadeAI/safeword#847 (this feature), #826/#857 (audit-honesty prerequisite, merged), #827 (verify-lane parity, merged)
- JS analog: `packages/cli/src/commands/sync-config.ts` + `utils/depcruise-config.ts` (safeword-generated depcruise config)
- Python pack: `packages/cli/src/packs/python/` — NOTE: the pack ALREADY generates a layer-based `.importlinter` (`files.ts` `generateProjectImportLinterConfig`, gated on `detectPythonLayers`) and auto-installs import-linter with ruff/mypy when layers are detected. This feature EXTENDS that: acyclic_siblings contract for unambiguous single-package projects (the uncovered case), layers contract preserved where detected, install extended to the single-package case.
- import-linter v2.13: `lint-imports` CLI; config auto-detected from `.importlinter` / `setup.cfg [importlinter]` / `pyproject.toml [tool.importlinter]`; `acyclic-siblings` contract type (2.x); exits non-zero on broken contracts; enforces nothing without config

## Personas

- Technical Builder (TB) — installs safeword on a Python project; gets the check without learning import-linter
- (Non-Technical Builder benefits downstream via the same mechanism — the agent's code is cycle-checked without NTB doing anything — but the observable behavior is TB-facing setup/audit output, so JTBDs stay with TB)

## Surfaces

Affected:

- skip: behavior is agent-harness-independent (CLI setup/audit path); no per-surface variation to prove

## Jobs To Be Done

### python-importlinter-scaffold.TB1 — circular-import checking without setup

**Persona:** Technical Builder (TB)

> When I install safeword on my Python project, I want the audit's circular-import check to just work — the way it already does for JavaScript — so I can catch dependency tangles without learning or configuring import-linter myself.

#### python-importlinter-scaffold.TB1.R1 — a freshly set-up Python project gets a working cycle check with zero manual configuration

#### python-importlinter-scaffold.TB1.R2 — an existing import-linter configuration is never modified, duplicated, or overridden

#### python-importlinter-scaffold.TB1.R3 — when the project's top-level package cannot be determined unambiguously, safeword scaffolds nothing and the audit's honest skip stands

#### python-importlinter-scaffold.TB1.R4 — the scaffold is create-once, then the user's: setup or upgrade creates it when absent (same gating as R1–R3); safeword never overwrites it afterward (users extend it with their own contracts); reset removes it only when it is unmodified from the scaffold

#### python-importlinter-scaffold.TB1.R5 — import-linter is installed with the pack's other Python tools; a failed or skipped installation surfaces the package-manager-appropriate install command

## Rave Moment

skip: table-stakes — this delivers Python the same out-of-the-box behavior JS already has; parity against an existing internal bar, no beaten external expectation.

## Outcomes

- Fresh `safeword setup` — or `safeword upgrade` on an existing safeword project — on a single-package Python layout → `.importlinter` exists with detected `root_packages` and one `acyclic-siblings` contract; `/audit` runs `lint-imports` for real (green on acyclic code, red when a cycle is introduced). Upgrade-creates is the delivery vehicle for every existing safeword Python project.
- Projects with any pre-existing import-linter config are untouched; a user-extended scaffold is never overwritten by later upgrades.
- Ambiguous layouts scaffold nothing; today's honest skip stands — never a broken config that errors every audit.
- import-linter is auto-installed with the pack's other Python tools (existing pack behavior, now extended to single-package projects); if installation fails, audit's config-found-but-tool-missing branch (#857) still reports an honest, actionable skip — the scaffold never turns audits red by itself.
- `reset` removes the scaffolded file when unmodified; user-authored or user-extended files survive. Ownership/parity guards recognize the template (proof anchored in impl-plan, not a scenario — repo-internal infra).

## Open Questions

(none — config location resolved to a standalone safeword-owned `.importlinter`, and detection breadth resolved to narrow-unambiguous with honest-skip fallback; both converged with Alex in session, 2026-07-05)

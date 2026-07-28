# Work Log: project-extension-manifest

**Anchored to:** .project/tickets/BA144D-project-extension-manifest/ticket.md

---

## Session: 2026-06-26

- [03:04] Started BDD intake for GitHub issue #454.
- [03:04] Loaded BDD and ticket-system instructions, the issue body, project personas, and glossary.
- [03:04] Decision: keep the first user gate at JTBD confirmation; do not advance to acceptance criteria or scenarios until the jobs are accepted.
- [03:07] Figure-it-out frame: choose the Rave Moment that beats real extension pain without expanding v1 into plugin distribution.
- [03:07] Options considered: upgrade-preservation proof, plugin-like one-click sharing, cross-agent command palette. Picked upgrade-preservation proof because it directly addresses the issue's cost of inaction and keeps v1 additive.
- [03:07] Evidence checked: Claude project skills/plugins distinction; Codex skill/plugin split and hook trust review. Rave Moment now centers on `safeword upgrade` preserving customer files while refreshing adapters.
- [03:21] User accepted the JTBD gate and asked for a longer-horizon, one-year v2 Rave Moment.
- [03:21] Figure-it-out frame: choose a v2 product moment that beats the one-year drift problem without changing v1 scope.
- [03:21] Options considered: versioned team guardrail promotion, extension observability/effectiveness reporting, and cross-agent authoring UI. Picked versioned team guardrail promotion because it builds naturally from v1's explicit manifest and matches official plugin docs' split between project-local customization and team distribution.
- [03:22] Drafted ACs: TB gets one explicit extension inventory, lifecycle preservation, and actionable check diagnostics; SM gets cross-agent hook composition, explicit hook safety semantics, and loud unsupported-surface failures.
- [03:26] Added deferred process question: Rave Moment should likely ask for multiple horizons (v0.1 / v1 / v10) while using the horizon to sharpen v0.1 rather than neuter or over-scope it.
- [03:30] Quality-review finding: ACs preserved and validated extensions but did not explicitly require declared guide/template/skill extensions to become available on requested agent surfaces. Added TB1.AC3 and tightened hook safety semantics around `command`/`args`, timeout, mode, and project-local command paths.
- [03:35] Drafted scope gate: explicit `extensions` config, project-root path resolution, customer-owned source preservation, adapter/pointer exposure by compatibility matrix, all-agent hook preservation including Cursor same-event merge, neutral skill manifest reuse, and v2 pack distribution out of scope.
- [03:38] Quality-review finding: source preservation was under-specified unless extension source paths under safeword-owned/generated directories are rejected. Tightened scope/out-of-scope/done_when and clarified hook runtime-plus-project-script shape.
- [03:44] Completed intake and advanced to define-behavior after the user-directed proceed. Offered the advisory cold-start executability check for this cross-cutting feature but did not run it.
- [03:44] Derived dimensions across inventory state, extension kind, path safety, agent mapping, lifecycle command, and hook composition.
- [03:44] Wrote `features/project-extension-manifest.feature` and the R/G/R ledger with 14 scenario definitions / 23 executable example cases across 5 rules; advanced ticket to scenario-gate.
- [03:53] Verification: `bun run lint:gherkin` passed; lineage/coverage check reported 23 parsed scenarios, no lineage issues, and no uncovered/stale/orphan AC refs. `safeword check --offline` ran but exits 1 on pre-existing missing Python language pack.
- [03:53] Scenario-gate note: independent `/review-spec` remains pending because the available sub-agent tool requires explicit user authorization for delegation.
- [05:52] User authorized the independent review. Fresh reviewer reported 3 must-fix and 4 should-strengthen issues. Applied scenario revisions for no-op normalization, setup hook preservation, split diagnostics, explicit unsafe-hook check diagnostics, supported matrix surface rows, and path-safety boundaries.
- [05:57] Second independent review passed with no must-fix findings. Applied remaining strengthenings: runtime wrapper with outside-root script, same-kind/cross-kind duplicate-name rows, and upgrade adapter exposure.
- [06:03] Final independent review passed with 0 must-fix and 0 should-strengthen findings. Recorded the scenario-gate review stamp, wrote `impl-plan.md`, and advanced the ticket to implement.
- [06:04] Verification after scenario-gate exit: `bun run lint:gherkin` passed; lineage/coverage reported 16 scenario definitions, 53 executable examples, no missing lineage, and no uncovered/stale/orphan AC refs. `safeword check --offline` still exits 1 on the pre-existing missing Python language pack.

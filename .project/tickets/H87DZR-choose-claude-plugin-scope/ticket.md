---
id: H87DZR
slug: choose-claude-plugin-scope
type: feature
phase: done
status: done
scope:
  - make project-scoped Claude plugin installation the default
  - preserve explicit user-scoped installation as a supported option
  - make install, upgrade, status, proof, and idempotence scope-aware
  - detect overlapping project and user installations without silently removing either
  - preserve unrelated project settings, profile state, and installations in the other scope
out_of_scope:
  - local-only Claude plugin scope
  - automatic removal of an installation from another scope
  - changing Claude's shared physical plugin cache
  - changing Codex or Cursor plugin scope
done_when:
  - an unqualified Claude install converges the exact release at project scope
  - an explicit user-scope install converges the exact release without changing project files
  - upgrades and repeated installs converge independently and idempotently in either scope
  - status identifies the effective installation and reports cross-scope overlap with a safe explicit action
  - cleanup accepts proof from one unambiguous applicable scope and refuses ambiguous overlap
  - automated and live acceptance cover fresh, upgrade, overlap, and preservation behavior
phase_anchors:
  - define-behavior: .project/tickets/H87DZR-choose-claude-plugin-scope/spec.md
  - scenario-gate: features/choose-claude-plugin-scope.feature
  - plan-implementation: .project/tickets/H87DZR-choose-claude-plugin-scope/impl-plan.md
  - implement: .project/tickets/H87DZR-choose-claude-plugin-scope/impl-plan.md
  - verify: .project/tickets/H87DZR-choose-claude-plugin-scope/test-definitions.md
  - done: .project/tickets/H87DZR-choose-claude-plugin-scope/verify.md
created: 2026-08-03T03:21:19.035Z
last_modified: 2026-08-05T06:30:19Z
---

# Choose where Safeword runs in Claude

**Goal:** Let each project choose project-scoped or user-scoped Safeword Claude plugin activation.

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.

## Work Log

- 2026-08-05T06:30:19Z Complete: The scoped Claude lifecycle, overlap behavior, preservation rules, and cleanup authority meet every done condition with the verification and independent-review evidence recorded in `verify.md`.
- 2026-08-03T03:21:19.035Z Started: Created ticket H87DZR
- 2026-08-03T03:21:19.035Z Intake converged from the user's explicit approval: project scope is the safe default, user scope remains an escape hatch, and neither scope is removed implicitly.
- 2026-08-03T03:26:00.000Z Phase: intake → define-behavior. Two persona jobs and five rules capture scope choice, preservation, idempotence, overlap visibility, and cleanup safety.
- 2026-08-03T03:31:00.000Z Phase: define-behavior → scenario-gate. Ten dimensions produced twelve scenario declarations covering default and explicit scope, upgrades, failures, idempotence, applicability, overlap, and cleanup authority.
- 2026-08-03T03:37:00.000Z Scenario gate: Independent review found five must-fix gaps across three passes. The final 18-declaration set now proves unselected-scope absence and preservation, exact partial effects, disjoint status states, disabled/malformed/newer metadata, project-bound proof, and every cleanup rejection partition. Final re-review returned PASS; no build-only kill-risk remains after an isolated Claude 2.1.170 project/user overlap probe.
- 2026-08-03T03:40:00.000Z Host evidence: An isolated Claude 2.1.170 profile proved that project installation records the marketplace and enabled plugin in `.claude/settings.json`, user and project declarations can coexist, `plugin list --json` reports both entries against one shared cache path, and project entries include `projectPath`. Another repository's project entry remains visible in the profile-wide list, so applicability must filter by canonical current-project identity rather than selecting the first plugin entry.
- 2026-08-03T03:43:00.000Z Design convergence: Chose one `--scope project|user` interface with project as the default. Separate commands would duplicate the lifecycle, while automatic cross-scope migration would exceed authority and could disrupt other repositories. The implementation will model scoped declarations separately from Claude's shared cache, report overlap, and require an explicit native scope-removal action.
- 2026-08-03T03:48:44.000Z Plan gate: Independent review challenged architecture sequencing, live-host proof, scoped marketplace observation, canonical project identity, and cleanup-proof authority. The revised eight-slice plan resolves each concern with an architecture-first boundary, pre-status four-direction host gate, separate declaration/cache algorithms, one shared realpath identity contract, and per-project atomic proof v2. Final re-review returned PASS.
- 2026-08-03T03:55:55.000Z Phase: plan-implementation → implement. The user approved the reviewed single-ticket direction; its eight ordered slices remain coupled through one scoped declaration observer and cleanup-authority model, so implementation proceeds without splitting.
- 2026-08-03T06:04:10.000Z Implementation checkpoint: Project is now the typed default scope, user remains explicit, scoped marketplace/plugin reconciliation preserves the other scope, unsafe metadata and implicit downgrades are refused, canonical project aliases converge, and status reports applicable scope or overlap. An isolated Claude 2.1.170 matrix passed both upgrade and both uninstall directions with the local candidate payload. Public 0.71.0 predates the native identity files, so tagged candidate cache verification remains correctly deferred to the pre-release gate rather than weakening payload checks.
- 2026-08-03T06:04:10.000Z Proof and cleanup checkpoint: Successful SessionStart/UserPromptSubmit execution now writes one atomic schema-v2 proof per canonical project. Status and cleanup require that project-bound proof for one exact applicable scope, reject missing/stale/other-project proof, and refuse cleanup when project and user scopes overlap.
- 2026-08-03T07:08:00.000Z Phase: implement → verify. Whole-ticket quality review passed after fixing canonical subdirectory handling, human scope wording, generated-manifest proof anchoring, and customer documentation. The resolved verification plan passed 6,350 tests, 872 BDD scenarios, build, typecheck, dependency audit, generated-plugin contracts, and a diff-scoped architecture audit. The public release-candidate host gate remains intentionally pending because this task stops before release.

---
id: N9S5XG
slug: setup-scaffolds-project-dir
type: feature
phase: implement
status: in_progress
epic: project-namespace-default
parent: AQJ95G
depends_on: TAGWZ8
created: 2026-06-12T17:35:11.086Z
last_modified: 2026-06-12T20:44:00.000Z
scope:
  - 'ProjectContext gains the resolved namespace root (resolveNamespaceRoot, computed once at createProjectContext).'
  - 'Reconcile planners translate the legacy-prefixed namespace paths in SAFEWORD_SCHEMA (preservedDirs, personas/glossary managed files, re-entry marker reference) to the resolved root at planning time — the schema constant stays static.'
  - 'Fresh setup (no namespace dir) scaffolds .project/{learnings,tickets,tickets/completed,tmp} + .project/personas.md + .project/glossary.md.'
  - 'Arcade adoption: setup on a repo with an existing .project/ scaffolds INTO it and never overwrites existing personas.md/glossary.md (managed only-if-missing semantics).'
  - 'Legacy continuity: setup/upgrade on a legacy-only repo keeps operating on .safeword-project/ (resolver precedence) — no second namespace appears.'
  - 'diff/upgrade/reset honor the same translation so every lifecycle command agrees on one root.'
out_of_scope:
  - 'Migration of legacy installs to .project/ (sibling 9MMWS7 owns the upgrade prompt + move).'
  - 'Both-dirs advisory in safeword check (9MMWS7).'
  - 'Schema-wide refactor to a factory function — translation at planning time only.'
done_when:
  - 'setup in a clean repo produces .project/ with all namespace dirs + personas/glossary templates, and no .safeword-project/ appears.'
  - 'setup in a repo with arcade .project/ (real personas.md) adopts the dir and leaves user content byte-identical.'
  - 'setup/upgrade in a legacy-only repo touches only .safeword-project/ — no .project/ is created.'
  - 'Full suite green on a fresh build.'
---

# Fresh safeword setup scaffolds .project/

**Goal:** A fresh `safeword setup` scaffolds the namespace at `.project/` (implements epic [AQJ95G](../AQJ95G-project-namespace-default/spec.md) DEV1.AC1), adopting an existing arcade `.project/` without clobbering it, and leaving legacy installs untouched — seamless for the developer in all three states.

**See:** epic [AQJ95G](../AQJ95G-project-namespace-default/spec.md) for personas, JTBDs, and outcomes.

## Work Log

- 2026-06-12T21:15:00.000Z Implement: 11/11 scenarios green. ProjectContext.namespaceRoot + withResolvedNamespaceRoot translation at reconcile entry (one seam for install/upgrade/diff/uninstall). 87/87 reconcile-family tests; two fresh-repo fixtures flipped to .project/ (intended).
- 2026-06-12T17:35:11.086Z Started: Created ticket N9S5XG
- 2026-06-12T21:05:00.000Z Complete: scenario-gate — review 1 FAIL (4 must-fix: diff uncovered, 2 vacuous Thens, both-dirs partition missing; all applied), review 2 PASS (0 must-fix; 3 strengthens applied: upgrade-on-project scenario, trimmed duplicate tails, both-dirs relineaged to AC2 + dimensions synced). 11 scenarios. Stamped. impl-plan.md written. Phase → implement.
- 2026-06-12T20:44:00.000Z Intake: scoped as epic child. Design: ProjectContext carries the resolved root; reconcile planners translate schema namespace paths at planning time (schema constant stays static). Driver steer: seamless end-user experience — the three states (fresh/arcade/legacy) each just work. Phase → define-behavior.

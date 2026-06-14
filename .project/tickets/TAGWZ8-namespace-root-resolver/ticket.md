---
id: TAGWZ8
slug: namespace-root-resolver
type: feature
phase: done
status: done
epic: project-namespace-default
parent: AQJ95G
created: 2026-06-12T17:35:11.034Z
last_modified: 2026-06-12T17:35:11.034Z
scope:
  - 'Add a single namespace-root resolver (extend packages/cli/src/utils/configured-paths.ts): precedence explicit config paths.projectRoot → .project/ → legacy .safeword-project/. Computed once, exported, shared.'
  - 'Add paths.projectRoot to the config shape (root-level key alongside existing per-file paths.personas/glossary/architecture).'
  - 'Default subpaths for personas, glossary, architecture, tickets, learnings derive from the resolved root rather than the hard-coded .safeword-project literal.'
  - 'Per-file paths.personas/glossary/architecture overrides keep working and resolve against the resolved root.'
  - 'Migrate the ~48 hard-coded .safeword-project src literals to consume the resolver (CLI src). Hooks/templates + skills docs + website docs handled in the same exhaustive sweep; verify against a fresh build (subprocess tests can pass on stale dist).'
out_of_scope:
  - 'Fresh-setup scaffolding of .project/ (child N9S5XG).'
  - 'Upgrade-driven migration + both-dirs advisory (child 9MMWS7).'
  - 'New per-file paths.* keys beyond paths.projectRoot.'
done_when:
  - 'One resolver computes the root via the precedence; given a project with only .safeword-project/ it resolves there; given .project/ (or config) it resolves there.'
  - 'A configured paths.projectRoot redirects every namespace read/write; per-file paths.* still resolve against it; a paths.architecture override wins over the root default.'
  - 'No .safeword-project literal survives outside the resolver + its legacy-detection path (exhaustive grep, fresh build, full suite green).'
---

# Single namespace-root resolver with legacy detection + literal migration

**Goal:** Compute the safeword namespace root in one shared resolver (config → `.project/` → legacy `.safeword-project/`) and route every surface through it, so the default flips to `.project/` while existing installs keep resolving `.safeword-project/`.

**See:** epic [AQJ95G](../AQJ95G-project-namespace-default/spec.md) for personas, JTBDs, and outcomes. This child implements **SM1** (single resolver), **DEV1.AC2/AC3** (reads from resolved root, defaults derive from it), **DEV2** (configurable root + per-file overrides), and **DEV3.AC1** (legacy-only resolves unchanged).

**See:** [spec.md](./spec.md) for the child-scoped JTBD/AC subset.

## Work Log

- 2026-06-12T17:35:11.034Z Started: Created ticket TAGWZ8
- 2026-06-12T17:36:00.000Z Intake: scoped as epic child (resolver + literal migration). Inherits AQJ95G intake decisions. Phase → define-behavior.
- 2026-06-12T17:40:00.000Z Complete: define-behavior — 14 scenarios across 6 rules, all 6 ACs covered (lineage clean per safeword check). Phase → scenario-gate.
- 2026-06-12T17:50:00.000Z Complete: scenario-gate — independent review PASS (0 must-fix, 5 should-strengthen, all applied → 17 scenarios). Review stamped. impl-plan.md written (test layers + build order in Approach; hook-side resolver duplicated per P58R22 pattern). Phase → implement.
- 2026-06-12T18:35:00.000Z Implement: 17/17 scenarios green (resolver, defaults, override interaction, decoy surface). CLI surfaces + all 13 hooks routed through the resolver; differential test pins copies; transient/ignore blocks cover both roots; docs sweep done (SAFEWORD.md defines the convention once; skills/guides/website + straggler templates). Investigating 48 integration-suite failures before reconciliation.
- 2026-06-12T20:25:00.000Z Complete: verify — /verify + /audit run (invocation-logged); verify.md written; audit passed (0 errors). Ticket closed.
- 2026-06-12T20:21:00.000Z Complete: implement — impl plan reconciled (status implemented, 3 deviations). /quality-review APPROVE (no new deps, current APIs, no new security surface); /refactor applied 2 hardenings (directory-check, path-boundary anchor), each test-first. Full suite green on fresh build + frozen tree: 2699 passed / 0 failed / 1 skipped (the 25 earlier failures were stale fixture assertions vs the intended .project/ default flip — updated; plus stale node_modules for cucumber). Phase → verify.

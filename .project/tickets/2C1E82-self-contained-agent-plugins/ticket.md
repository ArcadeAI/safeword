---
id: 2C1E82
slug: self-contained-agent-plugins
type: epic
phase: implement
status: in_progress
children: ['V2AH4B', 'KDED4X', 'SF0RS0', 'GJB22B', 'JNZ2H5', '1DZ9W8']
phase_anchors:
  - 'define-behavior: .project/tickets/2C1E82-self-contained-agent-plugins/spec.md'
  - 'scenario-gate: packages/cli/features/self-contained-agent-plugins.feature'
  - 'plan-implementation: .project/tickets/2C1E82-self-contained-agent-plugins/impl-plan.md'
scope:
  - Give every supported agent one complete runtime authority while retaining project-authored knowledge and lazy runtime state.
  - Bound reconciliation to the selected agents and explicitly declared shared substrate.
  - Cover Codex, Claude Code, OpenCode, Cursor, every mixed selection, and legacy migration behavior.
out_of_scope:
  - Inventing a Cursor profile-plugin mechanism unsupported by the host.
  - Inventing missing authored knowledge or changing plugin trust and restart semantics.
  - Installing unrelated application tooling merely to execute a plugin workflow.
done_when:
  - Every supported agent workflow executes from its declared authority without borrowing another host's runtime.
  - Missing framework state and precise ignore rules initialize lazily without installation.
  - Single-agent and mixed-agent plans contain only declared selected-host requirements.
  - Release coverage rejects undeclared project-local executable references from native plugins.
created: 2026-08-18T16:58:37.428Z
last_modified: 2026-08-30T05:40:00.000Z
---

# Make each agent's plugin fully self-contained

**Goal:** Neither Claude nor Codex should depend on project-local .safeword/hooks, .safeword/skills, or .safeword/scripts once selected without the other — each plugin package ships and runs its own copies

**Why:** Claude has already packaged guides/scripts/hooks into the plugin bundle but a few wiring gaps (dispatch.js env var, unconditional install schema) still leave stale project-local .safeword content around with no auto-upgrade path; Codex still shells out to project-local .safeword/hooks and .safeword/scripts directly from its skills, unlike its already-self-contained lifecycle hooks (bunx --bun safeword@version)

## Work Log

- 2026-08-18T16:58:37.428Z Started: Created ticket 2C1E82
- 2026-08-30T01:00:00.000Z BDD intake resumed after a Codex PR-review session exposed the missing product boundary: plugin skills still required project-local executables, and `--agents=codex` proposed the full cross-host project payload. Added the intake brief and persona-specific JTBDs before changing implementation.
- 2026-08-30T01:10:00.000Z Rules amendment: confirmed that missing framework-owned runtime state must be initialized lazily by the invoking workflow, never through an installation process; authored knowledge and project configuration remain outside automatic state creation.
- 2026-08-30T01:12:00.000Z Rules amendment: lazy initialization also owns transient-state hygiene by adding the exact required gitignore rule idempotently and preserving existing ignore content.
- 2026-08-30T01:15:00.000Z Engineering scope drafted: native plugin runtime becomes self-contained; project enrollment, authored knowledge, and lazy state remain; agent selection becomes the reconciliation boundary; Cursor and safe legacy migration remain covered.
- 2026-08-30T01:18:00.000Z Intake confirmed; advanced to define-behavior with the accepted spec as the phase anchor.
- 2026-08-30T01:25:00.000Z Scenario feedback expanded the contract from Codex/Claude plugins to every supported agent: Codex, Claude Code, OpenCode, and Cursor each get one complete declared runtime authority, with selection isolation across all combinations.
- 2026-08-30T01:35:00.000Z Define-behavior complete: saved the dimension matrix, executable feature source, and R/G/R ledger; user confirmed the all-agent scenario boundary and advanced it to independent review.
- 2026-08-30T04:00:00.000Z Scenario review requested changes: closed three blocking vacuous/lineage gaps and strengthened recovery, surface, enrollment, version, ignore, persona, and partition coverage before re-review.
- 2026-08-30T05:18:00.000Z Scenario gate approved by an independent Claude Opus review after proving per-host runtime authority, lazy state and ignore hygiene, selection-scoped reconciliation, and safe migration boundaries. Advanced to implementation planning.
- 2026-08-30T05:40:00.000Z Implementation plan approved by an independent Claude Opus review after tightening Cursor/OpenCode authority proof, failure containment, legacy precedence, ignore ordering, principles alignment, and child-ticket reconciliation. Advanced to outside-in implementation.

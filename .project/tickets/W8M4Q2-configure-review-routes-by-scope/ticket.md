---
id: W8M4Q2
slug: configure-review-routes-by-scope
type: feature
phase: done
status: done
scope:
  - persist ranked reviewer and model routes at user or project scope
  - resolve each author independently with project then user then built-in precedence
  - expose set list and reset commands for review routes
out_of_scope:
  - merging route lists across scopes
  - storing credentials or proving paid model access during configuration
  - adding a project-local override file outside .safeword/config.json
done_when:
  - users can set ordered reviewer and model routes once for their local profile
  - projects can override one author without suppressing user routes for other authors
  - users can inspect the effective routes and their source
  - reset preserves unrelated configuration and restores fallback behavior
created: 2026-09-02T07:00:00.000Z
last_modified: 2026-09-02T07:00:00.000Z
phase_anchors:
  - 'define-behavior: .project/tickets/W8M4Q2-configure-review-routes-by-scope/spec.md'
  - 'scenario-gate: packages/cli/features/configure-review-routes-by-scope.feature'
---

# Configure review routes by scope

**Goal:** Let users keep their preferred review models locally while projects retain explicit authority.

**See:** [spec.md](./spec.md)

## Work Log

- 2026-09-02T07:00:00.000Z Intake converged from the user's accepted figure-it-out proposal. The existing project/user scope vocabulary and XDG profile convention are reused; a new local override file is rejected.
- 2026-09-02 Scenario review passed independently and was stamped. Planning starts with scoped precedence as the load-bearing slice; four implementation slices are planned and no ADR is needed.
- 2026-09-02 The implementation plan passed independent Claude/opus review after clarifying read/write scope isolation, architecture reuse, and executable proof wiring. Beginning the four planned TDD slices.
- 2026-09-02 Implemented scoped route persistence, strict per-author precedence, public set/list/reset commands, model-aware built-in inspection, generated host artifacts, lifecycle baselines, and documentation. Independent Claude/Opus quality review approved after its findings were applied.
- 2026-09-02 Verification completed: focused tests, lifecycle contract, BDD proof, lint, typecheck, end-user CLI walkthrough, audit, refactor assessment, and two independent Claude/Opus quality reviews are recorded in verify.md.

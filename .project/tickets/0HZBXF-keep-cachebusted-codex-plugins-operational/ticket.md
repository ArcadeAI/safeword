---
id: 0HZBXF
slug: keep-cachebusted-codex-plugins-operational
type: feature
phase: implement
status: in_progress
scope:
  - allow Codex plugin generation to accept one validated effective plugin version
  - stamp the effective version into the manifest package runtime and generated workflow paths
  - prove cachebusted bundles execute from their suffixed immutable cache directory
  - preserve the existing base-version release bundle and Claude and Cursor outputs
  - record a concrete upstream Codex plugin-root proposal without depending on it
out_of_scope:
  - changing Claude Code or Cursor runtime resolution
  - scanning the Codex cache to guess an active plugin version
  - introducing mutable aliases or symlinks across immutable plugin versions
  - changing Codex restart-bound plugin activation
  - filing or implementing an upstream Codex change
done_when:
  - a generated cachebusted bundle carries the same effective version in every identity and runtime reference
  - the cachebusted runtime reports its effective version and passes the Codex profile status contract
  - the default release generator remains deterministic at the base package version
  - focused release and parity tests prove Claude and Cursor behavior is unchanged
  - the design record states the proposed task-bound plugin-root contract for Codex
phase_anchors:
  - define-behavior: .project/tickets/0HZBXF-keep-cachebusted-codex-plugins-operational/spec.md
  - scenario-gate: features/keep-cachebusted-codex-plugins-operational.feature
  - implement: .project/tickets/0HZBXF-keep-cachebusted-codex-plugins-operational/impl-plan.md
product_plan_contract: v1
created: 2026-09-09T15:51:25.107Z
last_modified: 2026-09-09T15:51:25.107Z
---

# Keep cachebusted Codex plugins operational

**Goal:** Generate every Codex plugin artifact with one effective cachebusted version while preserving Claude and Cursor behavior

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.

## Work Log

- 2026-09-09T17:20:00Z Plan-implementation exit: Cross-agent review approved
  the five-slice plan after atomic-publication failure proof, direct and shared
  host-parity evidence, a named design-contract test, and the maintainer handoff
  were made explicit. Beginning TDD with the generator contract.
- 2026-09-09T17:13:00Z Plan review correction: Added RED proof for an existing
  output and injected mid-generation failure with staging cleanup, named the
  design-contract test, separated direct cachebuster side-effect hashes from
  shared generator parity proof, and added a maintainer README handoff for the
  external caller contract.
- 2026-09-09T17:04:00Z Plan review correction: Bound Claude/Cursor non-regression
  to before/after hashes around the same cachebusted generator subprocess,
  expanded whole-tree and profile-proof coverage, strengthened rejection to
  preserve the checked-in tree, and recorded the external cachebuster caller as
  an explicit delivery boundary.
- 2026-09-09T16:52:00Z Implementation planning: Selected an explicit
  `--version` plus fresh `--output` generator contract, build-time runtime
  identity injection only for non-base versions, and atomic publication of a
  complete bundle. Planned four slices with the real generator and Codex install
  boundaries first; no split or ADR is warranted for two small components and
  one reversible release-tool interface.
- 2026-09-09T16:40:00Z Scenario-gate exit: Cross-agent review approved all
  seven scenarios after the dual-install proof made exact-directory resolution
  discriminating. Remaining warnings are plan-level test-shape guidance, not
  accepted behavior gaps. No build-only uncertainty remains that repository
  code or an end-to-end test cannot settle, so no spike is warranted.
- 2026-09-09T16:31:00Z Scenario receipt review: Bound exact-directory
  resolution by installing both base and cachebusted bundles, split runtime
  launch from status identity, clarified invalid versus incompatible rejection,
  and made the design-record check path- and section-specific. Recorded Codex
  installation recovery as outside this generator's proof boundary.
- 2026-09-09T16:20:00Z Scenario review corrections: Added the missing explicit
  base-version acceptance partition and strengthened the artifact inventory,
  real Codex install boundary, no-repair status outcome, host-isolation contrast,
  and checkable upstream design record. Classified Claude Code and Cursor as
  affected verification surfaces because their byte stability is observed.
- 2026-09-09T16:12:00Z Define-behavior complete: Derived five dimensions and
  six representative scenarios covering coherent identity, validation before
  mutation, real installed execution, deterministic default generation,
  Claude/Cursor isolation, and the non-blocking upstream proposal. The user's
  prior acceptance of the layered design supplies the completeness decision;
  no scenario crosses the recorded exclusions.
- 2026-09-09T16:03:00Z Intake complete: Self-review confirmed that both JTBDs
  resolve to current personas, every Rule is observable at the packaging or
  runtime boundary, affected surfaces match the project inventory, and the
  contract stops at the explicit Codex-only boundary.
- 2026-09-09T15:58:00Z Intake: Confirmed the layered direction from the prior
  decision review: make Safeword's cachebusted Codex bundle internally coherent
  now, preserve immutable versioned installs and restart activation, and record
  a task-bound plugin-root proposal for upstream Codex.
- 2026-09-09T15:51:25.107Z Started: Created ticket 0HZBXF

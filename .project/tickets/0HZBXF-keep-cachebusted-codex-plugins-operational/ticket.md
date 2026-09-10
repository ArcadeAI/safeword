---
id: 0HZBXF
slug: keep-cachebusted-codex-plugins-operational
type: feature
phase: done
status: done
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
  - plan-implementation: .project/tickets/0HZBXF-keep-cachebusted-codex-plugins-operational/impl-plan.md
  - implement: .project/tickets/0HZBXF-keep-cachebusted-codex-plugins-operational/test-definitions.md
  - verify: .project/tickets/0HZBXF-keep-cachebusted-codex-plugins-operational/test-definitions.md
  - done: .project/tickets/0HZBXF-keep-cachebusted-codex-plugins-operational/verify.md
product_plan_contract: v1
created: 2026-09-09T15:51:25.107Z
last_modified: 2026-09-09T15:51:25.107Z
---

# Keep cachebusted Codex plugins operational

**Goal:** Generate every Codex plugin artifact with one effective cachebusted version while preserving Claude and Cursor behavior

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.

## Root Cause

Node 22 CI proved that real `codex plugin add` removes the prior base-version
cache entry when installing the cachebusted version. The failed assertion came
from incorrectly treating installer preservation as part of the host contract.
The coexistence test must restore the genuine base install as an intentional
stale-cache decoy, verify its runtime identity, then exercise the cachebusted
workflow. This rules out a platform difference and a missing base install.

## Work Log

- 2026-09-09T22:51:00Z Root-cause correction: Restored the base install as a
  validated stale-cache decoy instead of asserting that Codex preserves it.
- 2026-09-09T19:45:00Z Independent review recovery: Re-dispatched the bounded
  ticket packet through the installed cachebusted runtime. Claude Opus approved
  it cross-agent in review `44c7f018-c6c6-457c-aa2e-54c0beaab751`; after six
  durability and proof-quality fixes, Claude approved the revised source in
  review `19c6e046-8e8b-4103-855d-4889902d42fe` with no error-level findings.
  The focused plugin and BDD-proof lane passed 67/67, Gherkin lint was healthy,
  CLI typecheck passed, and `git diff --check` was clean. The installed bare
  `0.83.1` stamp helper still cannot witness the receipt because it resolves the
  stale cache path this ticket fixes; the durable coordinator records retain
  the cross-agent provenance.
- 2026-09-09T19:00:00Z Verify exit: The authoritative full run passed 9,857
  tests with 58 skipped; Gherkin passed 1,496 scenarios and 68,731 steps with
  three scenarios and four steps skipped. Build, lint, typecheck, dependency
  audit, BDD proof mapping, and the diff-scoped audit are green. The planner's
  redundant second CLI run hit five unrelated stale-build timestamp checks;
  all 112 tests in that file passed after a fresh build. Recorded the independent
  review-route limitation and complete surface evidence in `verify.md`.
- 2026-09-09T18:58:00Z Implement exit: Reconciled the plan with no decision
  changes or design deviations. The quality-review coordinator exhausted all
  configured reviewer routes (`231682f1-c740-4b72-a1df-d3f20a1429e1`), so the
  bounded fallback was a same-thread review of live worktree content with no
  independence or source-integrity revalidation. Its fixed-rubric result was
  `{"verdict":"approve","summary":"The coherent effective-version generator satisfies the accepted Codex bundle, host-parity, validation, and documentation contracts with discriminating tests.","findings":[]}`.
- 2026-09-09T18:04:00Z Cross-scenario refactor: Kept fresh-output
  ownership solely in the atomic publisher, with focused helper and full Codex
  release tests passing in `392b4437f`.
- 2026-09-09T17:53:00Z GREEN: Added validated effective-version generation,
  adjacent staging with atomic publication, coherent manifest/package/catalogue
  stamping, and build-time runtime identity injection. The focused real-process
  test and default-generation drift check both pass in commit `daa6b7764`.
- 2026-09-09T17:49:00Z RED: The real generator subprocess failed at the intended
  boundary because `--output` was not created. Independent executable-RED jobs
  `d9f0ed68-071c-4736-bfcc-d8899d4697e6` and
  `29b127a9-af6b-4d0a-af68-17ccc49e3610` both failed inside Safeword before
  review because the worker dropped its persisted trusted execution attestation;
  the terminal proof remains captured in commit `9dfc12648`.
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

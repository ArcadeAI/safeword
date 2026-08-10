---
id: BBNZ68
slug: offload-tests-without-blocking-local-work
type: epic
phase: intake
status: in_progress
children: ['S7TZF9', 'X2Z8MN', 'S2TF4J', 'BR373S']
scope:
  - Contributor execution preference and safe local fallback (S7TZF9)
  - Managed GitHub Actions workflow lifecycle (X2Z8MN)
  - Remote dispatch, observation and recovery (S2TF4J)
  - Trusted remote runner validation and result evidence (BR373S)
out_of_scope:
  - Same-machine parallel test capacity, owned by 2RZDMP
  - Providers other than GitHub Actions in v1
done_when:
  - Every child ticket has independently verified its customer-facing contract
created: 2026-08-07T16:44:39.255Z
last_modified: 2026-08-10T19:50:00Z
---

# Offload tests without blocking local work

**Goal:** Let every Safeword customer optionally run Safeword's done-oriented or full test-plan lane on remote GitHub-hosted runners, with safe local recovery when Safeword can establish that no remote run was created.

**Why:** Remote testing should relieve a contributor's machine without making the local path less safe, understandable, or available.

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.

**Related:** [2RZDMP — Let parallel sessions share test capacity safely](../2RZDMP-share-test-capacity-across-parallel-sessions/ticket.md)

## Work Log

- 2026-08-07T16:44:39.255Z Started: Created ticket BBNZ68
- 2026-08-07T16:45:12Z Framed: Recast the local lock improvement as an optional customer feature spanning the Safeword CLI and GitHub Actions execution sandbox; began BDD intake on `codex/customer-remote-tests`.
- 2026-08-07T16:53:42Z Amended: Made local fallback a customer guarantee while preserving remote test failures as authoritative failures rather than masking them with a rerun.
- 2026-08-07T16:56:29Z Researched: Chose a composite product model—Depot's local-to-remote loop, Bazel/BuildBuddy's fallback boundary, Nx Cloud's aggregated evidence, and GitHub CLI's native dispatch/watch primitives.
- 2026-08-07T17:10:32Z Confirmed: Approved the customer jobs and GitHub-native direction; captured configuration-backed opt-in, pre-execution local fallback, GitHub Actions as the first provider, and a separate job for safe local capacity sharing.
- 2026-08-07T17:32:20Z Reviewed: Split local capacity scheduling into ticket 2RZDMP; defined accepted and indeterminate dispatch boundaries, immutable revision and allowlisted lane integrity, least-privilege workflow execution, and customer-safe workflow reconciliation.
- 2026-08-07T18:06:43Z Quality-reviewed: Narrowed v1 to the real `test-plan` done/full lanes; specified trusted workflow identity, dispatch/result recovery, safe fallback boundaries, exact revision checks, and mandatory live GitHub evidence for the next phase.
- 2026-08-07T18:34:23Z Quality-approved: Fresh current-source review closed local evidence precedence, MAC lifecycle/correlation, and public CLI proof requirements; degraded separate-process Codex reviewer found no remaining spec contradiction after Claude was unavailable.
- 2026-08-07T18:53:19Z Phase: intake → define-behavior; saved systematic partitions for opt-in reconciliation, dispatch authority, recovery, workflow trust, and local evidence before scenario authoring.
- 2026-08-07T18:58:01Z Phase: define-behavior → scenario-gate; authored 31 scenarios across 16 rules with complete rejection, CLI/sandbox surface, dimension, and R/G/R-ledger coverage.
- 2026-08-08T03:42:01Z Scenario-quality approved: Expanded to 119 scenarios and a matching 119-entry ledger; closed dispatch authority, immutable target identity, workflow trust, concurrency, persistence, security, byte-boundary, fallback, and recovery gaps. Review independence remained degraded because Claude was unavailable; a separate headless Codex reviewer approved with no findings.
- 2026-08-08T06:56:24Z UX approved: Defined `test-execution set local|remote-preferred`, status reporting, and per-run `project test --lane done|full --execution local|remote-preferred`; expanded to 125 scenarios and a matching ledger covering overrides, strict grammar, exact process boundaries, and rollback-safe evidence. Degraded separate-process Codex review approved with no errors.
- 2026-08-09T20:58:04Z Personal preference designed: Added optional worktree-local `<namespace-root>/personal/config.json`, gitignored and absent by default, with precedence `--execution` → personal → project → built-in local and exact scope/origin reporting. Research selected mise's local-config ergonomics, Bazel's ignored in-tree convention, and Git's origin/scope transparency.
- 2026-08-09T20:58:04Z Scenario gate remains open: Expanded to 131 matching scenarios and ledger entries, fixed all concrete review findings encountered, and added literal-manifest completeness contracts for personal parsing and GitHub's HTTP 200 response. Claude timed out on every review attempt; degraded separate-process Codex continued surfacing broader pre-existing grouped-fixture/oracle concerns, so no fresh approval stamp was claimed.
- 2026-08-09T21:20:17Z Split: Promoted BBNZ68 to the epic container after the user approved decomposition. Its existing spec and feature scenarios remain the shared contract; child tickets own independently shippable implementation slices.
- 2026-08-09T21:20:59Z Planned children: S7TZF9 (contributor preference), X2Z8MN (workflow lifecycle), S2TF4J (dispatch and recovery), and BR373S (trusted runner). S7TZF9 is the first delivery slice.
- 2026-08-09T21:50:08Z Review-spec attempted: shortened coordinator exhausted both Claude and Codex routes. Required fresh-context supplemental review found the shared packet is design-only and cannot prove behavior until implementation and executable evidence exist; no independent approval was claimed.
- 2026-08-10T19:50:00Z CI follow-up: Marked the epic contract `@wip` while its remaining child slices lack executable steps. This keeps all 134 scenarios discoverable as source without introducing undefined scenarios into the acceptance lane; the exact Cucumber wiring test and Gherkin lint pass.

---
id: 6N6M40
slug: prevent-public-cli-contract-drift
type: feature
phase: verify
status: in_progress
external_issue: https://github.com/ArcadeAI/safeword/issues/2283
phase_anchors:
  - 'define-behavior: .project/tickets/6N6M40-prevent-public-cli-contract-drift/spec.md'
  - 'scenario-gate: features/prevent-public-cli-contract-drift.feature'
  - 'plan-implementation: .project/tickets/6N6M40-prevent-public-cli-contract-drift/impl-plan.md'
scope:
  - Assemble the production Commander tree through a side-effect-free createCliProgram factory and keep runCli as the only argv/runtime boundary.
  - Classify every public command, retained alias, argv compatibility rewrite, and internal route in one exhaustive catalog with exact syntax, visibility, options, and applicable policy metadata.
  - Reconcile the real assembled program, shipped help/capabilities subprocesses, generated artifacts, and canonical lifecycle documentation against that catalog with deliberate negative fixtures.
  - Add an unconditional five-minute CLI contract CI job, observe its exact context, and stage strict main-ruleset enforcement without leaving ordinary pull-request bypasses.
out_of_scope:
  - Deleting retained aliases or changing their supported behavior beyond rejecting options their handlers never consume.
  - Merge-queue support before the repository adopts a merge queue and an equivalent merge_group trigger exists.
  - A live ruleset-audit bot, which needs a separate decision about administrative credentials and alert routing.
  - Deterministic public command-reference generation beyond the minimum freshness proof required for the MVP gate.
done_when:
  - The assembled production program and exhaustive catalog reconcile every invocation, alias, visibility classification, and normalized option shape exactly.
  - Negative fixtures fail for unclassified routes, missing registrations, alias loss, visibility drift, and option ownership drift.
  - Every public command and argv rewrite crosses the shipped CLI subprocess boundary, while help, capabilities, generated plugin output, and canonical terminology drift fail together.
  - The CLI contract job is green under 90 seconds in normal operation, required on main with strict-current-main behavior, and ordinary pull-request bypasses are removed.
  - All #2251/#2278 behavior remains green and no retained alias is deleted.
created: 2026-08-09T06:29:37.342Z
last_modified: 2026-08-09T06:29:37.342Z
---

# Prevent public CLI contracts from drifting again

**Goal:** Make every shipped CLI invocation reconcile against one exhaustive production contract before merge.

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.

## Work Log

- 2026-08-09T06:29:37.342Z Started: Created ticket 6N6M40
- 2026-08-09T06:35:00.000Z Intake confirmed: GitHub issue #2283 preserves the independently reviewed design; the user's explicit proceed instruction confirms one Safeword Maintainer job, five rules, staged CI enforcement, and the stated MVP exclusions.
- 2026-08-09T06:35:00.000Z Advanced to define-behavior: Scope keeps every retained alias, makes the real assembled program the reconciliation authority, and treats the dedicated CI context plus live ruleset as the observable merge boundary.
- 2026-08-09T06:42:00.000Z Defined behavior: Seven dimensions produced five rules and fifteen scenarios covering exhaustive classification, real-program symmetry, alias option ownership, shipped subprocess and freshness proof, and strict CI enforcement. The approved GitHub issue supplied the scenario completeness confirmation; advanced to scenario-gate.
- 2026-08-09T06:50:00.000Z Scenario review requested changes: The degraded independent route found circular catalog oracles, incomplete side-effect and option boundaries, ambiguous compatibility regions, and nondeterministic live-enforcement wording. Reworked the dimensions and scenarios around independent expected inventories, explicit process snapshots, complete option-field partitions, deterministic surface mutations, exact region delimiters, and head-bound workflow/ruleset evidence.
- 2026-08-09T08:10:00.000Z Scenario gate completed under explicit degraded-review waiver: Claude Code 2.1.226 is installed but returns `Not logged in`, so cross-agent independence was unavailable. Twelve bounded Codex subprocess passes were applied, closing production/catalog authority semantics, positional and option normalization, alias parser boundaries, subprocess isolation, generated projections, workflow provenance/security, timing, and trusted ruleset rollout. No independent review stamp was written; the limitation remains auditable.
- 2026-08-09T08:10:00.000Z Advanced to plan-implementation: Behavior is fixed for implementation design; application code remains untouched.
- 2026-08-09T08:35:00.000Z Planned implementation: Six slices start with the real factory/runtime boundary, then exhaustive reconciliation, alias ownership, the focused gate, generated/docs surfaces, and staged CI/ruleset enforcement. Commander 15 and current GitHub ruleset documentation support the selected boundaries. No new ADR; the design extends the accepted typed-CLI decision.
- 2026-08-09T08:45:00.000Z Plan challenge applied: Added kind-specific realization for command nodes, aliases, rewrites, and the bare default; an independent literal #2251/#2278 baseline; an explicit post-factory registration/import boundary; and selective alias local-option ownership. Cross-agent review remained unavailable and unstamped because Claude is not logged in.
- 2026-08-09T08:45:00.000Z Splitting checkpoint: Kept one feature because the six components are sequential parts of one atomic contract and staged ruleset rollout; splitting would leave intermediate branches with duplicated or un-runnable required checks. Advanced to implement under the user's instruction to proceed.
- 2026-08-09T23:18:00.000Z Implementation complete: The production factory, exhaustive invocation contract, runtime reconciliation, alias ownership, built-subprocess sweep, generated documentation/plugin freshness, terminology scanner, import boundary, and dedicated CI job are wired. Focused gates, typecheck, lint, dependency validation, website build, audit, and the 1,362-scenario acceptance suite are green.
- 2026-08-09T23:18:00.000Z Quality and refactor pass complete: Degraded coordinator reviews found and closed bare/global-option retro routing, exact rewrite-target validation, two-way generated-tree freshness/remediation, topology changes, temporary cleanup, and symlink rejection. The final concurrent-repository-writer concern was rejected as outside the trusted-checkout threat model; a repository writer can already replace the executed generator. Extracted root-option matching as the only useful structure-only refactor and advanced to verify. Cross-agent independence remains unavailable because Claude is not authenticated.
- 2026-08-09T23:47:00.000Z Full verification green on the final tree: retro-relay 167 passed/1 skipped; CLI Vitest 475 files and 7,159 passed/5 skipped; Cucumber 1,359 passed/3 skipped (58,402 steps passed/4 skipped). Diff audit, typecheck, dependency-cruiser, generated-plugin freshness, Bun audit, and whitespace checks are clean. Publishing the branch and staged live ruleset enforcement remain.

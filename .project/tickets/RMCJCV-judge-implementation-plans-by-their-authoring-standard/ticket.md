---
id: RMCJCV
slug: judge-implementation-plans-by-their-authoring-standard
type: feature
phase: intake
status: in_progress
scope:
  - Define the plan-review judgment contract once in PLAN_IMPLEMENTATION.md and generate the runtime reviewer projection from it.
  - Treat impl-plan.md as reviewed work and the feature, ticket, project guidance, and decision records as review context.
  - Prove canonical/runtime/generated-host parity and fail-closed generation behavior.
out_of_scope:
  - Changing scenario-gate review, quality-review, reviewer routing, review stamping, or user approval policy.
  - Cryptographically binding review packets to later phase transitions.
done_when:
  - Plan authors and independent reviewers receive byte-identical plan-quality criteria from one canonical source.
  - Plan review packets distinguish the authored impl-plan.md from supporting context.
  - Generation and tests reject missing, duplicate, reversed, empty, stale, or host-only rubric content.
inspiration_contract: v1
inspiration_contract_scaffold: v1
created: 2026-08-28T15:01:46.107Z
last_modified: 2026-08-28T15:01:46.107Z
---

# Judge implementation plans by their authoring standard

**Goal:** Keep plan authoring and independent review aligned to one canonical judgment contract.

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.

## Work Log

- 2026-08-28T15:01:46.107Z Started: Created ticket RMCJCV
- 2026-08-28 Intake: Adopted GitHub issue #3454 and aligned scope to the canonical-rubric pattern proven by #3119.

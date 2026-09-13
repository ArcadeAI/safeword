---
id: A639WN
slug: complete-contributions-with-a-default-delivery-checklist
type: feature
phase: implement
status: in_progress
blocked_on: [82T411]
phase_anchors:
  - define-behavior: .project/tickets/A639WN-complete-contributions-with-a-default-delivery-checklist/spec.md
  - scenario-gate: features/complete-contributions-with-a-default-delivery-checklist.feature
scope:
  - expose one public deny-only CLI prerequisite that requires accepted scenarios, an accepted implementation approach, and one visible Safeword-default delivery checklist
  - carry the complete feature checklist in the Execution Plan while the TBU3 small-work contract owns proportionate task and patch behavior
  - cover outcome and scope, resolved decisions, dependency and PR decomposition, testing, data and compatibility, monitoring and failure signals, security and privacy, rollout and rollback, documentation, ownership and human dependencies, and concrete evidence
  - work through every applicable contributor obligation and distinguish contributor completion from pending human authority
  - preserve whether completion evidence proves the current revision, an earlier revision, only a partial or structural boundary, or nothing yet
out_of_scope:
  - discovering or interpreting repository-specific contribution policies
  - hardcoding Arcade-specific trackers, roles, approval meetings, review SLAs, WIP policy, or merge rules
  - creating a third planning document beside the Implementation Plan and Execution Plan
  - approving or merging a contribution on behalf of an authorized human
done_when:
  - the public CLI prerequisite denies execution readiness until accepted scenarios, an accepted implementation approach, and the admitted checklist exist
  - every checklist category is completed with evidence, marked not applicable with a concrete reason, or recorded as an explicit human-owned dependency
  - features carry the checklist in the Execution Plan without creating a third feature-planning artifact
  - Safeword never reports merge approval when it has established only contributor or review readiness
  - earlier-revision or partial evidence cannot silently become current complete proof
product_plan_contract: v1
parent: 82T411
parent_job: plan-implementability.TBU2
milestone: M1
depends_on: [6XW8H7]
created: 2026-09-09T15:39:34.084Z
last_modified: 2026-09-13T08:38:35.000Z
parent_contract_digest: c107ca39dc842a473be4ea5e12c6d448d12ccccd211da65b92ec3b689c03c8a3
---

# Complete contributions with a default delivery checklist

**Goal:** Give every Safeword contribution a proportionate checklist before execution and work through it until every applicable obligation is proven or explicitly handed off.

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.

## Work Log

- 2026-09-13T08:38:35.000Z Scenario gate: Independent Claude Opus review `870a2999-bca6-45a8-b923-897a6567dafe` approved all 16 scenarios with cross-agent provenance and no blocking findings. The revised R1 proves all three prerequisite states at the public CLI boundary; no build-only kill-risk remains.

- 2026-09-13T08:24:58.000Z Define behavior: Reconciled the execution-prerequisite dimension and three R1 scenarios to the public deny-only CLI boundary. The scenarios distinguish satisfied, missing-context, and deterministic multi-finding outcomes without granting coding or merge authority; downstream 7CAMAD retains live coding authorization.

- 2026-09-13T00:01:00.000Z Ownership correction: Reopened behavior definition after plan review found that A639WN's accepted R1 required installed first-execution authorization while its M1 scope only built a private helper. A639WN now owns a public deny-only CLI prerequisite; downstream 7CAMAD composes it into coding authorization, preserving the dependency direction and leaving installed agent-host delivery with YCFFNC.

- 2026-09-10T02:36:18.000Z Scenario gate approved: Independent Claude Opus review `3749d8f6-3659-419c-8a35-e62a462b8ee0` approved the 16-scenario Delivery Checklist contract with cross-agent independence. Advanced to Implementation Plan drafting; no plan anchor exists yet.

- 2026-09-09T23:10:11.000Z Parent reconciliation: `--accept` updated the current parent-contract digest to `6adb25eca1ec5ca8e510dca085cd14539ff08e37d2085f0190d7891c10c0c2a8` after the 23:04 Product Plan changes.

- 2026-09-09T23:04:09.000Z Dependency correction: This child now defines the canonical checklist evidence-currency taxonomy without referring back to 7CAMAD; 7CAMAD consumes it in the declared dependency direction. The scenario packet must be updated before fresh review.

- 2026-09-09T22:38:07.000Z Milestone correction: Kept non-CLI hosts affected but explicitly deferred installed checklist behavior and real-boundary proof to YCFFNC in M2, matching the M1 non-goal.

- 2026-09-09T22:28:06.000Z Ownership correction: Moved the feature Delivery Checklist contract to TBU2/M1, restored cloud surfaces, and left proportional task and patch adaptation with 3EG00H in TBU3/M3. This removes the former dependency cycle with the integrated Execution Plan child.

- 2026-09-09T22:19:12.000Z Review gate correction: Recorded the stale 82T411 Product Plan approval as an explicit blocker before another child approval or implementation transition.

- 2026-09-09T15:39:34.084Z Started: Created ticket A639WN

- 2026-09-09T15:44:00.000Z Intake: User chose an Arcade-inspired Safeword default rather than repository-policy discovery. The checklist is generated before execution, scaled across work types, completed with evidence, and separates contributor readiness from human approval and merge authority.

- 2026-09-09T15:56:00.000Z Intake correction: Moved from M1 to M3 because the default checklist depends on the M3 task-and-patch proportionality contract as well as the feature Execution Plan and PR-slicing contracts.

- 2026-09-09T15:57:00.000Z Intake accepted: The user approved the Arcade-inspired default, its repository-discovery boundary, its Rules, and local scope. The content-bound spec self-review passed and the child entered behavior definition.

- 2026-09-09T15:58:00.000Z Define behavior: Derived seven bounded dimensions and twelve representative scenarios covering checklist timing, default categories, honest dispositions, proportional artifacts, PR slicing, readiness authority, and local-host parity. Strengthened the patch boundary against a vacuous no-op and entered scenario review.

- 2026-09-09T16:18:00.000Z Scenario refinement: A real implementation-plan review showed that evidence can be valid but stale, partial, or structural. Added an explicit evidence-currency contract so the checklist cannot silently upgrade earlier-revision or partial proof into current complete proof.

## Root Cause

The readiness fixture made every contributor item `not_applicable`, including
testing. The later accepted contract requires at least one contributor-owned
real-boundary command proof for testing, so the fixture no longer described a
valid admitted plan. The validator was behaving correctly; the fixture now
records the retained testing proof before asserting each readiness state.

Ruled out: a readiness projection defect, because plan parsing rejected the
fixture before projection; an over-broad validator rule, because the approved
Implementation and Execution Plans explicitly require executable testing proof.

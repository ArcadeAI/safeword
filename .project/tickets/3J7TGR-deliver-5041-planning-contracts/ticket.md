---
id: 3J7TGR
slug: deliver-5041-planning-contracts
type: task
phase: verify
status: in_progress
external_issue: https://github.com/ArcadeAI/safeword/issues/5041
external_prs:
  - https://github.com/ArcadeAI/safeword/pull/5957
scope:
  - deliver canonical shared clauses, typed contracts and invalidation validation from remaining #5041
  - enforce full installed author-copy integrity including ordinary-terminal Cursor checks
  - route owned Product targets without changing context identity or approval semantics
  - preserve current main trust routing, main repairs, tests and all evidence
out_of_scope:
  - completing feature 5F5ZZA, epic 82T411 or remaining #5051 work
  - claiming live semantic qualification, native UI parity or private-injection proof
  - unrelated dependency upgrades or historical-failure erasure
done_when:
  - generation, invalidation refusal, author-copy restoration and Product routing pass discriminating tests
  - current main integration passes trusted resolver checks and independent review; required CI must pass before admin merge
  - wider feature status and every historical failure and accepted deferral remain visible
created: 2026-10-20T03:03:54.988Z
last_modified: 2026-10-20T03:03:54.988Z
---

# Deliver consistent planning contracts for Safeword maintainers

**Goal:** Deliver only the remaining canonical-clause, invalidation-validation, installed-copy integrity and Product-routing work from #5041.

**Why:** Ship and verify this bounded contribution while keeping feature 5F5ZZA and its unfinished acceptance and qualification work open.

## Work Log

- 2026-10-20T03:03:54.988Z Started: Created ticket 3J7TGR

## Delivery boundary and evidence

Related feature: **5F5ZZA**, deliberately still in progress. The user requested admin merge on 2026-10-19 UTC and approved this separate
delivery task on 2026-10-20 UTC, without
closing the broader feature or treating its unfinished scenarios as complete.

The implementation's original TDD, scenarios, audits and review records remain
in `../5F5ZZA-keep-plan-reviews-current-and-trustworthy/`. This is a delivery
partition, not a claim of newly performed historical RED steps.

Proof: `tests/integration/planning-contract-generation.test.ts`,
`tests/integration/installed-planning-copy-admission.test.ts`,
`tests/integration/native-planning-copy-dispatch.test.ts`, Product routing proof: `tests/cli-protocol/review-wiring.test.ts`; canonical
Product admission proof: `tests/review/planning-contract-reconciliation.test.ts`.
Trusted hook proof: `tests/integration/plan-transition-gate.test.ts` and
`tests/integration/coding-authorization-hook.test.ts`. Prior green source checkpoint:
90f4124c3, CI run 39327364010. This is historical until the current integration
and documentation pass CI. Main f48275b5e (#5856) introduces the shared trusted
CLI resolver; reconcile its overlap with the planning-copy gate before closure.

Historical qualification failures, the 0/159 broader ledger, deferred host
proof, and local audit/relay failures remain recorded. No unchanged paid
qualification runs. This task cannot claim parent completion.

Direct records: [broader verification](../5F5ZZA-keep-plan-reviews-current-and-trustworthy/verify.md),
[prior integration evidence](../5F5ZZA-keep-plan-reviews-current-and-trustworthy/evidence/5041-admin-merge/manifest.json).

Intake review 7fbaad23-21b3-41de-ba25-d04e276dc3f0: Claude/opus, cross-agent,
approved. Applied its date, named-proof and direct-link suggestions here; this
phase advance resolves its phase warning. Initial stamp lookup found no CLI;
the explicit installed runtime witnessed the receipt and stamped intake.

Delivery closure records completed local implementation and verification.
Current-head CI and the user-authorized admin merge remain separate external
PR gates; closing this task cannot bypass those gates or complete 5F5ZZA.

Integration TDD: the corrected shared-hook regression failed with the retained
legacy checker (project-owned runtime marker executed), then 86/86 tests passed
after adopting main's shared trusted resolver. The initial outer-Cursor probe
hit a separate adapter bootstrap boundary; it is retained as a limitation in
integration-review.md. All 12 regenerated lifecycle result digests match main
f48275b5e, including its Cursor install result change.

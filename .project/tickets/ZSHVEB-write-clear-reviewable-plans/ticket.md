---
id: ZSHVEB
slug: write-clear-reviewable-plans
type: feature
phase: intake
status: in_progress
scope:
  - add one shared technical-writing guide for Safeword workflows that author or review technical documents
  - add a plan-writing extension for Product, Implementation, and Execution Plans
  - make relevant authoring and review workflows load the shared guide and plan workflows load both guides
  - keep shared writing rules in one authoritative home with compact examples and sources for load-bearing claims
out_of_scope:
  - turning either guide into a standalone callable skill
  - copying project history, Arcade-specific process, or project-specific implementation details into reusable guidance
  - duplicating shared writing rules in the plan-specific extension
done_when:
  - the shared guide covers current truth, decision-first paragraphs, exact contracts, scannable structure, LLM writing and review, the deletion test, compact examples, and sources
  - the plan extension explains the distinct ownership, required content, review question, and approval meaning of Product, Implementation, and Execution Plans
  - relevant technical-document workflows load the shared guide and plan workflows additionally load the plan extension
  - the dependency remains one-way from the plan extension to the shared guide, with no reverse reference
  - installed and generated workflow copies preserve the authoritative guidance and existing Safeword checks pass
product_plan_contract: v1
parent: 82T411
parent_job: plan-implementability.TBU4
milestone: M1
created: 2026-09-10T18:43:58.353Z
last_modified: 2026-09-10T18:43:58.353Z
external_issue: https://github.com/ArcadeAI/safeword/issues/4366
parent_contract_digest: e022544f516847ee4a13685b5279e9dab6d78cc355e2c68bec9f42cdf44d61c5
---

# Make Safeword plans clear and reviewable

**Goal:** Give plan authors and reviewers shared writing guidance so decisions are current, clear, and placed in the right artifact.

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.

## Work Log

- 2026-09-10T18:43:58.353Z Started: Created ticket ZSHVEB
- 2026-09-10T18:43:58.353Z Epic linkage: Adopted GitHub issue #4366 as an M1 child of 82T411 under the cross-plan quality contract. The local child extends the issue's Product/Implementation wording to the epic's three distinct artifacts: Product, Implementation, and Execution Plans.

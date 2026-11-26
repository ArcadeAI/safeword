# Conformance-Gated Execution Plan Review

**Status:** Superseded by [Independent Review Never Blocks](independent-review-never-blocks.md)
**Date:** 2026-09-12

**Historical contract.** The shared review coordinator accepted `plan-execution` as a public review kind only for one ticket-owned `execution-plan.md`, with that ticket's Implementation Plan and approved scenarios as bounded context. It dispatched only reviewers with current, digest-bound conformance evidence.

The retained typed judgment recorded scenario-and-approach coverage, the complete ordered proof specifications and stable Delivery Checklist definition, reviewed `not_applicable` reasons and human dependencies, the current `designApprovalGate` value, the slicing decision, and a trusted normalized digest of the complete plan. The digest retained checklist `ID`, `Category`, `Obligation`, `Owner`, and `Required proof`. For contributor rows in `open` or `complete` state, it excluded only ordinary progress in `Disposition`, `Evidence class`, `Revision`, and the final evidence column; reviewed applicability reasons and human dependencies remained stable. Completing a reviewed obligation preserved the review. Changing a stable obligation field or any other plan definition invalidated it.

**Why.** Execution Plan approval must prove that accepted design obligations became independently safe, reviewable work; valid JSON or an unproven reviewer route is not evidence of that judgment.

**Historical cost.** A change to the contract, corpus, reviewer identity, or normalized plan definition withdrew admission until the complete live matrix or plan review passed again. Because progress-only edits preserved the review, normalization needed mutation tests for every excluded and retained field.

**Scope.** This is the narrow review-coordinator extension owned by [6XW8H7](../../.project/tickets/6XW8H7-split-large-contributions-into-reviewable-prs/ticket.md). The ticket remains authoritative for the detailed contract and proof; phase migration, review-currency invalidation, coding-transition enforcement, and recovery copy remain separately owned.

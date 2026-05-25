---
id: R09T59
slug: phase-4-findings-and-categories
title: "Adopt structured findings format and cross-cutting review categories for Phase 4 output"
type: feature
phase: intake
status: in_progress
epic: bdd-phase-one-merge
paired_with: JWM8PD
created: 2026-05-24T21:27:52.636Z
last_modified: 2026-05-24T21:30:00.000Z
---

# Adopt structured findings format and cross-cutting review categories for Phase 4 output

**Goal:** Replace safeword's prose findings output with arcade's structured format (h4 per finding, Current → explanation → Proposed, 3-tier severity, lead-with-tally, bulk template), and add cross-cutting review as a named-categories section (conflict, boundary, failure, security, persona consistency).

**Why:** Safeword's "issues reported or confirmed clean" is unstructured prose — hard to scan, hard to triage. Arcade's structured format is optimized for human review. Cross-cutting categories ensure the review doesn't miss issues that don't fit a single per-scenario check.

**Parent epic:** 0AWSY8
**Paired with:** JWM8PD in arcade
**Depends on:** —

## Scope

### Structured findings format

Define and document the Phase 4 output shape:

- **Lead with a tally:** `**Findings:** N must-fix, M should-strengthen, P looks-good.`
- **Three severity tiers:** Must Fix (correctness/structure), Should Strengthen (clarity/specificity), Looks Good (acknowledgement).
- **One h4 per finding:** `#### \`<scenario-id>\` — <short issue summary>`or`#### <topic> — <short issue summary>` for non-scenario findings.
- **Order: Current → explanation → Proposed.** Driver reads what exists, understands why it's wrong, then sees the fix. Putting the fix first turns the explanation into post-hoc justification.
- **Quote the full Given/When/Then block under "Current"**; highlight the offending phrase with bold or markers.
- **Show the rewritten Given/When/Then under "Proposed."**
- **Use bold labels** ("Current:", "Proposed:") consistently — not wandering inline prose.

### Bulk findings template

When the same pattern hits ≥3 scenarios, use the bulk shape:

- h4 header.
- **Affected:** list of scenario IDs.
- **Representative example:** full Current quote of one.
- **Proposed pattern:** the rewrite.

Prevents wall-of-repeated-quotes reports.

### Cross-cutting review categories

Add a Phase 4 sub-section "Cross-cutting checks" with five named categories:

- **Conflict** — do any scenarios contradict each other?
- **Boundary** — zero/one/max/empty/null/concurrent cases covered?
- **Failure** — external dependency failures (timeout, 5xx, malformed, partition) covered?
- **Security** — authn/authz failures and abuse vectors covered?
- **Persona consistency** — for each scenario, is the triggering persona clear?

Each category is a pass through the full scenario set looking for gaps, not a per-scenario check.

## Out of scope

- Auto-generating findings from scenario text — humans drive the review.
- The other Phase 4 checks (vacuous-pass, negative-case, assertion-strength, determinism) — they output INTO this format.

## Done when

- Phase 4 doc specifies the structured findings format with concrete example.
- Phase 4 doc specifies the bulk findings template with example.
- Phase 4 doc has a "Cross-cutting checks" subsection with the 5 named categories.
- Worked example in SCENARIOS.md shows a full Phase 4 report with tally, mixed-severity findings, at least one bulk finding, and at least one cross-cutting category finding.

## Open questions

- Looks-Good entries — should they be specific ("scenarios are outcome-oriented; no implementation leakage") or omitted entirely if the only purpose is to soften criticism? Driver leans specific-only (no padding allowed) — generic praise is noise.

## Work Log

- 2026-05-24T21:27:52.636Z Started: Created ticket R09T59
- 2026-05-24T21:30:00.000Z Drafted: Scope (findings format + bulk template + cross-cutting), open question on Looks-Good; linked to epic 0AWSY8

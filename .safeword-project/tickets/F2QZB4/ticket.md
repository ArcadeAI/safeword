---
id: F2QZB4
slug: review-spec-skill
title: 'Extract Phase 4 logic into standalone /review-spec skill, reinvokable after edits'
type: feature
phase: intake
status: in_progress
epic: bdd-phase-one-merge
paired_with: JWM8PD
blocked_on: [9FSPM8, XBY5QR, 73CKG4, R09T59]
created: 2026-05-24T21:27:52.722Z
last_modified: 2026-05-24T21:30:00.000Z
---

# Extract Phase 4 logic into standalone /review-spec skill

**Goal:** Extract the upgraded Phase 4 (scenario-gate) logic into a standalone `/review-spec` skill that is both auto-invoked by Phase 4 AND independently invokable for re-runs after scenario edits.

**Why:** Today Phase 4 lives only inside `bdd/SCENARIOS.md`. After scenario edits during Phase 6 (implementation reveals a gap, the user wants to re-review), there's no way to re-fire the review checks short of manually re-reading. Extraction lets users invoke `/review-spec` anytime to re-validate.

**Parent epic:** 0AWSY8
**Paired with:** JWM8PD in arcade
**Depends on:** 9FSPM8, XBY5QR, 73CKG4, R09T59 (all the Phase 4 check enhancements need to land first; the skill embodies their upgraded behavior)

## Scope

- New skill: `packages/cli/templates/skills/review-spec/SKILL.md`.
- Skill content: the full Phase 4 protocol — vacuous-pass, AODI, assertion-strength, determinism-risk, negative-case-coverage, cross-cutting categories, structured findings format.
- Skill invocation modes:
  1. **Auto-fire** from bdd at phase transition into `scenario-gate`.
  2. **Manual re-run** via `/review-spec` from any phase after `define-behavior`.
- Skill reads the active ticket's `test-definitions.md` and produces a structured findings report (per R09T59).
- bdd's SCENARIOS.md updates: Phase 4 section becomes a thin wrapper that invokes `/review-spec`; the actual procedure lives in the skill.

## Out of scope

- Hook-enforcement of `/review-spec` re-runs after edits — purely user-invoked for re-runs.
- Storing prior findings for diff — each invocation is independent.

## Done when

- `/review-spec` skill exists with full Phase 4 content.
- bdd SCENARIOS.md Phase 4 section references the skill (no duplication).
- Manual `/review-spec` invocation on a ticket with scenarios produces the structured findings report.
- Auto-fire path through bdd Phase 4 also lands the structured report (same code).
- Worked example shows both modes (auto from Phase 4, manual re-run after a Phase 6 edit).

## Open questions

- Skill name — `/review-spec` (arcade's vocabulary) or `/review-scenarios` (safeword vocabulary)? Driver leans `/review-spec` to keep arcade migration clean and signal "this is the absorbed arcade skill."
- Manual re-run after `done` phase — allowed (post-hoc spec audit) or blocked (ticket is closed)? Driver leans allowed; closed tickets are still readable.

## Work Log

- 2026-05-24T21:27:52.722Z Started: Created ticket F2QZB4
- 2026-05-24T21:30:00.000Z Drafted: Scope, dual-invocation modes, dependencies; linked to epic 0AWSY8

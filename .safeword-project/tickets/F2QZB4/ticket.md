---
id: F2QZB4
slug: review-spec-skill
title: 'Extract Phase 4 logic into standalone /review-spec skill, reinvokable after edits'
type: feature
phase: intake
status: in_progress
epic: bdd-phase-one-merge
paired_with: JWM8PD
blocked_on: [73CKG4, R09T59]
created: 2026-05-24T21:27:52.722Z
last_modified: 2026-05-24T21:30:00.000Z
---

# Extract Phase 4 logic into standalone /review-spec skill

**Goal:** Extract the upgraded Phase 4 (scenario-gate) logic into a standalone `/review-spec` skill that is both auto-invoked by Phase 4 AND independently invokable for re-runs after scenario edits.

**Why:** Today Phase 4 lives only inside `bdd/SCENARIOS.md`. After scenario edits during Phase 6 (implementation reveals a gap, the user wants to re-review), there's no way to re-fire the review checks short of manually re-reading. Extraction lets users invoke `/review-spec` anytime to re-validate.

**Parent epic:** 0AWSY8
**Paired with:** JWM8PD in arcade
**Depends on:** 73CKG4, R09T59 (9FSPM8 + XBY5QR already shipped; the skill embodies the upgraded scenario-gate behavior)

## Scope

- New skill: `packages/cli/templates/skills/review-spec/SKILL.md`.
- Skill content: the full scenario-gate protocol — vacuous-pass, AODI, determinism-risk, negative-case-coverage, cross-cutting categories, structured findings format (assertion-strength is covered by `testing` Iron Law 2, not a standalone check — see 73CKG4 re-scope).
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

## Replan — 2026-06-06

Validated: a separate skill is right (matches safeword's self-review / tdd-review / verify / audit pattern; "re-invokable after edits" is real value). **Two guardrails:** (1) the skill must **reference** scenario-gate's AODI + adversarial pass, not restate them (~60% of the content already exists) — keep the body lean; (2) **disambiguate its `description`** from the existing `self-review` skill (which reviews `spec.md` at the JTBD/AC/persona layer) to avoid trigger contention — `/review-spec` = scenario adversarial review, `self-review` = inline spec-framing self-pass. Name `/review-spec` (open question resolved). Now blocked only on 73CKG4 + R09T59 (9FSPM8 + XBY5QR shipped). Build deferred.

## Re-scope — 2026-06-06 (post-quality-review)

Narrowed `blocked_on` to `[73CKG4, R09T59]` (9FSPM8 + XBY5QR are done) and dropped standalone assertion-strength from the skill's content list (folded into `testing` Iron Law 2 per the 73CKG4 re-scope). Keeps F2QZB4 consistent with the 0AWSY8 epic table.

## Work Log

- 2026-05-24T21:27:52.722Z Started: Created ticket F2QZB4
- 2026-05-24T21:30:00.000Z Drafted: Scope, dual-invocation modes, dependencies; linked to epic 0AWSY8
- 2026-06-06T17:40:00.000Z Replan: confirmed separate-skill; added reference-not-restate + description-disambiguation-vs-self-review guardrails; name resolved → /review-spec. Still blocked on the 4 Phase-4 children. Build deferred.
- 2026-06-06T23:25:00.000Z Re-scope (post-quality-review): narrowed blocked_on to [73CKG4, R09T59] (9FSPM8 + XBY5QR done); dropped assertion-strength from the skill content list (folded into testing Iron Law 2). Now consistent with the 0AWSY8 epic table.

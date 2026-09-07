---
id: KHL52X
slug: phase-boundary-quality-gates
type: feature
phase: intake
status: in_progress
epic: phase-step-enforcement
relates_to: '172'
created: 2026-09-05T23:20:00.000Z
last_modified: 2026-09-06T14:20:00.000Z
scope:
  - 'Retire the Stop-time quality review: off unless `.safeword/config.json` sets `stopQualityReview: true`, on both the Claude and Cursor stop hooks. The Stop hook keeps every gate that checks evidence.'
  - 'Move the substantive quality checks onto phase entry/exit, enforced as PreToolUse denials on the `phase:` edit in ticket.md — the channel the existing provenance, readiness, and plan gates already use.'
  - 'Fill the empty boundaries: define-behavior -> scenario-gate, scenario-gate -> plan-implementation, and implement -> verify currently have no entry or exit criteria at all.'
  - 'Extend the feature-only boundaries to tasks at a proportionate depth, so a task ticket is not a gate-free lane.'
  - 'Decide the posture of the already-built but default-off phase-exit review gate (`reviewGate`), including which exits can actually earn a verified stamp.'
out_of_scope:
  - 'Removing the done gate from Stop before its checks run at the verify -> done boundary — the backstop moves, it does not disappear.'
  - 'Enforcing anything on ticketless sessions via phases (they have no phases; that gap needs its own answer and may stay a Stop-hook concern).'
  - 'New review content or new criteria for what "good" means per phase — this ticket moves and completes enforcement of criteria SAFEWORD.md already states.'
done_when:
  - 'The Stop-time review is off by default on both stop hooks, restorable with one config key, with the Stop hook''s evidence gates provably untouched.'
  - 'Every phase boundary has a declared entry and exit contract, and each contract is either enforced at the boundary or has a recorded reason it is advisory.'
  - 'A feature and a task ticket each fail to advance across a boundary whose criteria are unmet, with the denial naming the missing artifact.'
  - 'stop-quality.ts no longer carries the phase-review filter stack; its remaining responsibilities are stated in one paragraph at the top of the file.'
---

# Catch quality problems when work moves phases, not when the session goes quiet

**Goal:** Attach the quality checks to the workflow's own boundaries. A phase
transition is a `phase:` edit in `ticket.md`, which is a PreToolUse event — hard
blockable, before the fact, at a moment that actually corresponds to the work.
The Stop hook fires on a moment with no relationship to the work, which is why
it needs six filters to guess whether the moment matters, and why every filter is
a leak.

## Why now — the Stop hook is not catching anything

Measured across the 13 sessions running on 2026-09-05 (parsed from
`~/.claude/projects/*/*.jsonl`, corroborated by the 11 `quality-state-*.json`
files):

| Signal                                          | Count                         |
| ----------------------------------------------- | ----------------------------- |
| Turn-ends where the Stop hook could have fired  | ~220                          |
| Turns that touched a file at all                | 24                            |
| Quality-review blocks delivered                 | 1 (a decision-brief reformat) |
| Code changes traced to a Stop-hook review        | 0                             |
| Recorded gate failures across all 11 state files | 0                            |
| Stop-hook runs that crashed or refused to start  | 11                           |

It errored out more often than it found anything. The causes are structural, not
bugs: the edit-tools early exit at `stop-quality.ts:407` drops ~89% of turns; 8
of 11 sessions have no active ticket so there is no phase to review; phase
reviews dedupe to once per phase and lose the race to PostToolUse; implement-step
reviews are hardcoded silent (`fireReview = false`); and the one surviving
terminal check is `evaluateDecisionBriefCompliance` — the shape of the reply, not
the quality of the work.

## What already exists (do not rebuild)

The boundary architecture is largely built. `pre-tool-quality.ts` already denies
on `ticket.md` edits: phase provenance, `blocked_on`, parent product-plan
reconciliation, intake -> define-behavior readiness (features only),
plan-implementation -> implement (features only), and a generic phase-exit review
stamp gate that is **default off**. Plus the non-boundary gates: LOC (~400), the
R/G/R SHA-or-skip ledger annotation, and REFACTOR-commits-touch-no-tests.

So the remaining work is mostly completion and relocation, not green-field.

## The gap, boundary by boundary

| Boundary                             | Enforced today                                       | Missing                                                                                                                                              |
| ------------------------------------ | ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| intake -> define-behavior            | Full readiness check, **features only**              | Task equivalent; no check that the Clarify steps happened                                                                                            |
| define-behavior -> scenario-gate     | **Nothing**                                          | Every Rule covered by >=1 scenario (`safeword doctor` reports, blocks nothing); lineage IDs well-formed; happy/failure/edge present                  |
| scenario-gate -> plan-implementation | **Nothing**                                          | An independent `review-spec` result recorded, issues resolved or explicitly "No issues" — the phase's whole purpose rests on the model choosing to    |
| plan-implementation -> implement     | Plan exists, parses, status `planned`. Features only | Riskiest assumption named with its proving scenario; Decisions citations checked at the boundary rather than at Stop; task equivalent                 |
| implement -> verify                  | **Nothing**                                          | Ledger complete; `impl-plan.md` reconciled to `implemented` (SAFEWORD.md requires it; nothing enforces it here); clean typecheck                     |
| verify -> done                       | `verify.md` exists; Stop hook checks tests + audit   | The done gate should run at the transition, where no path reaches `done` around it — its `status: done` sidestep already needs special-case code      |
| Any boundary, tasks                  | Provenance and `blocked_on` only                     | Everything above is `type === 'feature'` gated. Tasks are the common case and traverse phases untouched                                              |
| No ticket at all                     | Nothing                                              | 8 of 11 sessions. No phases means no boundaries — the largest hole, and phases cannot close it                                                        |

## Open questions

- **Which exits can actually earn a stamp?** `review run` accepts three kinds
  (`quality-review`, `scenario-gate`, `plan-implementation`), and a stamp
  claiming a coordinator verdict is verified with `receipt.kind === claim.phase`.
  So only `scenario-gate` and `plan-implementation` can produce a verified
  independent stamp; the other five exits can only take an uncited stamp or a
  logged skip. Turning the gate on everywhere therefore promises more than five
  of its exits can enforce. Either narrow the default to the two that work, or
  give the other five real rubrics.
- **Tension with epic 170 (propulsive by default).** Artifact-based enforcement
  is the resolution: block on a missing artifact, never on a missing pause. If a
  gate needs the agent to _stop and think_, it does not belong at a boundary.
- **How deep for tasks?** A task with no `spec.md` cannot be held to a
  Rules-coverage check.
- **Ticketless sessions.** Push people toward tickets, or keep a thin Stop-hook
  backstop for "you edited files and crossed nothing"? A system covering 3 of 11
  sessions is not a quality system.

## Work Log

- 2026-09-05 Created from the effectiveness measurement above. Child of epic 172
  (phase step enforcement), which called for exactly this audit before fanning
  out children.
- 2026-09-06 First slice: retire the Stop-time review behind `stopQualityReview`,
  leaving every Stop-hook evidence gate in place. The boundary work stays open.

---
id: KHL52X
slug: phase-boundary-quality-gates
type: feature
phase: intake
status: in_progress
epic: phase-step-enforcement
relates_to: '172'
created: 2026-09-05T23:20:00.000Z
last_modified: 2026-09-05T23:20:00.000Z
scope:
  - 'Move the substantive quality checks out of the Stop hook and onto phase entry/exit, enforced as PreToolUse denials on the `phase:` edit in ticket.md (the same channel the existing provenance, readiness, and plan gates already use).'
  - 'Fill the empty boundaries: define-behavior -> scenario-gate, scenario-gate -> plan-implementation, and implement -> verify currently have no entry or exit criteria at all.'
  - 'Extend the feature-only boundaries to tasks at a proportionate depth, so a task ticket is not a gate-free lane.'
  - 'Decide the posture of the already-built but default-off phase-exit review gate (`reviewGate` in .safeword/config.json).'
  - 'Reduce stop-quality.ts to what only a Stop event can see: uncommitted edits in a session that never crossed a boundary, and ticketless sessions.'
out_of_scope:
  - 'Removing the done gate from Stop before its checks run at the verify -> done boundary — the backstop moves, it does not disappear.'
  - 'Enforcing anything on ticketless sessions via phases (they have no phases; that gap needs its own answer and may stay a Stop-hook concern).'
  - 'New review content or new criteria for what "good" means per phase — this ticket moves and completes enforcement of criteria SAFEWORD.md already states.'
  - 'Cursor/Codex parity work beyond keeping the shared contract honest (Cursor cannot block at Stop, which is an argument for this change, not a task inside it).'
done_when:
  - 'Every phase boundary has a declared entry and exit contract, and each contract is either enforced at the boundary or has a recorded reason it is advisory.'
  - 'A feature and a task ticket each fail to advance across a boundary whose criteria are unmet, with the denial naming the missing artifact.'
  - 'stop-quality.ts no longer carries the phase-review filter stack; its remaining responsibilities are stated in one paragraph at the top of the file.'
  - 'A re-run of the effectiveness scan shows boundary denials firing where Stop-hook reviews previously did not.'
---

# Catch quality problems when work moves phases, not when the session goes quiet

**Goal:** Attach the quality checks to the workflow's own boundaries. A phase
transition is a `phase:` edit in `ticket.md`, which is a PreToolUse event — hard
blockable, before the fact, at a moment that actually corresponds to the work.
The Stop hook fires on a moment with no relationship to the work, which is why it
needs six filters to guess whether the moment matters, and why every filter is a
leak.

## Why now — the Stop hook is not catching anything

Measured across the 13 sessions running on 2026-09-05 (parsed from
`~/.claude/projects/*/*.jsonl`, corroborated by the 11 `quality-state-*.json`
files):

| Signal                                             | Count                          |
| -------------------------------------------------- | ------------------------------ |
| Turn-ends where the Stop hook could have fired      | ~220                           |
| Turns that touched a file at all                    | 24                             |
| Quality-review blocks delivered                     | 1 (a decision-brief reformat)  |
| Code changes traced to a Stop-hook review           | 0                              |
| Recorded gate failures across all 11 state files    | 0                              |
| Stop-hook runs that crashed or refused to start     | 11                             |

It errored out more often than it found anything. The causes are structural, not
bugs: the edit-tools early exit at `stop-quality.ts:407` drops ~89% of turns; 8
of 11 sessions have no active ticket so there is no phase to review; phase
reviews dedupe to once per phase and lose the race to PostToolUse; implement-step
reviews are hardcoded silent (`fireReview = false`, `stop-quality.ts:900`); and
the one surviving terminal check is `evaluateDecisionBriefCompliance` — the shape
of the reply, not the quality of the work.

## What already exists (do not rebuild)

The boundary architecture is largely built. `pre-tool-quality.ts` already denies
on `ticket.md` edits:

- **Phase provenance** — a feature's phase is earned one step at a time; skips need `phase_skips` reasons. Always on.
- **blocked_on** — cannot leave intake with an unresolved same-repo blocker. Always on.
- **Parent product-plan reconciliation** — a contracted child cannot shed its lineage or advance against a changed parent.
- **intake -> define-behavior readiness** — frontmatter `scope`/`out_of_scope`/`done_when`, `spec.md` present, JTBD gate, Rules gate, Product Inspiration. Features only.
- **plan-implementation -> implement** — valid `impl-plan.md` at status `planned`, plus a code freeze during planning. Features only.
- **Phase-exit review stamp (Tier 2)** — a generic "no independent review of the phase you are leaving, no advance" gate. **Default off**; this repo's `config.json` sets no `reviewGate`, so it is inert.
- Plus the non-boundary gates: LOC (~400), the R/G/R SHA-or-skip ledger annotation, and REFACTOR-commits-touch-no-tests.

So this ticket is mostly completion and relocation, not green-field.

## The gap, boundary by boundary

| Boundary                       | Enforced today                                                                       | Missing                                                                                                                                                                                                                                              |
| ------------------------------ | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| (entry) intake                 | Nothing — a ticket is born here                                                       | Nothing needed; birth legality is already checked at rest                                                                                                                                                                                              |
| intake -> define-behavior      | Full readiness check, **features only**                                                | Task equivalent (today a task walks straight through); no check that the Clarify steps happened — readiness triage across the five dimensions, principles read, `/figure-it-out` run when the design had real options                                   |
| define-behavior -> scenario-gate | **Nothing**                                                                          | Every Rule covered by >=1 scenario (`safeword doctor` reports this but blocks nothing); scenario lineage IDs well-formed; happy/failure/edge all present; no scenario asserting an outcome `out_of_scope` excludes                                      |
| scenario-gate -> plan-implementation | **Nothing**                                                                      | An independent `review-spec` result recorded for this ticket, with issues either resolved or explicitly "No issues" — the phase's entire purpose currently rests on the model choosing to do it                                                        |
| plan-implementation -> implement | Plan exists, parses, status `planned`. Features only                                 | Riskiest assumption named with the scenario that proves it; Decisions section carries citations (checked at Stop today, not at the boundary); Design alignment records principle -> consequence -> proof; task equivalent                              |
| implement -> verify            | **Nothing**                                                                            | Ledger complete — every scenario annotated RED/GREEN/REFACTOR or carrying a skip reason; `impl-plan.md` reconciled to `implemented` (SAFEWORD.md states this is required; nothing enforces it at this edge); clean typecheck (advisory-only at Stop today) |
| verify -> done                 | `verify.md` exists; Stop hook then checks tests, Gherkin acceptance, scenarios, audit  | The Stop-hook done gate is the one place with real teeth — it should run here, at the transition, where no path can reach `done` around it. Its `status: done` sidestep already needs special-case code (`active-ticket.ts:471`), which is evidence the check is attached to the wrong event |
| Any boundary, tasks            | Provenance and blocked_on only                                                         | Everything above is `type === 'feature'` gated. Tasks are the common case and traverse phases untouched                                                                                                                                                |
| No ticket at all               | Nothing                                                                                | 8 of 11 sessions today. No phases means no boundaries means no gates — the largest hole, and phases cannot close it                                                                                                                                    |

## Open questions

- **Tension with epic 170 (propulsive by default).** Epic 172 already flagged
  this. Artifact-based enforcement is the resolution: block on a missing
  artifact, never on a missing pause. Every gate proposed here should be
  expressible as "this file exists and looks like this" — if a gate needs the
  agent to _stop and think_, it does not belong at a boundary.
- **~~Turn on `reviewGate`?~~ Resolved — both reasons it was off have expired.**
  It was off for two stated reasons. (1) A **rollout guard**: commit `7baefa827`
  shipped the gate inert so a self-applying blocking gate could not brick the
  dogfood repo or customers, to be "enabled deliberately once the stamp-earning
  step lands." That step landed today — `971128aa7` (#3769) makes a stamp cite
  the review that produced it, so a stamp now proves a review ran. (2) The
  **flow review of 2026-06-10** (commit `51bec7593`, option (a)) kept it off
  interactively because the scenario-gate exit "already is the gate,
  structurally" and other exits "carry their own guards: user sub-phase gates,
  tests, the done-gate."
  Both halves of (2) have decayed. The scenario-gate exit is **not** structurally
  gated — verified above, that boundary enforces nothing; the claim described a
  branch where reviews happened to be run, not a mechanism. And the user guard
  assumed one attended session; today there were 13 running in parallel with 8 of
  11 ticketless. That is the condition ticket 2VCSZY reserved for autonomous
  runs — "when the human guard disappears" — arriving through parallelism rather
  than a mode flag. The open question is no longer *why is it off* but *what does
  it cost*: 2VCSZY estimates ~50-100k tokens per phase exit, which is the real
  reason to enable it selectively (high-judgment exits) rather than everywhere.
- **How deep for tasks?** Proportionate depth, but where? A task with no
  `spec.md` cannot be held to a Rules-coverage check.
- **Ticketless sessions.** Push people toward tickets, or keep a thin Stop-hook
  backstop for "you edited files and crossed nothing"? A system that covers 3 of
  11 sessions is not a quality system.
- **What survives in `stop-quality.ts`?** Proposal: the uncommitted-edit backstop
  and the ticketless-session nudge only; everything else moves to the boundary.

## Work Log

- 2026-09-05 Created from the effectiveness measurement above. Child of epic 172
  (phase step enforcement), which called for exactly this audit before fanning
  out children.
- 2026-09-05 Built and enabled selective enforcement (2VCSZY's "option c").
  `reviewGate` now also accepts a phase list; `reviewGateAppliesToPhase` decides
  per exit, and the Tier 2 call site detects the phase before consulting the
  flag. Tier 1 (per-asset) stays all-or-nothing — it has no phase to select on.
  This worktree's `config.json` sets `["define-behavior", "scenario-gate"]`.
  Probed against real tickets: exiting scenario-gate (Y4ZAAY) and
  define-behavior (G2E72G) both deny for a missing review stamp; implement ->
  verify (0XZAYA) passes silently. Templates, `.safeword/hooks`, and the Codex
  plugin copies are byte-identical; `bun run generate:codex-plugin` could not
  run here (script pins Bun 1.3.14, local is 1.4.0) so the two hook files were
  copied directly — the generated CLI bundle and rubrics are untouched.
- 2026-09-05 **Priced it.** One real scenario-gate review of Y4ZAAY's 18-scenario
  feature: **32 seconds**, route `codex`, independence `cross-agent` (primary
  route, no degradation), verdict `changes_requested` with three Must-Fix
  findings on a scenario set that had already survived several review rounds.
  The job record carries no dollar figure because this route runs the local
  `codex` CLI against its own plan, not a metered API key — so the per-exit cost
  is reviewer-plan quota plus ~30s of wall clock, not billed dollars. The $1.153
  figure recorded in ticket Y4ZAAY is a different path (metered OpenAI Responses
  API), and 2VCSZY's 50-100k token estimate describes the reviewer's context
  window, wherever that lands. Cost is therefore a much weaker argument against
  enabling this than the June estimate implied.
- 2026-09-05 Traced why `reviewGate` is off (commits `7baefa827`, `51bec7593`,
  ticket 2VCSZY). Both reasons expired; recorded under Open questions. Related:
  2VCSZY (autonomous flip, backlog, conceptually blocked on YOLO mode G2E72G) —
  parallel sessions may be the trigger it was waiting for, without the mode.
- 2026-09-05 First `bash` heredoc write of this file was denied by the
  inspiration-activation gate, which demanded the Write tool so content could be
  validated. A boundary gate blocking the creation of the boundary-gate ticket is
  the argument in miniature: that check fired at the moment of the change, not at
  the end of a session.

# Spec: Whole-ticket quality review + refactor before verify

## Intent

Safeword already has a "cross-scenario refactor" step, but it's split and
under-powered: the checkbox is seeded at implement-exit (`bdd/TDD.md`), the
actual work is described one phase later in `bdd/VERIFY.md`, there's **no
quality-review pass** in front of it, and the whole thing is fenced to
features by an `isFeature` guard in `stop-quality.ts`. Multi-loop **task**
work (TDD with several RED→GREEN→REFACTOR cycles) gets no whole-ticket
cleanup at all.

This feature makes the end of implementation do one deliberate pass over the
_whole ticket_: run `/quality-review` across the full diff, then `/refactor`
the findings — for both BDD features and multi-loop TDD tasks — firing only
when there's more than one RGR loop, and auto-skipping when there's just one
(nothing to cross).

## References

- Design decided via `/figure-it-out` (2026-06-20): gate on the loop count
  already parsed from `test-definitions.md` (`scenarios.length`), drop the
  `isFeature` guard, reuse the skill-invocation log for review proof and the
  existing checkbox row for refactor proof. Rejected: counting GREEN commits
  (fragile, redundant) and synthesizing a `test-definitions.md` for tasks
  that lack one (auto-skip handles them).
- Load-bearing source: `stop-quality.ts:539` (isFeature fence),
  `ledger-validation.ts:182-196` (parsed scenarios + cross-scenario rule),
  `active-ticket.ts:202-208` (tasks already use `test-definitions.md`),
  `record-skill-invocation.ts` (the /verify + /audit proof mechanism).

## Personas

- **Technical Builder (TB)** — the pass fires in their agent sessions
  on real projects; they get whole-ticket cleanup before done.
- **Safeword Maintainer (SM)** — owns the gate; wants one derived trigger,
  not a new artifact or a parallel signal.

## Vocabulary

- **RGR loop** — one RED→GREEN→REFACTOR cycle, recorded as one `## Scenario:`
  block with its three checkboxes in `test-definitions.md`. A feature's
  scenarios and a task's TDD cycles are both RGR loops in this sense.
- **Whole-ticket pass** — the end-of-implement `/quality-review` → `/refactor`
  sequence operating over the ticket's full diff, not a single loop.

## Jobs To Be Done

### whole-ticket-quality-refactor.TB1 — Clean up cross-loop debt before verify

**Persona:** Technical Builder (TB)

> When I finish implementing a ticket that went through several RED-GREEN-REFACTOR
> loops, I want one whole-ticket quality review and refactor pass before verify,
> so duplication, drift, and inconsistent naming spread across the loops gets
> cleaned up instead of riding silently to done.

#### whole-ticket-quality-refactor.TB1.AC1 — A whole-ticket quality review runs at implement-exit and feeds the refactor

#### whole-ticket-quality-refactor.TB1.AC2 — The refactor outcome is recorded and enforced before done (a SHA or an auditable skip)

#### whole-ticket-quality-refactor.TB1.AC3 — The pass covers both feature (BDD scenarios) and task (TDD loops) work

### whole-ticket-quality-refactor.TB2 — No ceremony when there's nothing to cross

**Persona:** Technical Builder (TB)

> When my ticket had only a single RGR loop, I want the whole-ticket pass to be
> skipped automatically, so I'm not forced through a quality-review-and-refactor
> ritual for a change that has nothing to cross.

#### whole-ticket-quality-refactor.TB2.AC1 — A single-loop ticket requires no whole-ticket pass; the gate stays silent

### whole-ticket-quality-refactor.SM1 — One derived trigger, one path for both work types

**Persona:** Safeword Maintainer (SM)

> When I maintain this gate, I want the trigger derived from the loop count
> already in the ledger and the two work types sharing one validation path, so
> there's no new file format, no commit-message parsing, and no second code path
> to keep in sync.

#### whole-ticket-quality-refactor.SM1.AC1 — The trigger is computed from the existing parsed loop count (no new artifact, no commit parsing)

#### whole-ticket-quality-refactor.SM1.AC2 — Task and feature reach the same validation; the `isFeature` fence no longer excludes tasks

## Outcomes

- A ≥2-loop task or feature is blocked at the done gate until the cross-scenario
  refactor row carries a SHA or `skip:<reason>` AND `/quality-review` was
  invoked this session (logged).
- A 1-loop ticket requires neither — the gate is silent and done proceeds.
- The end-of-implement instructions (`bdd/TDD.md`) own the sequence:
  `/quality-review` whole diff → `/refactor` the findings → record the row.
- All three skill mirrors and both hook copies stay in sync.

## Open Questions

(none — design converged via /figure-it-out before intake)

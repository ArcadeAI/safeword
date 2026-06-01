# Spec: Close the status/phase done-gate sidestep

## Intent

Safeword's done-gate (run tests, require `verify.md`, require `/verify`+`/audit`)
only fires when a ticket reaches `phase: done`. Setting `status: done` directly
leaves `phase` untouched, and because the hook only tracks `in_progress`
tickets, the closed ticket drops out of context — the gate never runs. This
session used that sidestep to close epics DZ2NM5/P8RJ4M with hand-written
`verify.md` and no test/skill enforcement. Make "done" mean verified by turning
the status-close into a natural gate.

## References

- `/figure-it-out` decision (work log, 2026-06-01): option A — enforce via a scoped natural gate, not steering, not strict-enforce-everything.
- Learnings `natural-vs-self-report-gates` (prefer physics gates; phase advancement is self-report, ~40% unreliable) and `procedural-gates-generalize-beyond-tdd` (hard SAFETY gates work; verbose procedural checklists raise regressions 6%→10%).
- `stop-quality.ts:351` done-gate; `:87` / `lib/active-ticket.ts:179` the in_progress-only filters the sidestep exploits.
- M7AZY3 parent epic; adjacent enforcement epic 172-phase-step-enforcement.

## Personas

- **Safeword Maintainer (SM)** — dogfoods safeword; needs the self-enforcement to be un-bypassable so "done" tickets are actually verified.
- (Generalizes to **DEV** — the gate ships to every safeword user.)

## Jobs To Be Done

### bdd-tdd-adherence.SM1 — A "done" ticket is a verified ticket

**Persona:** Safeword Maintainer (SM)

> When I (or my agent) close a ticket by marking it done, I want the system to
> refuse the close if the done evidence was skipped, so "done" can't silently
> mean "claimed done" — regardless of whether I reach done via `phase` or
> `status`.

#### bdd-tdd-adherence.SM1.AC1 — A build ticket (task/feature with scenarios) closed by `status: done` still triggers the done-gate

#### bdd-tdd-adherence.SM1.AC2 — An epic closed by `status: done` is gated proportionately — `verify.md` + passing tests required, no scenarios/skills demanded

#### bdd-tdd-adherence.SM1.AC3 — Legitimate states are untouched — in_progress tickets keep their real phase, an already-done ticket is not re-gated, and non-build closes (patches, typeless, scenario-less) keep the escape hatch

## Vocabulary

Uses existing glossary: Gate (the done gate specifically), Phase, Ticket. No new terms.

## Outcomes

- Setting `status: done` on a task/feature that has a `test-definitions.md`, while `phase` ≠ done, makes the next Stop run the full done-gate (block until tests pass + `verify.md` + `/verify`+`/audit`).
- Setting `status: done` on an epic makes the next Stop require `verify.md` + passing tests (no scenario/skill block).
- An `in_progress` ticket's phase context is unchanged; a ticket already at `status: done, phase: done` is not re-gated (no loop); a patch / typeless / scenario-less close is exempt.
- Pure decision function `resolveStopPhase` is unit-tested; one integration test proves the full hook blocks a status-close of a feature missing `verify.md`.

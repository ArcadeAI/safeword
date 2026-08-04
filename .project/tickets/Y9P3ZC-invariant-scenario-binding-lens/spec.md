# Spec: Bind spec invariants to falsifying scenarios

## Intent

A spec can assert "the hook must never X" and ship with nothing that would fail
if the hook did X. QRX2DN did exactly that: its `spec.md` SWM1.R1 said an
unbound Codex session "must never become a lifecycle-mutation fallback," the
ledger carried rows named `never_uses_a_fallback_for`, and every one of those
rows bound a session id — so the no-identity case the invariant actually
forbade went untested and a live defect shipped (issue #1425). The gap is
structural, not a lapse of attention: `self-review` reads `spec.md`,
`review-spec` reads the scenarios, and nothing compares the two.

## Intake Brief

- **Requested by:** Review of PR #1404 — the class-fix decision behind issue #1425.
- **Cost of inaction:** Any invariant stated in absolute terms can ship unenforced while appearing covered, because a scenario named after the rule reads as proof of it. The done-gate keeps advertising a guarantee the code doesn't make.
- **Reversibility:** Two-way door — delete the lens bullet, regenerate mirrors. No data, format, or public API change.

## References

- Issue #1425 — the instance defect this generalizes.
- `.project/tickets/QRX2DN-codex-done-gate-auto-transition/spec.md` — SWM1.R1, the unbound invariant.
- `packages/cli/templates/skills/review-spec/SKILL.md` — cross-cutting checks; the **Surface coverage** lens is the precedent for review-spec reading `spec.md`.
- `packages/cli/tests/hooks/feature-source-documentation.test.ts` — the mirror-drift test pattern this follows.

## Personas

- Safeword Maintainer (SWM)
- Technical Builder (TBU)

## Surfaces

Affected:

- Claude Code — `.claude/skills/review-spec/SKILL.md`
- OpenAI Codex — `packages/cli/codex-plugin/skills/review-spec/SKILL.md`
- Cursor — `.agents/skills/review-spec/SKILL.md`

skip: the lens is identical prose on every surface; the generated mirrors carry
no surface-specific behavior, so per-surface scenarios would assert the same
string three times rather than three distinct behaviors. Drift across all four
surfaces is covered by one test.

## Vocabulary

- **Normative clause** — a `spec.md` sentence stating a prohibition or absolute: never, must not, always, only.
- **Binding** — a scenario paired with the condition under which it fails, such that the failure would falsify a named normative clause.
- **Named-but-unbound** — a scenario whose title matches an invariant while its `Given` establishes a weaker precondition. Reads as coverage; proves nothing.

## Jobs To Be Done

### invariant-binding.SWM1 — Catch an unenforced invariant before code exists

**Persona:** Safeword Maintainer (SWM)

> When I write a spec that forbids something absolutely, I want the scenario
> gate to refuse the ticket until some scenario would fail if that thing
> happened, so I can stop shipping guarantees nothing enforces.

#### invariant-binding.SWM1.R1 — Every normative clause names a falsifying scenario

For each clause stating a prohibition or absolute, the scenario set contains
one whose failure would falsify it. An invariant with no such scenario is a
must-fix at the scenario-gate, while no code exists and the fix is cheap.

#### invariant-binding.SWM1.R2 — A weaker precondition does not bind an invariant

A scenario whose title names the invariant while its setup establishes a weaker
precondition does not bind it. The mismatch between the scenario's `Given` and
the invariant's actual condition is reported as a vacuous pass.

### invariant-binding.TBU1 — Get a finding worth acting on

**Persona:** Technical Builder (TBU)

> When the gate tells me an invariant is unbound, I want it to name the
> condition that would falsify it, so I can write the missing scenario instead
> of guessing what would satisfy the reviewer.

#### invariant-binding.TBU1.R1 — A binding states its falsifying condition

A binding is recorded as scenario plus the condition under which it fails,
never a bare scenario reference. A reference alone degenerates into keyword
matching — every "never" acquires a rubber-stamp pointer and the lens passes
vacuously, reproducing one level up the defect it exists to catch.

## Outcomes

- A spec invariant with no falsifying scenario is caught at the scenario-gate, not at review of the merged PR.
- A scenario that names an invariant without exercising it is reported rather than credited.
- All four review-spec surfaces carry the lens, and drift fails a test.

## Evidence limits

This lens is agent-run prose, like every other review-spec check, so its
scenarios cover surface presence and drift — observable and falsifiable: remove
the lens from a surface and the test fails. They do not cover the quality of a
reviewer's judgment in applying it. That is validated once, manually, against a
known positive: QRX2DN's `never_uses_a_fallback_for` rows, which a reviewer
running the lens must flag as named-but-unbound.

Writing a scenario asserting "the reviewer applies the lens correctly" would
pass with the lens deleted — the exact vacuous pattern this ticket exists to
prevent. Stating the limit is the honest alternative.

## Open Questions

Resolved: the lens belongs in `review-spec`, not `self-review`. `review-spec`
already reads `spec.md` for the **Surface coverage** lens, so a cross-artifact
check is established there. `self-review` runs before scenarios exist and could
not compare an invariant against a scenario set not yet written.

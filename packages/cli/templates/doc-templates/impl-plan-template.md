# Impl Plan: {title}

**Status:** planned

<!--
Implementation plan for a feature ticket, authored at scenario-gate exit —
after scenarios are validated, before TDD starts. Lives next to ticket.md as
impl-plan.md. Status lifecycle: `planned` (written, code not started) →
`implemented` (reconciled against what actually shipped at implement-phase
exit). Every section below must have content or `skip: <reason>` — never
leave one blank. Fill each section, then delete the guidance comments.
-->

## Approach

<!-- Open by naming the riskiest assumption this design rests on and the
cheapest scenario that proves it — concrete and scenario-bound, not vacuous;
if no single slice is load-bearing, say so. Then record how each
scenario/behavior will be satisfied: which component or layer owns it, the
primary proof (`unit`, `integration`, `E2E`, or `eval`) chosen by
`testing/SKILL.md`'s highest practical scope rule, the reason that proof is
enough, any supporting proof needed for pure-logic edge cases, AI output
quality, or entry-point wiring, and the build order so each task builds on
what's already green — among dependency-free work, sequence the load-bearing
slice (the one proving that riskiest assumption) first, so a wrong design fails
on slice 1 while it's still cheap. This absorbs the scenario-gate exit's proof
plan + sequencing step — record that output here. -->

## Decisions

<!-- One row per significant technical choice (storage, queue, interface,
data model). Name the alternatives considered and why they lost — future
readers must be able to tell intentional design from accident.

| Decision | Choice | Alternatives considered | Rejected because |
| -------- | ------ | ----------------------- | ---------------- |

Complex decisions may add a short paragraph under the table. If the feature
has no architectural choices, write `skip: <reason>` instead. -->

## Arch alignment

<!-- Which existing architecture decisions (ADRs / architecture.md at the
configured paths.architecture location) this implementation honors, by title.
If none are recorded yet, write `skip: no ADRs in this project yet`. -->

## Known deviations

<!-- Where this implementation deviates from current architecture guidance,
and why that is acceptable. Surface drift deliberately — deviations are
documented, not forbidden. If none: `skip: no deviations planned`. -->

## Doc impact

<!-- Which configured documentation sources (`docs.sources` in
.safeword/config.json — README, docs sites, guides) do this feature's
customer-visible changes touch? Enumerate each affected surface and fold the
updates into the build order as tasks. Internal-only change with no
customer-visible behavior: `skip: <reason>`. -->

## Assessment triggers

<!-- Future changes that would prompt re-evaluating these choices (scale
thresholds, new consumers, dependency shifts). Forward-looking — the
conditions under which this design should be revisited. -->

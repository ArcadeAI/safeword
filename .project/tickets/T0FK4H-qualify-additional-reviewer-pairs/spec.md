# Spec: Qualify additional reviewer pairs without retiring the existing pair

Written 2026-11-03, after implementation, when T0FK4H was reclassified from task to feature. It records the behavior that shipped on #6319; it is not a pre-implementation plan.

## Product Bet

- **Problem / why now:** the packaged reviewer-capability catalogue matched every record against one global revision whose settings digest hashes the pinned model ids, so qualifying `claude-opus-5-5`/`gpt-6.1-sol` would retire the qualified `claude-opus-5`/`gpt-6-astra` pair (#6316).
- **Expected outcome:** several pinned pairs coexist; each record counts only for its own pair, and a new pair stays unqualified until its sealed evidence exists.
- **Success threshold:** the shipped pair's digest (`acd5a699…`), evidence files and catalogue records stay byte-identical, and a second qualified pair is admitted through planning review.
- **Non-goals:** running the paid qualification, changing review routes, ticket 9239QM.

## Jobs To Be Done

### qualify-additional-reviewer-pairs.SWM1 — Qualify a new reviewer pair without losing the qualified one

**Persona:** Safeword Maintainer (SWM)

> When a newer Claude/Codex pair becomes available, I want to pin and later qualify it alongside the pair that is already qualified, so I can adopt it without retiring trusted review admission or shipping unproven capability claims.

#### qualify-additional-reviewer-pairs.SWM1.R1 — Each pinned pair has its own revision, and the shipped pair's revision is unchanged

#### qualify-additional-reviewer-pairs.SWM1.R2 — A capability record counts only for the pinned pair it was qualified with

#### qualify-additional-reviewer-pairs.SWM1.R3 — Only pairs with complete, matching sealed evidence enter the shipped catalogue

## Shape

### M1 — Pair-scoped capability admission

One slice, shipped on #6319: pinned pair list, per-pair revision, model-bound lookup, coordinator wiring, catalogue builder and maintainer script.

## Killer Demo

skip: maintainer-only change with no user-visible payoff until a later, separately approved qualification run.

## Surfaces

skip: no host surface changes; the catalogue is bundled identically into every runtime.

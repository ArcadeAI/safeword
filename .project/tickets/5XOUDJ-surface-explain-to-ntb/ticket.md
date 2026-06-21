---
id: 5XOUDJ
slug: surface-explain-to-ntb
parent: K6CAJN-ntb-experience-epic
type: patch
phase: intake
status: backlog
created: 2026-06-21T14:24:00Z
last_modified: 2026-06-21T14:24:00Z
---

# Surface /explain to the NTB

**Goal:** Make the NTB's one lifeline discoverable — in the README and proactively from the agent.

**Why (audit M1):** The `/explain` mechanism is fully wired (EXPLAIN_HINT on every hard block, ZCYD5P), but discovery is broken: `/explain` is absent from the README command list (`README.md:250-258`), the skill is `disable-model-invocation: true` so the agent never auto-offers it, and the hint can be narrated over inside the block reason. The NTB only benefits if they already know to type it.

## Scope sketch

- Add `/explain` to the README command list with NTB-first framing ("get a plain-English version of any safeword message or where you are").
- Add a SAFEWORD.md rule: when the user seems unsure, offer `/explain` in plain words.
- Out of scope: changing `/explain`'s behavior or the EXPLAIN_HINT string (already shipped).

## Acceptance — offer on confusion-signal, not on block-occurrence

The TB-regression risk is a Clippy: an offer that fires every time a gate trips would nag the TB who hit the block and already knows the fix. The rule must:

- **Trigger on signal, not event.** The agent offers `/explain` only when the *user* shows confusion — asks "what?" / "why is it blocked?", pastes a block back, or stalls — never automatically on every block. A TB who clears a gate without asking never sees the offer.
- **Offer once, in plain words.** One short line, not a recurring banner.

The README listing is purely additive (no trigger, no TB cost). The judgment call is the trigger wording — "seems unsure" is fuzzy and could over- or under-fire — so spell out the concrete signals above in the rule rather than leaving it to interpretation.

## Work Log

- 2026-06-21T14:24:00Z Created from PRODUCT-AUDIT-ntb.md M1.
- 2026-06-21T14:34:00Z Added acceptance: offer `/explain` on user confusion-signal, not on block-occurrence (avoid the Clippy TB-regression); README listing stays purely additive.

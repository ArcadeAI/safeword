---
id: QQJK5S
slug: plainness-contract-persona-aware
parent: K6CAJN-ntb-experience-epic
type: task
phase: implement
status: in_progress
created: 2026-06-21T14:24:00Z
last_modified: 2026-06-21T14:39:00Z
---

# Make the "Talking to the user" plainness contract persona-aware

**Goal:** Stop the agent's most-read framing rule from assuming a developer audience, so stack-level jargon gets translated for the NTB.

**Why (audit H1):** `templates/SAFEWORD.md` "Speak plainly" ends with _"Assume the user knows their stack — don't explain TypeScript, async, or `git rebase` to a developer who's using them."_ The NTB explicitly is not that developer and can't read the diff. This single carve-out licenses every relayed gate block and verdict to leave stack jargon raw — for the larger, highest-value audience. It is the deepest lever in the NTB audit; fixing individual blocks won't help while the governing contract assumes stack fluency.

## Scope sketch

- Reword the carve-out in `packages/cli/templates/SAFEWORD.md` (+ byte-identical dogfood `.safeword/SAFEWORD.md`) so plainness is persona-aware: when the configured audience is the NTB, gloss stack terms in one clause; keep the "don't over-explain to a developer" behavior for the TB.
- Decide the detection mechanism: read `personas.md`/config for active audience, vs. a static "assume they may not read code — gloss on first use" default. `/figure-it-out` the tradeoff (false-glossing annoys TBs; under-glossing dead-ends NTBs).
- Out of scope: rewriting the gate messages themselves (downstream of this rule).

## Acceptance — must thread NTB **and** TB (don't tax the TB)

The failure mode is "fix NTB, annoy TB." The reworded rule must satisfy all three, or it's not done:

- **Gloss on actionability, not on detected audience.** A term gets a one-clause plain gloss the first time it's load-bearing in an *ask* (a block, a decision, a "do X next") — the moment an NTB is stuck. Routine narration a TB skims gets no gloss. The rule must read as audience-agnostic and self-calibrating, not "if NTB then explain everything."
- **Layer, don't replace.** Plain lead + technical detail in the same message, so a TB eye-jumps to the detail and an NTB reads the lead. No information is removed for the TB; the rule extends the existing scan-not-read / front-load contract rather than fighting it.
- **One gloss, once.** A term is glossed at most once per turn, in ≤1 clause. No re-defining, no paragraphs of reassurance — that reads as condescension to a TB and is the Clippy failure mode.

Default behavior must thread both with no config. An optional `audience: ntb` signal may *raise* glossing aggressiveness for known-NTB projects, but is not required for the default to be safe. The cost asymmetry justifies erring toward glossing: an unneeded gloss is ~5 skippable words; a missing one is an NTB dead-end. Run `/figure-it-out` on the default rule wording before committing — being wrong here taxes the most-read surface in the product.

## Work Log

- 2026-06-21T14:24:00Z Created from PRODUCT-AUDIT-ntb.md H1.
- 2026-06-21T14:34:00Z Added NTB+TB threading acceptance criteria (gloss-on-actionability, layer-don't-replace, one-gloss-once) so the constraint is encoded, not just in review chat.
- 2026-06-21T14:39:00Z Reworded the "Speak plainly" carve-out in SAFEWORD.md (template + byte-identical dogfood). Dropped "assume the user knows their stack"; replaced with gloss-on-actionability ("load-bearing in an ask"), layered inline gloss (fluent reader skips at no cost), one-gloss-per-turn, leave-narration-unglossed, and the cost-asymmetry rationale. Audience-agnostic default, no config required. Both copies byte-identical. Meets all three acceptance criteria.

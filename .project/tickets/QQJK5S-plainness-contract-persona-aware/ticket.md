---
id: QQJK5S
slug: plainness-contract-persona-aware
parent: K6CAJN-ntb-experience-epic
type: task
phase: intake
status: backlog
created: 2026-06-21T14:24:00Z
last_modified: 2026-06-21T14:24:00Z
---

# Make the "Talking to the user" plainness contract persona-aware

**Goal:** Stop the agent's most-read framing rule from assuming a developer audience, so stack-level jargon gets translated for the NTB.

**Why (audit H1):** `templates/SAFEWORD.md` "Speak plainly" ends with _"Assume the user knows their stack — don't explain TypeScript, async, or `git rebase` to a developer who's using them."_ The NTB explicitly is not that developer and can't read the diff. This single carve-out licenses every relayed gate block and verdict to leave stack jargon raw — for the larger, highest-value audience. It is the deepest lever in the NTB audit; fixing individual blocks won't help while the governing contract assumes stack fluency.

## Scope sketch

- Reword the carve-out in `packages/cli/templates/SAFEWORD.md` (+ byte-identical dogfood `.safeword/SAFEWORD.md`) so plainness is persona-aware: when the configured audience is the NTB, gloss stack terms in one clause; keep the "don't over-explain to a developer" behavior for the TB.
- Decide the detection mechanism: read `personas.md`/config for active audience, vs. a static "assume they may not read code — gloss on first use" default. `/figure-it-out` the tradeoff (false-glossing annoys TBs; under-glossing dead-ends NTBs).
- Out of scope: rewriting the gate messages themselves (downstream of this rule).

## Work Log

- 2026-06-21T14:24:00Z Created from PRODUCT-AUDIT-ntb.md H1.

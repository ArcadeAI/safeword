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
- Add a SAFEWORD.md rule: when a gate fires and the user seems unsure, offer `/explain` in plain words.
- Out of scope: changing `/explain`'s behavior or the EXPLAIN_HINT string (already shipped).

## Work Log

- 2026-06-21T14:24:00Z Created from PRODUCT-AUDIT-ntb.md M1.

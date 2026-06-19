---
id: D9NE6D
slug: refactor-abstraction-smell-epic
type: feature
phase: intake
status: in_progress
epic: refactor-abstraction-smell
parent: B6MZ4Z
children: []
created: 2026-06-18T19:25:15.660Z
last_modified: 2026-06-18T19:26:30Z
---

# Sub-epic: Refactor skill — abstraction-level smell (+ optional scout)

**Goal:** Give `refactor` the one smell category its catalog lacks — wrong level of abstraction — optionally a discovery step, and a sharper post-refactor verify against silent regressions, while preserving the iron law (ONE refactoring → TEST → COMMIT).

**Parent:** [B6MZ4Z — review & refactor uplift](../B6MZ4Z-review-refactor-uplift-epic/ticket.md)

**Why:** `refactor`'s catalog is all mechanical Fowler moves (rename, extract, guard clauses, magic-literal, dead-code) with no abstraction-altitude lens. `/simplify`'s "altitude" angle maps to the established Dubious / Wrong-Level-of-Abstraction smell, detected via Shotgun Surgery (Fowler, 1999). `refactor` also has no finder — it only starts after a smell is named for it.

## Scope

| Item | Change                                                                                                                                                                                                                                                                                                                | Confidence | Behavior-preserving? |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | -------------------- |
| R1   | Add "Wrong Level of Abstraction" to the smell list + a Tier 3 catalog row ("special cases on shared infra → generalize the mechanism"); signal = Shotgun Surgery                                                                                                                                                      | High       | Yes                  |
| R2   | Optional scout that **runs `/lint` + `/audit` (eslint/tsc/knip) for the mechanical smells** (long fn, deep nesting, magic literals, dupe, dead code) and applies prose judgment only to the **semantic** ones (reuse, altitude) — emitting a prioritized list fed one-at-a-time into the loop (NO parallel execution) | Med        | Yes (list only)      |
| R3   | Post-refactor regression checklist for Phase 4 VERIFY (beyond "tests pass"): did an extract/move silently drop a guard or anchor? setup/teardown asymmetry? a predicate method that gained a side effect? a config default flipped? — adapted from `/code-review`'s sweep gap-focus list                              | High       | Yes (checks only)    |

**Caps record, never hide:** if R2's scout caps the smell list, it logs what it dropped — `/code-review` tracks over-budget candidates (`budgetDropped`, `MAX_VERIFY=25`) rather than silently truncating. A capped scout that reads as "nothing else to do" is a bug.

## Out of scope / rejected

- Parallel multi-agent execution — breaks the one-change → test → commit safety law.
- Efficiency/perf smells — behavior-adjacent; a behavior-preserving skill must not chase them.

## Done when

- The catalog names the abstraction smell with a citable definition and a Tier 3 "generalize, don't special-case" entry.
- The iron-law text is unchanged.
- Phase 4 VERIFY names the regression checklist; tests stay the ground-truth gate (the checklist guides what to look at, it does not replace green tests).
- R2's scout is phrased behaviorally (produce a prioritized smell list) and runs inline where subagents aren't available (Codex) — never a hard subagent requirement.
- SKILL.md edit has Codex (`.agents/skills/`) + Cursor (`.mdc`) parity copies synced.

## Work Log

- 2026-06-18 Created sub-epic under B6MZ4Z from `/figure-it-out` R1/R2.
- 2026-06-18 Second-pass `/code-review` review: added R3 (post-refactor regression checklist from the sweep gap-focus list) + a no-silent-caps note for the R2 scout.

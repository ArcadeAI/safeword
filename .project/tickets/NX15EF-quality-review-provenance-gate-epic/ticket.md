---
id: NX15EF
slug: quality-review-provenance-gate-epic
type: task
phase: intake
status: done
epic: quality-review-provenance-gate
parent: B6MZ4Z
children: []
created: 2026-06-18T19:25:15.697Z
last_modified: 2026-06-18T19:26:30Z
---

# Sub-epic: Quality-review skill — provenance-gated verdicts (+ research angles)

**Goal:** Make `quality-review`'s verdict trustworthy under documented LLM-judge overconfidence by gating severity on evidence provenance, and sharpen its research into named angles — without adding committees or effort knobs.

**Parent:** [B6MZ4Z — review & refactor uplift](../B6MZ4Z-review-refactor-uplift-epic/ticket.md)

**Why:** `quality-review` already emits provenance tags (verified / training-data / uncertain) and already uses an independent _different-model_ reviewer — which the literature says beats heterogeneous committees and is the recommended high-stakes pattern. The gap: provenance doesn't yet _gate_ the verdict, and LLM judges are systematically overconfident.

## Scope

| Item | Change                                                                                                                                                                                                                                                                                                                                                                          | Confidence |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Q1   | Provenance gate + required evidence: every verdict carries an `evidence` field that quotes/cites its source; a CRITICAL / REQUEST-CHANGES call must cite a `verified` (fetched-this-session) source, while `training-data`/`uncertain` cap at NOTE/PLAUSIBLE and never block. Mirrors code-review's `VERDICT_SCHEMA {verdict, evidence}` + "evidence must quote/cite the line." | High       |
| Q2   | Structure §2–3 research as named angles (version-currency / deprecation / CVE / primary-source) — diversity is the validated lever, not vote count; propagate any user focus/scope restriction into every angle (code-review rides the user's verbatim instructions into every finder/verifier)                                                                                 | Med        |

**Deliberate inversion:** `/code-review`'s verifier is _recall-biased_ (PLAUSIBLE-by-default — a missed bug ships). quality-review's gate is the precision-biased inverse — block only on a `verified` claim — because a false CRITICAL erodes trust. Same 3-state machinery, opposite default.

## Keep, don't touch

- The independent _different-model_ reviewer loop — already ahead of `/code-review`'s same-model subagents.

## Rejected

- Consensus voting committee; per-claim verifier swarms (~8× compute for marginal gain); effort levels.

## Done when

- Output Format states the provenance → severity gate; every verdict carries an evidence citation, and a blocking verdict whose evidence is not `verified` is invalid.
- The research section enumerates the named angles.
- Unverifiable claims are surfaced as NOTE/uncertain with the verification gap named — never silently omitted (mirrors code-review reporting its refuted/dropped accounting, not just survivors).
- SKILL.md edit has Codex (`.agents/skills/`) + Cursor (`.mdc`) parity copies synced.

## Work Log

- 2026-06-18 Created sub-epic under B6MZ4Z from `/figure-it-out` Q1/Q2.
- 2026-06-18 Second-pass `/code-review` review: tightened Q1 to require an evidence field (mirrors `VERDICT_SCHEMA`); noted the recall-vs-precision inversion; Q2 gains focus-propagation.
- 2026-06-19 Fourth-pass review (workflow Synthesize + `x$3` + explain-ultra): confirmed v2.1.170 has 4 cleanup angles / no conventions angle (conventions ride through Scope). One refinement folded in — surface unverifiable claims, don't omit them. Extraction is exhausted; recommend stopping and moving to execution.
- 2026-06-19 Implemented Q1 + Q2 in the quality-review template: Q1 adds a "Provenance gate (required)" to the Output Format (CRITICAL/REQUEST-CHANGES needs a `verified` source; training-data/uncertain cap at NOTE and never block; surface unverifiable claims, don't drop). Q2 reframes §2 as named Research Angles (version-currency / deprecation / CVE / primary-source) with focus-propagation to every angle. Kept the different-model reviewer loop untouched. Synced byte-parity → `.claude` + `.agents`; condensed Q1+Q2 into the Cursor `.mdc` (+ dogfood). parity 157; skills-validation + parity tests green (596). Status in_progress pending `/verify` + user confirmation.
- 2026-06-19 Epic-review nit: trimmed the provenance-gate rationale to the skill's terse voice ("Abstention discipline: LLM judges over-state confidence by default, so an unverified blocker is false certainty") — kept the why, cut the words.

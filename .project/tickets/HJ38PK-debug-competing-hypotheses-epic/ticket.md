---
id: HJ38PK
slug: debug-competing-hypotheses-epic
type: feature
phase: intake
status: in_progress
epic: debug-competing-hypotheses
parent: B6MZ4Z
children: []
created: 2026-06-19T14:17:47.480Z
last_modified: 2026-06-19T14:18:30Z
---

# Sub-epic: Debug skill — competing hypotheses + disconfirm-first

**Goal:** Replace `debug`'s single-hypothesis step with 2–3 competing hypotheses tested cheapest-_disconfirming_-first, so investigation eliminates rather than confirms — without touching the iron law (root cause first, ONE change per fix).

**Parent:** [B6MZ4Z — reasoning-skills uplift](../B6MZ4Z-review-refactor-uplift-epic/ticket.md)

**Why:** Phase 3.1 literally says **"Form Single Hypothesis"** — the documented first-guess-fixation failure mode. The change (hold 2–3, run the most _disconfirming_ test first) rests on well-replicated ground, and deliberately **not** on the contested bit:

- **Supported:** considering alternative hypotheses / "consider the opposite" reduces confirmation bias ([Lord et al. 1984](https://www.sciencedirect.com/topics/psychology/confirmation-bias); [task-structure study, 2024](https://pmc.ncbi.nlm.nih.gov/articles/PMC11169332/)); _diagnostic_ testing (tests necessity → can disconfirm) beats _pseudodiagnostic_ (confirm-only); and offering candidate hypotheses aids debugging — the [Hypothesizer](https://dl.acm.org/doi/10.1145/3586183.3606781) RCT direction (n=16; ~5×/~3×, tool-mediated) and a related ~6× study.
- **Contested — which we do NOT prescribe:** the formal **ACH weighted matrix**'s measured bias-reduction is mixed ([Dhami 2019](https://onlinelibrary.wiley.com/doi/full/10.1002/acp.3550)); the 2024 study found the ACH column-layout matrix didn't reduce bias while a different layout did. We borrow ACH's _stance_ (competing hypotheses + disconfirmation), never its scoring matrix.

Locking onto one hypothesis is the debugging twin of "recall is gated at find" — the same root insight behind `/code-review`'s diverse finders.

## Scope

| Item | Change                                                                                                                                                                                                                                                                                                                  | Confidence |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| D1   | Phase 3.1: "Form **Single** Hypothesis" → "Form **2–3 competing** hypotheses"; test the cheapest _disconfirming_ one first; frame as elimination, not confirmation                                                                                                                                                      | High       |
| D2   | Root Cause Checkpoint logs each _eliminated_ hypothesis + the disconfirming evidence (no-silent-caps) — not just the confirmed cause                                                                                                                                                                                    | Med        |
| D3   | Reconcile downstream surfaces for consistency: Phase 3.3 "NEW hypothesis" loop, Red Flags, and the Quick Reference "Confirmed or formed new theory" row                                                                                                                                                                 | Med        |
| D4   | Name **bisection / delta-debugging** as the headline _isolate_ tactic in Phase 1: binary-search the change history (`git bisect`), input, or state to halve the suspect space each step — the most discriminating disconfirming test there is ([Zeller delta debugging](https://en.wikipedia.org/wiki/Delta_debugging)) | High       |

## Out of scope / rejected

- Parallel hypothesis _testing_ or multi-agent fan-out — breadth belongs at hypothesis _formation_; the fix/test step stays ONE change at a time (debug's existing discipline).
- Replacing the root-cause-first iron law — unchanged; this sharpens how hypotheses are formed and ruled out.

## Done when

- Phase 3 forms 2–3 competing hypotheses and tests disconfirming-cheapest-first; the "single hypothesis" language is gone.
- Phase 1's isolation guidance names bisection/delta-debugging (binary-search the history/input/state to the fault) as a first-class tactic, not just symptom→source tracing.
- The checkpoint records eliminated hypotheses with their disconfirming evidence.
- Iron law (root cause before fix; one change per fix) text is unchanged.
- D4's bisection is written as non-interactive `git bisect run <script>` (agent-drivable on any harness's shell), not interactive good/bad round-trips.
- SKILL.md edit has Codex (`.agents/skills/`) + Cursor (`.mdc`) parity copies synced.

## Work Log

- 2026-06-19 Created sub-epic under B6MZ4Z from `/figure-it-out` (debug/figure-it-out/brainstorm pass).
- 2026-06-19 `/figure-it-out` (challenge — "contested in lab studies, why do it?"): reframed off the ACH matrix. Kept the change; rejustified on consider-the-opposite (Lord 1984) + diagnostic-vs-pseudodiagnostic testing — the supported pillars. ACH demoted to stance-only; the contested matrix is not prescribed. Title/Goal drop "(ACH)".
- 2026-06-19 Added D4 (bisection/delta-debugging as the headline _isolate_ tactic) after the "replicate → isolate → terminate" framing check — sharpest disconfirming test, and debug never named it. Confirmed debug's reproduce/isolate/fix flow matches Zeller scientific debugging.
- 2026-06-19 `/figure-it-out` vs Anthropic: verified Anthropic ships **no** debugging-methodology skill — `debug` is a log toggle; no debug artifact across the 13 repo plugins; published guidance is scattered tactics (failing-test-first, verification) we already match. No change driven; debug is a methodology Anthropic doesn't have → no overlap/duplication risk (positioning, like X4518B).
- 2026-06-19 Implemented D1–D4 in the debug template (Phase 3 single→competing hypotheses + disconfirm-first; Evaluate-Result table reframed to elimination; checkpoint logs ruled-out hypotheses; new Phase 1 §6 Bisect-to-the-Fault; Quick-Reference reconciled). Synced byte-parity → `.claude` + `.agents` (Codex); condensed change into the Cursor `.mdc` (+ dogfood). parity-check: 157 pairs in sync. Tests: skills-validation + parity green (596). Status stays in_progress pending `/verify` + user confirmation.
- 2026-06-19 `/quality-review` (independent Sonnet reviewer): 2 REQUEST-CHANGES fixed — (1) `git bisect run` needed the `git bisect start`/`good`/`bad` setup prereq (was implied standalone → `fatal: no terms defined`); (2) Cursor checkpoint omitted the ruled-out-logging its own elimination table assumed. Also sharpened the Phase 3.1 cross-ref to "Phase 1 §6". Re-synced; parity 157; tests green. Folded into the HJ38PK commit.
- 2026-06-19 Epic-level `/quality-review` (independent Sonnet over all 5 skills) caught a missed surface: the SKILL.md bisect-setup fix wasn't carried into the **Cursor** rule's inline mention (`git bisect run` without setup → same `fatal: no terms defined` for Cursor-only users). Fixed the Cursor parenthetical to include `git bisect start`/`bad`/`good` → `run` → `reset`. parity 157.

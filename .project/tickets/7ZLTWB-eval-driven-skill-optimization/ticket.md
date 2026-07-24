---
id: 7ZLTWB
slug: eval-driven-skill-optimization
type: epic
phase: intake
status: in_progress
epic: eval-driven-skill-optimization
children: ['21RAT9', 'M3SI7T', 'XZFSZ5']
scope:
  - A reusable, skill-agnostic harness for measurably improving any skill prompt - seed known defects into a certified-clean corpus, score with a deterministic set-matching metric (no LLM judge), gate on a relative recall floor (majority-voted protected set), a multi-run consensus accept gate, and a Tier-2 real-harness gate (claude -p).
  - The methodology as a durable asset - eval-first; GEPA-optional (the optimizer serves the eval, never replaces it); single-run adjudication is unreliable; the bare-model proxy oversells the gain, so Tier-2 is the honest ship gate.
  - First application beyond review-spec - the pr-review skill (WAWQA6/G5337S) and its eval (WAWQA6/CWGYH0).
out_of_scope:
  - Shipping any specific skill change - that is each child ticket's job (M3SI7T ships review-spec).
  - The pr-review product itself - WAWQA6 owns that; this epic owns the harness CWGYH0 consumes.
done_when:
  - The harness runs against a second skill (pr-review) with zero review-spec-specific code - corpus, skill path, fixtures, and protected manifest are all parameters.
  - The methodology is documented so a new skill onboards without re-deriving the floor/consensus/Tier-2 design.
  - review-spec's lean candidate is shipped (M3SI7T) - the epic's first end-to-end proof.
created: 2026-07-24T04:13:44.000Z
last_modified: 2026-07-24T04:13:44.000Z
---

# Eval-driven skill optimization — a reusable harness to measurably improve any skill prompt

**Goal:** Turn the review-spec eval machinery (built in E2D8S5, hardened in 21RAT9) into a reusable, skill-agnostic harness — so a proposed prompt change to ANY skill is adjudicated by evidence, not taste, before it ships.

**Origin:** The `/figure-it-out` that reshaped the +124% GEPA winner into a lean +32% candidate, which then passed the bare-model gate (−46% false alarms) AND the real-harness Tier-2 gate (−34%, floor clean) — plus the call to generalize the harness for reuse, pr-review next.

## The methodology (the durable asset)

1. **Certified-clean corpus + seeded defects** — one mutation per fixture; the mutation operator IS the label. No LLM judge (deterministic set-matching → dodges judge bias).
2. **Relative recall floor** — reject only a miss of a seed the BASELINE reliably catches (majority-voted protected set, ⌈2k/3⌉). Systematically-missed seeds stay measured but unprotected (an absolute floor is unsatisfiable).
3. **Multi-run consensus gate** — single runs are too noisy (even the baseline breaches a one-run floor ~⅓ of the time); gate on ⌈2N/3⌉ consensus.
4. **Tier-2 real-harness gate** — run the finalist through `claude -p` (full CC system prompt + tools), because the bare-model proxy oversells the gain (measured: −46% → −34%).
5. **GEPA is optional** — the optimizer serves the eval; a human-authored candidate beat the GEPA winner here.

## Children

- **21RAT9** review-spec-eval-hardening — **done**. The proving ground: hardened the eval, rejected the raw GEPA winner (it dropped a real 2nd defect ~⅓ of the time), salvaged then leaned a candidate that passes Tier-1 and Tier-2.
- **M3SI7T** adopt-lean-review-spec — ship the validated lean candidate into the live review-spec skill across all harnesses.
- **XZFSZ5** generalize-skill-eval-harness — parameterize the machinery so it drives any skill; first external application is pr-review (feeds CWGYH0).

## Relation to WAWQA6 (autonomous-pr-review)

This epic owns the reusable HARNESS; WAWQA6 owns the pr-review PRODUCT. XZFSZ5 delivers the harness that WAWQA6/CWGYH0 consumes — the two epics meet there.

## Work Log

- 2026-07-24 Epic created (user directive). Houses 21RAT9 (done) + adoption (M3SI7T) + generalization (XZFSZ5). The generalization's first target is pr-review, linking to WAWQA6/CWGYH0.
- 2026-07-24 **/figure-it-out on code-bug corpus construction → the seeded-defect method does NOT cleanly transfer to pr-review; CWGYH0 already chose the right fit, and the research says why.** Investigated building a seeded code-bug corpus for pr-review (mirroring review-spec's one-mutation-per-fixture). Fresh evidence says don't: synthetic bugs are systematically EASIER than real (LLM detectors ~10.5% higher on synthetic Juliet than real-world; shortcut-learning leaks the label), "certified-clean" is far harder for a code diff than a BDD scenario (a latent pre-existing bug becomes false-alarm noise), the mutant→real-fault correlation is contested, and every 2026 code-review benchmark (SWR-Bench, entelligence) leans on golden-comments + a judge — not deterministic set-matching. **CWGYH0 independently landed on the right approach already** — real human-approved-zero-comment arcade PRs + human triage + a pre-registered bar — so NO new corpus ticket was cut (it would duplicate CWGYH0). **Thesis refinement:** the reusable, skill-agnostic asset is the GATING machinery — relative recall floor, multi-run ⌈2N/3⌉ consensus, Tier-2 real-harness gate, and the discipline (eval-first, GEPA-optional, never auto-adopt). "Seed defects into a certified-clean corpus + deterministic set-matching" is review-spec-SPECIFIC (BDD defects are cheap+exact to seed; code bugs are neither), NOT universal. So XZFSZ5 should generalize the FLOOR/CONSENSUS/Tier-2 seams — which CWGYH0's real-PR corpus CAN feed (human-triaged findings still support a floor + consensus + a pre-registered bar) — and drop the assumption that every skill gets a seeded corpus. Sources: synthetic-vs-real gap (arXiv 2512.22306), mutants-vs-faults (Just FSE'14), code-review benchmark survey (arXiv 2602.13377), GHRB contamination (arXiv 2310.13229).

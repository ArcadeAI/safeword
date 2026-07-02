---
id: 7ZCKS6
slug: retro-extraction-eval
parent: RV9JT4-retro-transcript-mining
type: task
phase: intake
status: todo
created: 2026-06-28T03:36:16.072Z
last_modified: 2026-06-28T03:36:16.072Z
scope: |
  Establish an EVAL for the one thing RV9JT4's 21 scenarios can't cover: does the
  fresh-context extractor (per the retro guide) actually find real safeword
  friction from a real transcript? All RV9JT4 tests use a stub extractor, so the
  core premise — transcript-mining beats volatile memory — is unverified.
  Build a small labeled set: N real session transcripts with hand-labeled
  ground-truth friction (and known non-friction / customer-only noise). Run the
  retro extraction over them and measure precision (filed findings that are real
  safeword friction) and recall (real friction actually surfaced), plus the
  false-positive rate of customer-issue leakage into findings.
out_of_scope: |
  - The deterministic pipeline (schema/sanitizer/dedup/ledger) — already tested in
    RV9JT4; this is purely about extraction QUALITY.
  - Auto-trigger and multi-tracker — separate concerns.
done_when: |
  - A labeled transcript set + a repeatable eval harness exist.
  - Precision/recall + customer-leak-rate are measured and recorded, with an
    agreed pass threshold (e.g. high recall of known friction, near-zero customer
    leak).
  - If extraction underperforms, the retro guide / fresh-context prompt is tuned
    and re-measured.
---

# Eval: retro extraction quality on real transcripts

**Goal:** Verify the core value of `safeword retro` — that a fresh-context reader
actually surfaces real safeword friction from a transcript — with a labeled eval,
not just stubbed wiring tests.

**Why:** RV9JT4's 21 scenarios all use a STUB extractor, so the feature could
extract garbage or nothing and still pass. The premise (transcript-mining beats
the ~40%-unreliable self-report) needs an evidence-grounded measurement. AI
output quality is an eval concern, not a unit-test one (testing/SKILL.md).

**Parent:** RV9JT4-retro-transcript-mining. Surfaced by the AC-coverage audit —
the missing acceptance criterion for extraction quality.

## Work Log

- 2026-06-28T03:36:16.072Z Started: Created ticket 7ZCKS6 (sub-ticket of RV9JT4)

---
id: MT27QG
slug: loc-gate-vs-phase-placement
type: feature
phase: intake
status: backlog
epic: workflow-gate-hygiene
created: 2026-05-31T18:31:15.935Z
last_modified: 2026-05-31T18:31:15.935Z
---

# Review LOC gates — keep, or move trigger to phase/step

**Goal:** Find every LOC-triggered gate in safeword and decide, per gate, whether a line-count threshold is the right trigger or whether a phase/step boundary would gate the same risk better.

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes (run intake when picked up).

## Why

Safeword's blast-radius control fires on a line-count heuristic — the ~400-LOC commit gate in `quality-state.ts` (with `META_PATHS` exclusions for `.safeword/`, `.claude/`, `.cursor/`, `.safeword-project/`). LOC is a proxy for "you've changed enough that you should commit / a reviewer should see a checkpoint," but it's a blunt one: 400 lines of mechanical rename and 400 lines of dense new logic carry very different risk, and the threshold can fire mid-task at an awkward boundary (there's already a documented failure — the LOC gate blocking mid-merge, `project_loc_gate_blocks_merge`). A phase/step boundary (e.g. commit-at-GREEN, commit-on-phase-transition) may gate the _actual_ risk moment more precisely than a line count.

## Scope (sketch — refine at intake)

- **Find** every LOC-triggered gate: start at `quality-state.ts` (the ~400-LOC commit gate) and grep hooks/src for other line-count thresholds. Inventory each: what it gates, its threshold, its exclusions.
- **Per gate, decide:** keep LOC as-is, keep LOC but tune (threshold/exclusions), or move the trigger to a phase/step boundary (e.g. fire at GREEN, at phase transition, or per-scenario) — whichever gates the real risk with the fewest false trips.
- **Evidence-based call** (`/figure-it-out`): what's blast-radius control actually protecting against, and does LOC or a phase/step boundary correlate better with that risk? Check the `natural-vs-self-report-gates` learning (physics-not-policy) and the LOC-gate-blocks-merge failure mode.
- Ship any resulting gate change + tests.

## Out of scope

- Removing blast-radius control entirely — the question is _trigger placement_, not whether to gate.
- Non-LOC gates (phase gate, done gate) except where they'd absorb a relocated LOC trigger.

## Related

- **M7AZY3** — parent cleanup epic.
- `quality-state.ts` — the primary LOC gate (~400-LOC commit threshold + `META_PATHS`).
- Learnings: `natural-vs-self-report-gates` (physics-not-policy gate design), `project_loc_gate_blocks_merge` (the mid-merge block failure mode).

## Work Log

- 2026-05-31T18:31:15.935Z Started: Created ticket MT27QG
- 2026-05-31T18:31:15.935Z Filed (backlog): carved from this session's cleanup pass. LOC is a blunt blast-radius proxy (400 mechanical lines ≠ 400 dense lines) and has a known mid-merge-block failure. Inventory the LOC gates; per gate decide keep/tune/relocate-to-phase-step via /figure-it-out. Sized feature (gate-behavior change); intake confirms.

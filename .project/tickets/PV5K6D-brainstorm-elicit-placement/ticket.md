---
id: PV5K6D
slug: brainstorm-elicit-placement
parent: VKNF1T-platform-uplift-epic
type: feature
phase: intake
status: in_progress
created: 2026-06-10T00:01:03.826Z
last_modified: 2026-06-10T00:01:03.826Z
---

# Where to invoke brainstorm and elicit across the workflow

**Goal:** Systematize where safeword reaches for `/brainstorm` (divergent ideation) and `/elicit` (extract user-only knowledge) across the workflow — so the right thinking tool fires at the right moment, not only when the model remembers.

**Why:** Like figure-it-out (ZBVGPF), brainstorm and elicit are powerful but discretionary — they fire only when the model reaches for them. SAFEWORD.md's Clarify phase names "contribution techniques" and the elicit skill lists triggers, but there's no systematic embedding. brainstorm fits early exploration (option space wide and undefined); elicit fits when about to guess at user intent/constraints. Checkpoints make them default at the right moments.

> Status: **intake** — research/policy. **Strong tie to [embed-figure-it-out](../ZBVGPF-embed-figure-it-out/ticket.md) (ZBVGPF):** the three skills form one pipeline — diverge → extract → converge. Possible merge (see open questions).

## Where to embed (starter)

- **brainstorm** — Clarify/intake when the option space is wide and undefined, _before_ converging. Precedes figure-it-out (brainstorm diverges; figure-it-out converges with evidence).
- **elicit** — when about to guess at user intent / context / constraints: during Clarify, bdd DISCOVERY, debug (when user-only context is missing).

## Open questions (converge before spec)

- **The trio's boundary.** brainstorm (diverge) → elicit (extract user knowledge) → figure-it-out (converge with evidence). Define "use which when" so embedding doesn't create redundant ceremony. ZBVGPF flagged this same boundary — coordinate.
- **Merge with ZBVGPF?** The three are one pipeline; embedding them coherently might be ONE "thinking-skill orchestration" effort, not figure-it-out separately. Lean: keep separate tickets for tracking, design together. Settle before building.
- **Calibration (sharper than figure-it-out).** brainstorm/elicit are _more_ context-dependent — over-firing is more annoying (don't brainstorm a one-line fix; don't elicit what's in the code). Lean hard toward "only when the gap is real," never auto-every-time.
- **elicit vs existing Clarify techniques.** SAFEWORD.md already lists failure-modes / boundaries / scenario-walkthrough / regret-test / UX. Is elicit a formalization of those, or distinct? Reconcile.

## Related

- Parent: [platform-uplift epic](../VKNF1T-platform-uplift-epic/ticket.md).
- [ZBVGPF](../ZBVGPF-embed-figure-it-out/ticket.md) — figure-it-out embedding (the convergence end); coordinate, maybe merge.
- The `elicit` and `brainstorm` skills; SAFEWORD.md Clarify phase + contribution techniques.

## Work Log

- 2026-06-10T00:01:03.826Z Started: Created ticket PV5K6D

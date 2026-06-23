---
id: BHK9PW
slug: adversarial-review-class-taxonomy
type: feature
phase: intake
status: in_progress
created: 2026-06-23T05:48:00.000Z
last_modified: 2026-06-23T05:48:00.000Z
---

# Unify adversarial review under a 3-class reviewer taxonomy

**Goal:** Take a *consistent* approach to review across safeword — but consistency in the **taxonomy and the ledger**, not one uniform mechanism. Name the three reviewer classes in one place, make every class-1 (independent-review) gate share one shape, and explicitly tag the class-2/class-3 surfaces so nobody cargo-cults cross-model onto them.

**Why:** A `/figure-it-out` pass (2026-06-23) mapped where adversarial review exists. The system already encodes three different "checks" — independent review of own work (`quality-review`, `review-spec`, arch-gate: fork + no-weaker + cross-model-ideal), independent observation of an observable (`PRINCIPLES.md:20` — Haiku judge / test suite / parser; weaker is fine), and producer fan-out (`refactor:39`, `figure-it-out:64` — varied/cheaper models on purpose; no-weaker rule explicitly does **not** apply). The drift is that this taxonomy lives in three scattered spots, and **class 1 is internally inconsistent**: `spec.md` is class-1 work stuck at Tier-1 self-review, and `tdd-review` is class-1 work that is advisory-only. The threat model differs by class (correlated blind spots vs self-report bias vs narrow framing), so one mechanism cannot serve all three — forcing fork+cross-model everywhere wastes tokens on class 2 and collapses the diversity that is the point of class 3.

## Scope

- **Codify the taxonomy** in `PRINCIPLES.md` as a subsection under §1 ("Structure enforces") refining the "Independent observation" tier — NOT a 6th principle (§5 caps the count). Three classes + the one-question routing rule: *"is the reviewer checking work it (or a peer model) produced?"* yes → review (no-weaker / cross-model), observable → observation (cheap/weaker fine), new candidates → producer (varied/cheaper on purpose). **(drafted in this ticket — see `principles-taxonomy-draft.md`)**
- **Close the missing class-1 gate:** add an independent (cross-model-when-on) review of `spec.md` — the intake analog of `/review-spec`. Reuse the review-ledger verbatim; stamp `<ticket>:phase:intake`. Default-off; cross-model-required when on; features only (never patch/task). Auto-on under YOLO via 2VCSZY's mechanism (the human-as-reviewer guard disappears there).
- **Realign existing surfaces to declared classes:**
  - `tdd-review` — class-1 work but advisory; decide keep-advisory vs. promote to a stamped gate (lean: keep advisory — boundary cadence already covers it; just *label* it class-1 so the inconsistency is intentional, not accidental).
  - `verify` — tag class-2 (machine evidence; cross-model is a category error).
  - `audit` — the one genuine fork in the road: split it. Dead-code / dep-drift half = class-2 (cheap observer); architecture-judgment half = class-1 (fresh different mind). Decide at scenario design.
- Sync any template ↔ `.safeword/hooks` dogfood copies; register new hooks/libs in `schema.ts` + settings if the spec gate ships.

## Out of scope

- The reasoning-skill uplift already owned by epic **B6MZ4Z** (`debug`, `figure-it-out`, `refactor`, `elicit`, `quality-review` provenance) — those are class-1/class-3 mechanics tracked elsewhere; this ticket only *names the classes* and aligns the gate surfaces.
- Cross-model for the scenario-gate review — owned by **7A0B2K**.
- YOLO auto-enable mechanics themselves — owned by **2VCSZY**; this ticket only declares that the spec gate couples to that switch.
- Changing the no-weaker rule's wording in `quality-review` / `review-spec` — already correct; they become reference implementations of class-1.

## Done when

- `PRINCIPLES.md` carries the 3-class taxonomy + one-question routing rule under §1, principle count still 5.
- Every review/observation surface in the skills set maps to exactly one declared class (audit may map to two by explicit split).
- A `spec.md` independent-review gate exists (default-off, cross-model-when-on, features-only) OR a logged decision records why it stays self-review-only.
- Tests cover: spec-gate on/off, cross-model-required-when-on, skip-reason path, patch/task exemption.

## Decision record

- Source analysis: `/figure-it-out` session 2026-06-23 (this branch). Inventory of 8 existing review mechanisms + phase-by-phase gap map produced by two Explore agents.
- Key citations: `ARCHITECTURE.md:555` (self-adversarial review weaker than independent — the correlated-blind-spot ADR), `PRINCIPLES.md:20` (Haiku judge as legitimate cheap observer), `refactor:39` + `figure-it-out:64` (no-weaker rule deliberately excluded from producer fan-out), arch-gate ADR `ARCHITECTURE.md:574-586` (voting panels rejected — "popularity trap" of correlated models).
- Rejected: uniform fork+cross-model for all reviews (wastes tokens on class 2; collapses angle diversity in class 3). Rejected: a 6th PRINCIPLES principle (violates §5's "few principles" — taxonomy is a refinement of §1's observation tier).

## Work Log

- 2026-06-23T05:48:00Z Created from `/figure-it-out` analysis of adversarial-review coverage. Classified feature (multi-artifact: doc + new gate + surface realignment, dependencies on B6MZ4Z/7A0B2K/2VCSZY).
- 2026-06-23T05:48:00Z Drafted the PRINCIPLES.md taxonomy subsection (see `principles-taxonomy-draft.md`) for review before editing the live file.

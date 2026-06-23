---
id: BHK9PW
slug: adversarial-review-class-taxonomy
type: task
phase: implement
status: in_progress
created: 2026-06-23T05:48:00.000Z
last_modified: 2026-06-23T06:06:00.000Z
---

# Unify adversarial review under a 3-class reviewer taxonomy

**Goal:** Take a _consistent_ approach to review across safeword — but consistency in the **taxonomy and the ledger**, not one uniform mechanism. Name the three reviewer classes in one place, make every class-1 (independent-review) gate share one shape, and explicitly tag the class-2/class-3 surfaces so nobody cargo-cults cross-model onto them.

**Why:** A `/figure-it-out` pass (2026-06-23) mapped where adversarial review exists. The system already encodes three different "checks" — independent review of own work (`quality-review`, `review-spec`, arch-gate: fork + no-weaker + cross-model-ideal), independent observation of an observable (`PRINCIPLES.md:20` — Haiku judge / test suite / parser; weaker is fine), and producer fan-out (`refactor:39`, `figure-it-out:64` — varied/cheaper models on purpose; no-weaker rule explicitly does **not** apply). The drift is that this taxonomy lives in three scattered spots, and **class 1 is internally inconsistent**: `spec.md` is class-1 work stuck at Tier-1 self-review, and `tdd-review` is class-1 work that is advisory-only. The threat model differs by class (correlated blind spots vs self-report bias vs narrow framing), so one mechanism cannot serve all three — forcing fork+cross-model everywhere wastes tokens on class 2 and collapses the diversity that is the point of class 3.

## Scope

Re-scoped feature → **task** (2026-06-23, `/figure-it-out`): the intake survey found the spec-review gate already exists (NMSD94's phase-exit gate fires on any phase advance) and the refinements are owned tickets, so the only unowned work is the doc + making it actionable.

- **Codify the taxonomy** in `PRINCIPLES.md` as a subsection under §1 ("Structure enforces") refining the "Independent observation" tier — NOT a 6th principle (§5 caps the count). Three classes + the one-question routing rule: _"is the reviewer checking work it (or a peer model) produced?"_ yes → review (no-weaker / cross-model), observable → observation (cheap/weaker fine), new candidates → producer (varied/cheaper on purpose). **DONE** — applied to `PRINCIPLES.md`; reviewable copy at `principles-taxonomy-draft.md`.
- **`verify` → tag class-2** (independent observation; cross-model is a category error). **DONE** — `skills/verify/SKILL.md` + dogfood copies.
- **`audit` → split** into class-2 (config drift / circular deps / dead code / test-quality patterns — cheap observer) and class-1 (architecture-soundness judgment — fresh, never-weaker, cross-model when stakes warrant). **DONE** — `skills/audit/SKILL.md` + dogfood copies. Documentation/skill guidance only — `/audit` stays invocation-logged, no new stamp/gate.

## Out of scope

- **A standalone spec-review gate** — already implemented by NMSD94's phase-exit gate (fires on intake exit when `reviewGate` is on). Building a parallel one would duplicate the stamp machinery and fork the policy 2VCSZY owns. Dropped.
- The reasoning-skill uplift already owned by epic **B6MZ4Z** (`debug`, `figure-it-out`, `refactor`, `elicit`, `quality-review` provenance).
- Cross-model on phase-exit reviews — owned by **7A0B2K**.
- YOLO auto-enable mechanics — owned by **2VCSZY**.
- `tdd-review` re-labeling — left as-is (advisory self-check); the boundary cadence already covers it and no surface lies about its class. Revisit only if it starts claiming independence.
- Changing the no-weaker wording in `quality-review` / `review-spec` — already correct; they are the reference implementations of class-1.

## Done when

- `PRINCIPLES.md` carries the 3-class taxonomy + one-question routing rule under §1, principle count still 5. ✅
- `verify` declares class-2 and `audit` declares its class-1/class-2 split, in template + both dogfood copies (byte-parity). ✅
- A logged decision records that the spec-review gate is covered by NMSD94 rather than re-built. ✅ (this ticket's Out-of-scope + work log)
- Existing suite still green (no behavior change — doc/skill edits only).

## Decision record

- Source analysis: `/figure-it-out` session 2026-06-23 (this branch). Inventory of 8 existing review mechanisms + phase-by-phase gap map produced by two Explore agents.
- Key citations: `ARCHITECTURE.md:555` (self-adversarial review weaker than independent — the correlated-blind-spot ADR), `PRINCIPLES.md:20` (Haiku judge as legitimate cheap observer), `refactor:39` + `figure-it-out:64` (no-weaker rule deliberately excluded from producer fan-out), arch-gate ADR `ARCHITECTURE.md:574-586` (voting panels rejected — "popularity trap" of correlated models).
- Rejected: uniform fork+cross-model for all reviews (wastes tokens on class 2; collapses angle diversity in class 3). Rejected: a 6th PRINCIPLES principle (violates §5's "few principles" — taxonomy is a refinement of §1's observation tier).

## Work Log

- 2026-06-23T05:48:00Z Created from `/figure-it-out` analysis of adversarial-review coverage. Classified feature (multi-artifact: doc + new gate + surface realignment, dependencies on B6MZ4Z/7A0B2K/2VCSZY).
- 2026-06-23T05:48:00Z Drafted the PRINCIPLES.md taxonomy subsection (see `principles-taxonomy-draft.md`) for review before editing the live file.
- 2026-06-23T06:06:00Z RE-SCOPE via `/figure-it-out` (option A): feature → task. Dropped the redundant spec-gate; kept taxonomy doc + verify class-2 label + audit split. Applied `verify`/`audit` SKILL edits to template + `.claude` + `.agents` (byte-parity verified). Spawning a fresh-context class-1 review of the change before commit (dogfooding the taxonomy).
- 2026-06-23T06:13:00Z CLASS-1 REVIEW (fresh-context, same-model per no-weaker rule — Opus author has no stronger model) found 1 BLOCKING + 2 SHOULD-FIX. BLOCKING: the audit note claimed a class-1 architecture-soundness pass the audit body never performs (all its checks are mechanical/observable) — corrected to "audit = class-2; the class-1 arch-soundness counterpart lives in the Architecture Review Gate + quality-review." SHOULD-FIX: PRINCIPLES routing question mis-routed author-produced tests to class-1 → reworded to lead with observable-fact/judgment/new-candidates; "Independent observation" term collided with the §1 hierarchy tier name → reworded to "Tier-2 verification." Re-ran parity + verify/audit skill tests: 53/53 pass. So the "audit split" the user approved became "audit is class-2, class-1 arch judgment documented to live elsewhere" — accurate to what audit actually does.
- 2026-06-23T05:58:00Z INTAKE SURVEY — scope-shrinking discovery. The phase-exit review gate (NMSD94, `pre-tool-quality.ts:382-401`) fires on **any** phase advance: `detectPhaseAdvance` (`review-ledger.ts:171`) has no phase filter. So when `reviewGate` is on, leaving **intake** already requires an independent fork-review stamp on `<ticket>:phase:intake`. The "missing class-1 spec-review gate" is therefore **already implemented** for the autonomous/reviewGate-on case — a standalone spec gate would be redundant bloat. Genuinely-unowned remainder: (a) cross-model enforcement on phase-exit reviews → already owned by **7A0B2K**; (b) auto-on under YOLO → already owned by **2VCSZY**; (c) the taxonomy doc → DONE; (d) verify class-2 labeling + audit class-1/class-2 split → docs/skill only, the real remaining in-scope work. Conclusion: re-scope from feature → task; drop the new-gate scope line; keep doc + labeling work. Decision surfaced to user.

---
id: Z4Q24Q
slug: model-tier-selection
parent: VKNF1T-platform-uplift-epic
type: feature
phase: intake
status: in_progress
created: 2026-06-10T00:01:03.794Z
last_modified: 2026-06-10T00:01:03.794Z
---

# Model-tier policy: which capability tier to use across safeword tasks

**Goal:** Decide which safeword tasks/skills/sub-agents run on which **capability tier** — _frontier_ (hardest/longest autonomous work), _mid_ (strong general reasoning), _small_ (fast/cheap, judgment-light) — so capability lands where it pays and cost is saved where it doesn't.

**Provider-neutral by design.** Tiers are abstract capability classes, **never specific model names**. Safeword ships to multiple agent providers (Claude Code, Codex, Cursor, …), each with its own models that change release to release — naming a model in shipped guidance or normative policy is brittle and provider-specific. Express tiers; let the harness/provider resolve tier → concrete model at runtime. This ticket carries no model names; if any are ever added as dated, illustrative snapshots, they must never reach a shipped skill.

**Why:** Safeword spawns many sub-agents — Explore file-maps, quality-review, audit, figure-it-out research, dynamic workflows — that all inherit the session model today. Some genuinely need frontier/strong reasoning (design review, option-weighing, adversarial verification); others are mechanical (grep/file-mapping, format checks) and burn capability for no gain and should drop to a smaller tier; the hardest, longest, most autonomous tasks may justify the frontier tier. A deliberate per-task tier policy spends expensive capability only where the task's length and difficulty pay for it.

> Status: **intake** — research/policy.

## Candidate mapping (starter)

Capability order: **frontier ≳ mid > small.** The relative ordering is what matters — each provider maps these classes to its own current models.

- **frontier** — the hardest, longest, most autonomous work where capability dominates cost: deep multi-step design, complex audits, long-running workflows, adversarial verification of subtle issues. Most expensive — reserve for tasks whose length/difficulty pays for it.
- **mid** — the strong, reliable default for reasoning-heavy work: figure-it-out option-weighing, quality-review / audit deep dives, most design decisions.
- **small** — fast, cheap, judgment-light: Explore / file-mapping sub-agents, mechanical refactors, format/lint checks, status synthesis.

## Open questions (converge before spec)

- **Decision axis:** per task-type (frontier-hard vs reasoning vs mechanical), per skill, or per sub-agent call? Lean: per task-type, set at the sub-agent spawn site.
- **Mechanism:** the Agent/Workflow tools take an explicit `model` param — where's the default? A safeword config, per-skill frontmatter, or inline at spawn? Whatever it is, it must express **tiers**, not model ids, and let the harness/provider resolve.
- **Interaction with [dynamic-workflows](../9BDDGP-dynamic-workflows-for-safeword/ticket.md) (9BDDGP):** workflows pick model per agent — this policy _is_ part of that calibration. Coordinate or fold in.
- **Is the frontier tier worth its cost for safeword?** Most capable _and_ most expensive — which tasks are hard/long enough to beat the mid tier by enough to justify it (long autonomous workflows, deep audits)? Default to mid; escalate to frontier only on the genuinely hard/long.
- **Calibration:** how to tell a tier choice is right (quality regression vs token savings)? Spot-check via evals (skill-creator's harness — see C2F601).

## V2 — lean reviewer-model wording (specced 2026-06-20, not yet shipped)

**Problem with V1 (shipped):** the reviewer-spawn guidance is a 3-rung ranked ladder — (1) different model at-or-above tier → (2) fresh-context same model → (3) weaker different model as last resort — plus a frontier/mid/small gloss and a gate-scope caveat. In practice a session runs **one** model, so there's rarely a different (let alone weaker) model to choose; the agent re-derives "tiers" and weighs rung 3 on nearly every review for a near-constant answer. That's bloat and wasted reasoning (the lever per [declarative LLM interfaces](https://arxiv.org/html/2510.04607v1) / [LLM cognitive load](https://arxiv.org/pdf/2601.08653) is **fewer, lower-load choices**).

**Decision (B — principle + default):** make fresh-context the stated default (it's the only always-available action and is never weaker than the author); keep a different model as the _preferred_ option only when one of comparable-or-better capability exists; **delete rung 3 (weaker last resort), the numbered ladder, and the tier taxonomy.** Proposed reviewer-step wording:

> **Review with a fresh, independent reviewer** — one that doesn't share your blind spots. **Prefer a different model of comparable-or-better capability; if you don't have one, run a fresh-context pass on your own model** (the usual path — most setups run a single model). Never review on a _weaker_ model: a fresh context on your own model beats a weaker different one.

**Why this is safe / better:** keeps the independence win (verified earlier: same-model self-review ~64.5% blind-spot rate; verification asymmetry) and the no-downgrade guard, while removing the rungs that rarely apply. "Prefer different" stays **first** so we don't quietly collapse to always-same-model and lose decorrelated-weights independence (the premortem risk).

**Knock-on:** the BDD gate paragraph shrinks the same way, and the cross-skill divergence note mostly disappears (no weaker-rung ⇒ quality-review and the gate say the same thing). Also relieves the deferred gate-enforcement pressure — no tier ranking left to enforce; "different" stays the only mechanical check and "not weaker" holds by construction whenever the fresh-context default is taken.

**Status:** specced only. Applies to quality-review (Loop step 1), bdd/TDD.md, bdd/SKILL.md (3 mirrors each) — own follow-up PR when approved.

## Related

- Parent: [platform-uplift epic](../VKNF1T-platform-uplift-epic/ticket.md).
- [9BDDGP](../9BDDGP-dynamic-workflows-for-safeword/ticket.md) — workflows pick model per agent; this policy feeds it.
- [C2F601](../C2F601-absorb-claude-skills/ticket.md) — skill-creator's eval harness for calibrating tier choices.

## Work Log

- 2026-06-10 Started: created ticket Z4Q24Q.
- 2026-06-10 Established the capability ordering (**frontier ≳ mid > small**) and tier roles: frontier = hardest/longest autonomous work (reserve for where cost pays); mid = strong-reasoning default; small = mechanical/fast. (An initial draft mis-ranked the frontier tier; corrected after checking current capabilities.)
- 2026-06-20 Resolved the **quality-review reviewer tier** (first concrete consumer of this policy). Problem: the skill said spawn the reviewer on a "different model than yours" for independence — but with a strong-tier author, "different" can resolve _downward_ to a smaller, weaker tier, exactly where the subtle/hard-to-verify bugs hide. /figure-it-out finding: independence (different weights) drives bug-catching more than raw capability (verification is easier than generation; same-model self-review ~64.5% blind-spot rate), but the asymmetry collapses on hard bugs, so the reviewer must _also_ be no-weaker. Evidence: Self-Correction Bench (arxiv 2507.02778), verification survey (arxiv 2508.16665), Kamoi et al. TACL 2024.
  - Implemented as an author-agnostic ranked order in quality-review SKILL.md §"Loop" step 1, byte-identical across all 3 mirrors (template + .claude + .agents): (1) a different model at-or-above your tier; (2) else a fresh-context pass on your own model; (3) a weaker different model only as a last resort. "tier" defined inline (capability class — frontier/mid/small); the "No sub-agent available?" sub-bullet reconciled to inherit the same order.
  - Arrived at via 3 dogfood /quality-review passes (the frontier-tier reviewer was unavailable in-env → exercised the wording's own fresh-context same-tier fallback): pass 2 caught a MEDIUM gap (fallback gated on "if already strongest", leaving non-strongest authors with no tiebreaker) plus an inverted causal clause; pass 3 APPROVE with 2 NOTEs applied (define "tier"; reconcile the manual-fallback sub-bullet), density NOTE declined. Loop closed at MAX_PASSES, Critical = None throughout. Commits e704b14 → 7bade09 → a146c79. PR #277.
- 2026-06-20 /figure-it-out: which other sub-agents inherit the "different + no-weaker" rule. The rule has two halves that generalize differently: **different model** (decorrelate the author's blind spots) applies to _review of the author's own work_; the **no-weaker floor** (asymmetry collapses on hard-to-verify bugs) applies wherever that does.
  - **Extended (reviewers):** the BDD cross-model review gates already enforce _different_ via `crossModelReview` but not _no-weaker_ — same gap quality-review had. Added the no-weaker floor as guidance to bdd/TDD.md (architecture-review-gate) and bdd/SKILL.md (scenario-gate / review-spec reviewer), all 3 mirrors. A weaker-only different model routes to a deliberate `skip:` rather than a stamped weaker review.
  - **Excluded (producers/discovery) — and why:** Explore/file-mapping (orchestrator verifies; cheaper is correct — a no-weaker floor negates the ~40–60% cost saving, and re-prompting only erodes it past ~20% correction rate), refactor scout fan-out and figure-it-out research fan-out (the lever is _angle/interpretation_ diversity, not tier — interpretation diversity > model diversity in ensembles; the orchestrator adversarially verifies). self-review is inline by design (no sub-agent) — N/A. Evidence: mindstudio.ai orchestrator-cheaper-subagent; arxiv 2601.04861 (confidence-aware routing); arxiv 2507.21168 (interpretation vs model diversity); EMNLP 2025 consensus-diversity tradeoff.
  - **Deferred (Mechanism open question):** kept this as _guidance_, not gate enforcement. Hardcoding a tier ranking of model ids into the `crossModelReview` stop-hook would rot every model release, risk false-blocking unknown model ids, and bind to one provider's lineup — exactly the brittleness this ticket forbids. File as a separate decision before implementing.
  - **Producer spawn sites made explicit:** added producer-side guidance to refactor §scout fan-out (same fan-out _shape_ as the reviewer passes, but no-weaker floor does **not** apply — orchestrator verifies the merged ledger; coverage diversity is the lever) and figure-it-out §3b (research is inline by default; if fanned out, treat as discovery — angle diversity is the lever, cheaper/varied models fine, no reviewer floor). All 3 mirrors.
  - **Branch review + catch-up:** fresh-context review (frontier reviewer unavailable in-env) caught a MEDIUM — bdd/TDD.md implied the gate enforces no-weaker when the hook only checks _different_ (string inequality; no tier table in code). Fixed: stated the gate enforces **different only**, no-weaker is author discipline; added the "tier" gloss and the cross-skill divergence note. Merged origin/main cleanly (#275 merge-engine hardening + #280 No-bloat row); 695 tests green. PR #277 merged (squash 3f635c8).
- 2026-06-20 **De-modeled this ticket.** Per user: shipped guidance and normative policy name **tiers, never models** — safeword runs across agent providers (Claude Code, Codex, Cursor) whose model lineups differ and change, so a hardcoded model name is brittle and provider-specific. Rewrote Goal / Why / Candidate-mapping / Open-questions to frontier/mid/small and neutralized model names in the log. Shipped skills were already model-agnostic (verified — they say only "capability class — e.g. frontier vs mid vs small"). This reinforces the deferred-mechanism rationale: any future tier↔model resolution must live in provider config the harness owns, not in safeword guidance.
- 2026-06-20 /figure-it-out → **V2 reviewer-model wording specced** (see "V2" section above). User flag: the V1 3-rung ladder makes the agent burn reasoning on rungs (different/weaker model) that rarely exist, since most setups run one model. Decision: collapse to principle + default (prefer different comparable-or-better model; else fresh-context same model; never weaker) — drop the ladder, the frontier/mid/small gloss, and the weaker-last-resort rung. User chose **spec-first** (record the wording; don't edit shipped skills yet) — implementation is a follow-up PR pending approval of the wording.

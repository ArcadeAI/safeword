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

# Model-tier policy: where to use opus / sonnet / fable across safeword tasks

**Goal:** Decide which safeword tasks/skills/sub-agents run on which model tier — fable (frontier: hardest/longest autonomous work), opus (strong general reasoning), sonnet (fast/cheap, judgment-light) — so capability lands where it pays and cost is saved where it doesn't.

**Why:** Safeword spawns many sub-agents — Explore file-maps, quality-review, audit, figure-it-out research, dynamic workflows — that all inherit the session model today. Some genuinely need opus-level reasoning (design review, option-weighing, adversarial verification); others are mechanical (grep/file-mapping, format checks) and burn opus tokens for no gain and should drop to sonnet; and the hardest, longest, most autonomous tasks may justify the frontier model (fable). A deliberate per-task tier policy spends the expensive frontier capability only where the task's length and difficulty pay for it.

> Status: **intake** — research/policy.

## Candidate mapping (starter)

Capability order (verified online, 2026-06-10): **Fable 5 ≳ Opus 4.8 > Sonnet 4.6 > Haiku.** Fable 5 is Anthropic's Mythos-class flagship (released 2026-06-09) — state-of-the-art on coding and analysis, ~10 points over Opus on long-running analytical tasks, and its lead grows the longer/harder the task. The name notwithstanding, it is _not_ a prose model.

- **fable** — the hardest, longest, most autonomous work where capability dominates cost: deep multi-step design, complex audits, long-running workflows, adversarial verification of subtle issues. Most expensive — reserve for tasks whose length/difficulty pays for it. (Cyber/bio/chem requests auto-fall-back to Opus 4.8 via Fable's classifiers — unlikely to touch dev work.)
- **opus** — the strong, reliable default for reasoning-heavy work: figure-it-out option-weighing, quality-review / audit deep dives, most design decisions. Also Fable's safety fallback.
- **sonnet** — fast, cheap, judgment-light: Explore / file-mapping sub-agents, mechanical refactors, format/lint checks, status synthesis.

## Open questions (converge before spec)

- **Decision axis:** per task-type (frontier-hard vs reasoning vs mechanical), per skill, or per sub-agent call? Lean: per task-type, set at the sub-agent spawn site.
- **Mechanism:** the Agent/Workflow tools take an explicit `model` param — where's the default? A safeword config, per-skill frontmatter, or inline at spawn?
- **Interaction with [dynamic-workflows](../9BDDGP-dynamic-workflows-for-safeword/ticket.md) (9BDDGP):** workflows pick model per agent — this policy _is_ part of that calibration. Coordinate or fold in.
- **Is fable worth its cost for safeword?** Most capable _and_ most expensive — which safeword tasks are hard/long enough to beat opus by enough to justify it (long autonomous workflows, deep audits)? Default to opus; escalate to fable only on the genuinely hard/long.
- **Calibration:** how to tell a tier choice is right (quality regression vs token savings)? Spot-check via evals (skill-creator's harness — see C2F601).

## Related

- Parent: [platform-uplift epic](../VKNF1T-platform-uplift-epic/ticket.md).
- [9BDDGP](../9BDDGP-dynamic-workflows-for-safeword/ticket.md) — workflows pick model per agent; this policy feeds it.
- [C2F601](../C2F601-absorb-claude-skills/ticket.md) — skill-creator's eval harness for calibrating tier choices.

## Work Log

- 2026-06-10T00:01:03.794Z Started: Created ticket Z4Q24Q
- 2026-06-10T00:07:00Z Corrected fable's tier (user: verify online). Fable 5 is Anthropic's Mythos-class flagship (released 2026-06-09) — most capable public model, ~10pts over Opus on long analytical tasks; NOT a prose model (the name misled the first draft). Reordered Fable ≳ Opus > Sonnet > Haiku: fable = hardest/longest autonomous work (reserve for where cost pays); opus = strong reasoning default + fable's cyber/bio/chem safety fallback; sonnet = mechanical/fast. Sources: anthropic.com/news/claude-fable-5-mythos-5; the-decoder.com.
- 2026-06-20 Resolved the **quality-review reviewer tier** (first concrete consumer of this policy). Problem: the skill said spawn the reviewer on a "different model than yours" for independence, which with an Opus author resolves _downward_ to Sonnet — weaker than the author exactly on the subtle/hard-to-verify bugs most worth catching. /figure-it-out finding: independence (different weights) drives bug-catching more than raw capability (verification is easier than generation; same-model self-review ~64.5% blind-spot rate), but the asymmetry collapses on hard bugs, so the reviewer must _also_ be no-weaker. Evidence: Self-Correction Bench (arxiv 2507.02778), verification survey (arxiv 2508.16665), Kamoi et al. TACL 2024.
  - Implemented as an author-agnostic ranked order in quality-review SKILL.md §"Loop" step 1, byte-identical across all 3 mirrors (template + .claude + .agents): (1) a different model at-or-above your tier; (2) else a fresh-context pass on your own model; (3) a weaker different model only as a last resort. "tier" defined inline (capability class — frontier/mid/small); the "No sub-agent available?" sub-bullet reconciled to inherit the same order (was unconditional "switch models", which could go weaker).
  - Arrived at via 3 dogfood /quality-review passes (Fable unavailable → used the wording's own fresh-context-Opus fallback): pass 2 caught a MEDIUM gap (original wording gated the fallback on "if already strongest", leaving non-strongest authors with no tiebreaker) plus an inverted causal clause; pass 3 APPROVE with 2 NOTEs applied (define "tier"; reconcile the manual-fallback sub-bullet), density NOTE declined. Loop closed at MAX_PASSES, Critical = None throughout. Commits: e704b14 → 7bade09 → a146c79. PR #277.
- 2026-06-20 /figure-it-out: which other sub-agents inherit the "different + no-weaker" rule. Key distinction — the rule has two halves that generalize differently: **different model** (decorrelate the author's blind spots) applies to _review of the author's own work_; the **no-weaker floor** (asymmetry collapses on hard-to-verify bugs) applies wherever that does.
  - **Extended (reviewers):** the BDD cross-model review gates already enforce _different_ via `crossModelReview` but not _no-weaker_ — same gap quality-review had. Added the no-weaker floor as guidance to bdd/TDD.md (architecture-review-gate `crossModelReview` para + the can't-satisfy → `skip` line) and bdd/SKILL.md (scenario-gate / review-spec reviewer), all 3 mirrors. A weaker-only different model now routes to a deliberate `skip:` rather than a stamped weaker review.
  - **Excluded (producers/discovery) — and why:** Explore/file-mapping (orchestrator verifies; cheaper is correct — a no-weaker floor negates the 40–60% cost saving, and re-prompting only erodes it past ~20% correction rate), refactor scout fan-out and figure-it-out/deep-research fan-out (the lever is _angle/interpretation_ diversity, not model tier — interpretation diversity > model diversity in ensembles; the orchestrator adversarially verifies). self-review is inline by design (no sub-agent) — N/A. Evidence: mindstudio.ai orchestrator-cheaper-subagent; arxiv 2601.04861 (confidence-aware routing); arxiv 2507.21168 (interpretation vs model diversity); EMNLP 2025 consensus-diversity tradeoff.
  - **Deferred (Mechanism open question):** kept this as _guidance_, not gate enforcement. Hardcoding a model-tier ranking into the `crossModelReview` stop-hook (fail-closed on a weaker reviewer) rots every model release and risks false-blocking unknown model IDs — file as a separate decision before implementing.
  - **Producer spawn sites made explicit (user: "include refactor and figure-it-out"):** the exclusion was only in this ticket, leaving those spawn sites with no model guidance — and refactor's scout even cross-referenced "quality-review's reviewer passes," which could mislead a reader into applying the floor. Added producer-side guidance at both: refactor §scout fan-out (same fan-out _shape_ as the reviewer passes, but no-weaker floor does **not** apply — orchestrator verifies the merged ledger; coverage diversity is the lever) and figure-it-out §3b (research is inline by default; if fanned out, treat as discovery — angle diversity is the lever, cheaper/varied models fine, no reviewer floor). All 3 mirrors; 685 tests green.
  - **Branch review (fresh-context Opus; Fable still unavailable) + catch-up to main.** Reviewer verdict REQUEST CHANGES on one MEDIUM: bdd/TDD.md said the reviewer must be "no weaker" then described the gate as comparing the model tag — implying the gate enforces no-weaker, but the hook only checks _different_ (string inequality; no tier table in code). Fixed in TDD.md: stated the gate enforces **different only**, the no-weaker half is author discipline (tracked here), + added a "tier" gloss and a clause noting the cross-skill divergence (TDD routes weaker-only → `skip:`; quality-review permits weaker as advisory last resort, having no fail-closed hook). Deferred the LOW "floor"-label nit (self-descriptive). Merged origin/main (0.52.2: #275 merge-engine hardening + #280 No-bloat row) — clean auto-merge (my Loop edits vs #280's Output-Format row are non-overlapping); 695 tests green incl. #275's new reconcile/fs suites, so the merge-engine change does not affect these templates. Version: branch now on 0.52.2; patch bump for these doc edits is a release-time call.

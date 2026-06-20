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
- 2026-06-20 quality-review reviewer tier resolved (first concrete consumer of this policy). User worry: reviewer model weaker than the code author. /figure-it-out finding: independence (different weights) drives bug-catching more than raw capability — verification is easier than generation (Sonnet competently verifies Opus output), but the asymmetry collapses on hard-to-verify/subtle/security bugs where a below-author reviewer is a real gap, and same-model self-review has a ~64.5% blind-spot rate. Decision (user-picked): keep the skill's "different model than yours" rule, add an explicit floor "and no weaker"; no hardcoded model so the harness resolves it (Opus author → Fable; if already strongest, same-tier different model, else fresh context). Edited quality-review SKILL.md §"Loop: review → fix → re-review" step 1 across all 3 mirrors (template + .claude + .agents). Evidence: Self-Correction Bench (arxiv 2507.02778), verification survey (arxiv 2508.16665), TACL 2024 self-correction.
- 2026-06-20 Dogfood: ran /quality-review on the change itself. Fable reviewer unavailable in env → took the wording's own fallback (fresh-context Opus 4.8 sub-agent). Reviewer returned NEEDS DISCUSSION on a real MEDIUM gap: the fallback was gated on "if you are already on the strongest," leaving a non-strongest author whose only different models are weaker with no tiebreaker between "different" and "no weaker." Fixed by replacing the prose with an author-agnostic ranked order: (1) different model ≥ your tier, (2) else fresh-context on your own model, (3) weaker different model only as last resort — and corrected an inverted causal "so". Re-applied byte-identically across all 3 mirrors; loop stopped (Critical = None, MEDIUM resolved).

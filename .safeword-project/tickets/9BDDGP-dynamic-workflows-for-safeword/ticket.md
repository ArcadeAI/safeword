---
id: 9BDDGP
slug: dynamic-workflows-for-safeword
parent: VKNF1T-platform-uplift-epic
type: feature
phase: intake
status: in_progress
created: 2026-06-06T18:30:46.886Z
last_modified: 2026-06-06T18:30:46.886Z
---

# Dynamic workflows: what Claude's orchestration primitive means for safeword

**Goal:** Investigate Claude's dynamic-workflow primitive (deterministic multi-agent fan-out / pipeline / parallel / adversarial-verify) and decide what it means for safeword — both as an implementation mechanism for our heavier skills and as a strategic positioning question.

**Why:** Safeword's phases — BDD discovery, scenario generation, verify, audit, figure-it-out — run today as single-agent skills plus enforcement hooks. Claude now orchestrates many subagents deterministically: fan-out a review across dimensions, pipeline a verify, loop-until-dry discovery, adversarially verify each finding before trusting it. That could (a) re-implement our heaviest skills with materially more rigor, and (b) reshape where safeword adds value vs. where it should lean on native orchestration. Worth a deliberate look before the two quietly diverge.

> Status: **intake**. Research/strategy spike — produces direction + likely a first proof-of-concept child ticket, not a build yet.

## Two questions — keep them separate

1. **Mechanism — use workflows _inside_ safeword.** Which skills become workflows? Candidates: `audit` (fan-out per dimension → adversarially verify each finding), `verify` (pipeline: tests → build → lint → scenarios), bdd scenario generation (parallel per persona / JTBD), `figure-it-out` + `deep-research` (multi-modal research sweep → verify → synthesize), `quality-review`. The documented patterns (adversarial verify, loop-until-dry, completeness critic) map cleanly onto safeword's correctness goals.
2. **Positioning — what workflows _mean_ strategically.** Does safeword's value (deterministic gates, phase discipline, BDD/TDD enforcement, context anchoring) **complement** native workflows, or does native orchestration **subsume** parts of it? Likely durable edge: the _enforcement / anchoring_ layer the hooks provide — workflows orchestrate, they don't gate.

## Open questions (converge before spec)

- **Cost / calibration.** Workflows spawn many agents (real token cost); safeword's ethos is no-bloat. When does fan-out beat one good agent? Opt-in "deep mode" per heavy skill (like `ultracode`), not default-on?
- **Determinism vs. gates.** Hooks enforce hard gates; workflows are model-driven orchestration. How do they compose — a workflow runs _inside_ a gated phase, or _replaces_ the phase? The gate is the thing we can't lose.
- **Authoring + maintenance.** A workflow script per skill is more surface to test and keep green. Justified only where fan-out materially beats a single agent — name that bar.
- **Where to start.** Lean: `audit` is the best first proof — naturally parallel (independent dimensions), benefits from adversarial verify, already a heavy one-shot. Prove the pattern there before fanning out.

## Related

- [C2F601-absorb-claude-skills](../C2F601-absorb-claude-skills/ticket.md) — split out deliberately; workflows back `deep-research` / `code-review` ultra, which that audit also weighs.
- [263422-audit-deps-vs-dependabot](../263422-audit-deps-vs-dependabot/ticket.md) — `audit` is the lead workflow candidate _and_ the lead trim candidate; coordinate.
- [ZBVGPF-embed-figure-it-out](../ZBVGPF-embed-figure-it-out/ticket.md) — figure-it-out / deep-research could become a research workflow.

## Work Log

- 2026-06-06T18:30:46.886Z Started: Created ticket 9BDDGP

---
id: 9BDDGP
slug: dynamic-workflows-for-safeword
parent: VKNF1T-platform-uplift-epic
type: feature
phase: intake
status: in_progress
created: 2026-06-06T18:30:46.886Z
last_modified: 2026-06-24T04:03:00.000Z
---

# Dynamic workflows: what Claude's orchestration primitive means for safeword

**Goal:** Investigate Claude's dynamic-workflow primitive (deterministic multi-agent fan-out / pipeline / parallel / adversarial-verify) and decide what it means for safeword — both as an implementation mechanism for our heavier skills and as a strategic positioning question.

**Why:** Safeword's phases — BDD discovery, scenario generation, verify, audit, figure-it-out — run today as single-agent skills plus enforcement hooks. Claude now orchestrates many subagents deterministically: fan-out a review across dimensions, pipeline a verify, loop-until-dry discovery, adversarially verify each finding before trusting it. That could (a) re-implement our heaviest skills with materially more rigor, and (b) reshape where safeword adds value vs. where it should lean on native orchestration. Worth a deliberate look before the two quietly diverge.

> Status: **intake**. The primitive is now shipped & documented (see 2026-06-24 log) — so this is a **decision/positioning spike, not an investigation**: produces direction + a first proof-of-concept child ticket, not a build yet.

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
- 2026-06-23 /figure-it-out (cross-agent parity for verifier fan-out, **live docs verified**). **Correction to a stale assumption: all three harnesses now have subagents + parallel fan-out.** Earlier safeword guidance (quality-review SKILL.md: "Codex: subagents never auto-spawn") predates Codex's subagents feature. Current state — Claude Code ([sub-agents](https://code.claude.com/docs/en/sub-agents.md)), Cursor ([hooks](https://cursor.com/docs/hooks): `subagentStart/Stop`, Task tool), Codex ([subagents](https://developers.openai.com/codex/subagents)) — all support subagents with parallel fan-out and per-subagent model selection.
  - **Sole divergences for a fresh-context verifier workflow:** (1) Codex subagents are **user-invoked only** ("Codex only spawns a new agent when you explicitly ask it to") and capped at `agents.max_depth=1` — so an *autonomous* verifier-between-builds loop won't self-fire on Codex; the skill must tell the user to invoke it. (2) Cursor's `preCompact` is observe-only (no post-compaction context re-injection), unlike CC/Codex `PreCompact`+`PostCompact`.
  - **Design contract for this ticket:** verifier fan-out must be **skill-guidance with per-agent degradation** (auto-fire on CC/Cursor; user-invoked on Codex) — **not** a hook-enforced primitive that assumes auto-spawn. Per-subagent model selection (Codex `model`/`model_reasoning_effort`; CC in practice) means the cross-model "different + no-weaker" reviewer rule (Z4Q24Q) is runnable on all three.
  - **Build risk:** docs are ahead of safeword's wired/tested surface — gate any fan-out work on the smoke-tested adapter (codex-live-parity-smoke CXP9LM), not on doc capability. Feeds SKQR0G (Opus-4.8: amplify fresh-context verifiers).
- 2026-06-24 Brought up to speed with current Claude Code orchestration (live docs verified via claude-code-guide). **The "investigate the primitive" half is resolved — dynamic workflows shipped as a first-class feature (v2.1.154+):** `/workflows` CLI, `ultracode` trigger keyword, a JS orchestration script driving 16–1000 subagents (~16 concurrent), resumable within a session, with structured-output schema validation (v2.1.186) and a bundled `deep-research` example ([workflows](https://code.claude.com/docs/en/workflows.md)). The spike is now a **decision**, not an investigation.
  - **Open questions now answerable:** (1) "opt-in deep mode like `ultracode`?" — `ultracode` is literally the native trigger keyword; the opt-in model exists → lean confirmed. (2) The building blocks for the `audit` fan-out → adversarial-verify pattern all ship today: parallel fan-out, per-subagent model, `isolation: worktree`, schema'd verdicts, `SendMessage`-resume ([sub-agents](https://code.claude.com/docs/en/sub-agents.md)). (3) **Nested subagents up to 5 levels (v2.1.172)** removes the "no nesting" constraint the design assumed.
  - **Cross-safeword staleness flagged:** `AGENTS.md` still says subagents "Cannot spawn other subagents (no nesting)" — now false. Separate doc-correctness fix (file under 8R54HV CC-changelog or a patch); not this ticket's scope.
  - **Positioning sharpened:** `deep-research` now ships as a native workflow → overlaps figure-it-out research + C2F601's deep-research absorb decision; native `/workflows` + experimental Agent Teams (v2.1.178) can subsume `audit`'s fan-out. Reinforces the durable edge — safeword's value is the **enforcement/anchoring** layer (gates, phase discipline, context anchoring), which workflows run *within* but don't replace.
  - **Still open:** the no-bloat/cost bar (when fan-out beats one agent), how a workflow composes with hard gates (runs *inside* a gated phase, never replaces it), and authoring/maintenance cost per workflow script. Start candidate unchanged: `audit`.

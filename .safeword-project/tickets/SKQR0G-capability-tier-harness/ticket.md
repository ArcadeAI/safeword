---
id: SKQR0G
slug: capability-tier-harness
parent: VKNF1T-platform-uplift-epic
type: feature
phase: intake
status: in_progress
created: 2026-06-10T22:29:24.002Z
last_modified: 2026-06-10T22:29:24.002Z
---

# Optimize safeword for Fable 5 — capability-tier harness adaptation

**Goal:** Re-weight safeword's harness for frontier models like Fable 5 — amplify fresh-context verification and the no-bloat guardrail, thin the per-turn control injections, and scale harness intensity by model tier/effort — guided by Fable's own prompting guidance.

**Why:** Safeword was tuned to constrain a _weaker_ model (catch loops, gate every turn, re-inject reminders). Fable 5 inverts that: frontier, long-horizon, self-validating, and prone to over-engineering at high effort. Its [prompting guide](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-fable-5) maps almost one-to-one onto safeword's existing strengths — so optimizing means **amplifying those and trimming the per-turn control noise that fights a long-horizon model's coherence and burns frontier-priced tokens**.

> Status: **intake**. From the "optimize safeword for Fable 5" `/figure-it-out` (2026-06-10): **re-weight, don't rebuild.** Likely an **umbrella** — most threads land on existing tickets (below); this ticket holds the through-line + the genuinely new piece (tier/effort-aware harness intensity).

## The mapping (Fable's guide → safeword)

- **"Fresh-context verifier subagents outperform self-critique."** → safeword's independent gates (done-gate, `/verify`, `/audit`) + adversarial-verify subagents. Fable's autonomy does **not** obsolete the gates — its own guide prefers them over a model grading itself. _Amplify._ (→ [ZBVGPF](../ZBVGPF-embed-figure-it-out/ticket.md), [9BDDGP](../9BDDGP-dynamic-workflows-for-safeword/ticket.md))
- **"Don't refactor / add abstractions beyond the task; do the simplest thing."** → high-effort Fable over-engineers; safeword's no-bloat discipline (Clarity→Simplicity→Correctness, anti-patterns table, YAGNI) is the counter-weight. _Make it prominent._
- **"Scope it, ask clarifying questions, execute."** → safeword's Clarify / Propose-and-Converge + `spec`/`scope`/`done_when`. _Keep._
- **"Check your work at an interval as you build."** → RED/GREEN/REFACTOR + the verify phase. _Align the gates to be that interval-check._

## What to trim (fights Fable)

High-frequency per-turn control injections — verbose SAFEWORD.md reinjection, per-turn phase nudges, failure chatter. A long-horizon model loops less and self-corrects, so per-turn micro-control is reinjection fatigue + context bloat that hurts coherence and costs the most-expensive tokens. Let Fable run longer between gates (per-turn → checkpoint gates). (→ [P30CRP](../P30CRP-safeword-md-via-hooks/ticket.md) controls reinjection frequency; QSNKBB brevity.)

## What to add (the genuinely new piece)

**Effort- and tier-aware harness intensity** — run Fable at **high effort** for hard/long tasks (its verification behaviour is best there), reserve it for work that pays (frontier-priced), and scale harness intensity _inversely_ with model capability: light-touch on Fable, more gating on cheaper tiers. (→ couples tightly to [Z4Q24Q](../Z4Q24Q-model-tier-selection/ticket.md).)

## Open questions (converge before spec)

- **Umbrella vs distributed.** Most threads are existing tickets (ZBVGPF, P30CRP, Z4Q24Q). Is this a coordinating umbrella, or does it own concrete work (the tier/effort-intensity layer)? Lean: umbrella + owns the new intensity-scaling piece.
- **How does safeword detect the tier/effort** to adapt? The model id (`claude-fable-5`, `[1m]`, effort suffix) is visible to the harness — where, and can hooks read it?
- **The per-turn cuts need measurement, not a guess.** Which injections actually drag Fable (token cost vs value)? An eval/measurement pass (skill-creator harness, C2F601) before cutting.

## Related

- Parent: [platform-uplift epic](../VKNF1T-platform-uplift-epic/ticket.md).
- [Z4Q24Q](../Z4Q24Q-model-tier-selection/ticket.md) (model tiers — Fable at high effort), [P30CRP](../P30CRP-safeword-md-via-hooks/ticket.md) (reinjection frequency), [ZBVGPF](../ZBVGPF-embed-figure-it-out/ticket.md) + [9BDDGP](../9BDDGP-dynamic-workflows-for-safeword/ticket.md) (fresh-context verification), `prompt-brevity-cut` QSNKBB (per-turn brevity).

## Work Log

- 2026-06-10T22:29:24.002Z Started: Created ticket SKQR0G.
- 2026-06-10T22:31:00Z Framed from the Fable-5 /figure-it-out (researched the Fable prompting guide). Decision: re-weight, don't rebuild — Fable's guidance (fresh-context verifiers > self-critique; don't over-engineer; scope-clarify-execute; interval self-checks) maps onto safeword's strengths, so amplify verification + no-bloat, trim per-turn control, add tier/effort-aware intensity. Most threads land on existing tickets (ZBVGPF/P30CRP/Z4Q24Q); this is the umbrella + owns the new intensity-scaling layer. Flagged: the per-turn cuts need a measurement pass, not a guess. Parented under VKNF1T.

## Work Log

- 2026-06-10T22:29:24.002Z Started: Created ticket SKQR0G

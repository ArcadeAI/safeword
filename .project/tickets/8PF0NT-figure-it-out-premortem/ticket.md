---
id: 8PF0NT
slug: figure-it-out-premortem
type: task
phase: intake
status: in_progress
parent: B6MZ4Z
created: 2026-06-19T14:17:47.515Z
last_modified: 2026-06-19T14:18:30Z
---

# Figure-it-out skill: premortem the chosen option

**Goal:** Add a one-line premortem on the _winning_ option to Phase 4, so the skill disconfirms its choice — not only the alternatives it steelmans.

**Why:** `figure-it-out` already does devil's-advocacy (steelman the rejected option first), evidence-gating, and diverse options. The one gap the research flags: it never disconfirms the _winner_. Premortem ("assume X failed in 6 months — what was the cause?") reduces optimism bias and is complementary to devil's advocacy ([meta-analysis](https://www.sciencedirect.com/science/article/abs/pii/074959789090051A)). Task-level: ~2 lines, no new machinery.

**Parent:** [B6MZ4Z — reasoning-skills uplift](../B6MZ4Z-review-refactor-uplift-epic/ticket.md)

## The change

In Phase 4, before the required `**Next:**` line: after committing to X, run a one-line premortem — _"Assume X failed in 6 months. What was the most likely cause? If that cause is plausible, reconsider or mitigate now."_ Keep it to a sentence; it must not balloon Phase 4.

## Done when

- Phase 4 prescribes a premortem on the chosen option, positioned before `**Next:**`.
- The existing steelman-first / Correct-Elegant-Cost structure is unchanged.
- SKILL.md edit has Codex (`.agents/skills/`) + Cursor (`.mdc`) parity copies synced.

## Work Log

- 2026-06-19 Created task under B6MZ4Z from `/figure-it-out` (debug/figure-it-out/brainstorm pass).

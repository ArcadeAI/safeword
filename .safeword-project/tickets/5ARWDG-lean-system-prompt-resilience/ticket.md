---
id: 5ARWDG
slug: lean-system-prompt-resilience
type: task
phase: intake
status: in_progress
epic: cc-changelog-alignment
relates_to: 8R54HV
created: 2026-05-31T21:05:09.536Z
last_modified: 2026-05-31T21:05:09.536Z
---

# Verify per-turn reminders land under lean system prompt default

**Goal:** Confirm safeword's per-turn behavioral anchors still reliably steer the agent now that CC defaults to a lean system prompt on Opus 4.8.

**Why:** Safeword leans on always-present context (SAFEWORD.md/CLAUDE.md + a per-turn reminder) to keep the agent in the workflow. A leaner baseline could dilute that steering, especially in long sessions.

## Finding (CC 2.1.154)

> Lean system prompt now default (except Haiku, Sonnet, Opus 4.7 and earlier)

Opus 4.8 sessions get less baseline scaffolding. Project instructions (`CLAUDE.md`, `SAFEWORD.md`) still load, but the surrounding system framing is thinner.

## Evidence in safeword

- `.safeword/hooks/prompt-questions.ts:36` injects a single compressed anchor each turn: "Contribute before asking. Embed open questions in your contribution." plus a phase-aware status line.
- This is intentionally one line ("the full methodology lives in SAFEWORD.md"). Under a lean prompt the one-liner may be carrying more weight than before.

## Investigation steps (spike)

1. Confirm whether the lean prompt affects how project `CLAUDE.md`/`SAFEWORD.md` are surfaced, or only Anthropic's own framing (per current CC docs).
2. Dogfood an Opus 4.8 session and observe whether phase/propose-and-converge discipline holds without extra nudging.
3. If steering weakens: decide whether the per-turn reminder needs to carry more (e.g., re-include the current phase's exit criterion) — weigh against context cost and existing brevity rules (ticket QSNKBB).

## Done when

- A clear read on whether lean-prompt default measurably weakens safeword steering on Opus 4.8.
- Either "no change needed" with evidence, or a scoped follow-up to strengthen the per-turn anchor.

## Out of scope

- Rewriting SAFEWORD.md methodology; this is a verification spike, not a redesign.

## Work Log

- 2026-05-31T21:05:09.536Z Started: Created ticket 5ARWDG
- 2026-05-31 Noted single-line per-turn anchor in prompt-questions.ts:36 as the main at-risk steering surface.

---
id: '101'
title: Apply propose-and-converge to Safeword hooks
type: feature
phase: done
status: done
created: 2026-04-11
last_modified: 2026-04-15T04:22:00Z
related: '100'
---

## Goal

Safeword's own hooks violate the propose-and-converge principles codified in ticket #100. Two hooks need rework to align with the research.

## Problem

### prompt-questions.ts (UserPromptSubmit)

Currently injects: "Classify patch/task/feature and announce before starting. Research options, then ask 1-5 targeted questions about scope and constraints."

This is the front-loading anti-pattern — it tells Claude to interrogate before contributing. It's exactly what customer Guru complained about (2026-04-10).

**Options explored:**

| Option                  | Instruction                                                                                                                           | Tradeoff                                                  |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| A. Minimal              | "Classify patch/task/feature and announce." (drop questioning)                                                                        | Least friction, no guarantee of contribute-first behavior |
| B. Propose-and-converge | "Classify and announce. Contribute a perspective or sketch before asking questions. Surface open decisions inside your contribution." | Encodes the principle directly                            |
| C. Remove hook entirely | Let SAFEWORD.md handle it                                                                                                             | Least context rot, but doesn't survive compaction         |

**Leaning:** Option B — hook's value is re-injection on every turn (survives compaction), but it should encode the right principle.

### stop-quality.ts (Stop)

Currently injects generic: "Double check and critique your work again just in case. Assume you've never seen it before..."

**Problems identified:**

1. Fires on every stop after edits — even one-line typo fixes trigger full review
2. "Assume you've never seen it before" asks for performative re-reading, may flip correct judgments
3. Doubles latency on every response
4. But it DOES catch real issues — the principle isn't wrong, the frequency and specificity are

**Options explored:**

| Option                   | When/What                                                   | Tradeoff                                   |
| ------------------------ | ----------------------------------------------------------- | ------------------------------------------ |
| A. Phase-boundary only   | Only on phase transitions                                   | Less friction, misses mid-phase issues     |
| B. LOC-gated             | After 400+ LOC changes                                      | Aligns with code review research           |
| C. First-stop only       | Once per session                                            | Catches first deliverable, avoids fatigue  |
| D. Tighten the prompt    | Phase-specific (already partial), fix generic fallback      | Already half-done                          |
| E. Contribute-then-probe | "State the one thing most likely to be wrong and verify it" | Targeted investigation > vague self-review |

**Leaning:** Combine D+E — phase-aware messages are already good, fix the generic "implement" fallback to be specific rather than open-ended.

**Design option to explore:** Claude Code Review (multi-agent PR review, 84% bug detection on large PRs) could replace or supplement the stop hook's self-review. Instead of the agent checking its own work (unreliable — Huang et al. 2023), a separate review agent evaluates the output. This shifts quality review from self-review to adversarial review. Explore whether Claude Code Review can be invoked from a stop hook or integrated into the done gate.

## Research backing

See `.safeword-project/learnings/propose-and-converge-research.md` for full research citations.

Key findings:

- Self-review works for surface issues but unreliable for deep logical errors (Huang et al., 2023)
- Blanket "always check" instructions suffer from attention dilution as context grows
- Specific post-hoc review prompts outperform vague front-loaded ones
- Review most effective at phase boundaries, not every response (~400 LOC threshold from Microsoft/SmartBear)
- Hook stdout competes with working memory — every character of injection is a character unavailable for code context

## Scope

- Rewrite prompt-questions.ts injection text
- Rewrite stop-quality.ts generic/implement phase message
- Evaluate frequency of stop hook firing

## Out of Scope

- Changing hard gates (done phase evidence, cumulative artifacts)
- Restructuring hook architecture
- Other hooks (lint, bypass-warn, config-guard)

## Already done (by parallel session, committed in feat/109-enforcement-redesign branch)

**Stop hook implement phase rewritten.** "Double check and critique your work. Assume you've never seen it before." → "Review your work critically. Is it correct? Could this be simplified? Does it follow latest docs and research? If unsure, say so — don't guess. Report findings only. No preamble."

This partially implements Option D+E from this ticket. Remaining: frequency reduction (phase-boundary only vs every stop) and Claude Code Review integration.

## Work Log

- 2026-04-11T03:43Z Created: Captured debate from ticket #100 conversation
- 2026-04-12T00:27Z Note: Parallel session already rewrote stop hook implement-phase prompt (quality.ts). Partial overlap with this ticket.

---
id: 050
slug: haiku-judge-stop-hook
type: task
status: wontfix
phase: done
---

# Haiku as independent judge for stop hook soft block

**Goal:** Replace the soft block's self-review prompt with a Haiku API call that independently judges Claude's response for rationalization patterns and quality gaps.

## Why

The current soft block asks Claude to review its own work — intrinsic self-review bounded by sycophancy. A separate model has no stake in the response being good and no accumulated conversation context.

## Research Findings (from 049f exploration)

- `last_assistant_message` is a documented stop hook input field — no transcript parsing needed
- All Claude Code hook types are `type: command` shell scripts (type: prompt / type: agent are not real)
- Correct approach: direct Anthropic API call (`fetch()` + `ANTHROPIC_API_KEY`) from existing stop hook
- Model: `claude-haiku-4-5-20251001` — fast, cheap ($1/M input tokens), confirmed correct ID
- `ANTHROPIC_API_KEY` is available in hook environment

## Design

Call `claude-haiku-4-5-20251001` from `stop-quality.ts` with `input.last_assistant_message`. Judge against specific criteria. Block with Haiku's specific reason if issues found; allow if OK. `stop_hook_active` bypass still applies (one round max).

**Key open question:** Judge prompt design. The criteria must be concrete, not vague:

- Rationalization phrases ("I'll handle this later", "out of scope", "would require...")
- Deflection (response doesn't address what was asked)
- Evidence claimed but not shown

Fallback: if `ANTHROPIC_API_KEY` is unset, skip Haiku and fall back to current soft block.

## Pre-req simplification

`last_assistant_message` in hook input makes transcript scanning for `combinedText` redundant. Clean that up first (separate commit) before wiring Haiku.

## Work Log

- 2026-03-22 Created from 049f (cancelled as child of 049). Research complete, design clear.

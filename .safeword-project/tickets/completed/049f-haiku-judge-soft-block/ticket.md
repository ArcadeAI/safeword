---
id: 049f
slug: haiku-judge-soft-block
type: task
status: cancelled
phase: intake
parent: 049-stop-hook-quality-improvements
---

# Haiku as judge for soft block quality review

**Goal:** Replace the soft block's self-review prompt with an independent evaluator model (claude-haiku-4-5) that judges Claude's response for rationalization patterns and quality gaps before allowing it to stop.

## Why

The current soft block asks Claude to review its own work — this is intrinsic self-review, which is bounded by sycophancy. Research (Trail of Bits pattern, community practice) shows that using a separate fast model as judge avoids the sycophancy problem and provides more reliable quality enforcement. The evaluator model has no stake in the response being good — it just assesses it.

## What

**Approach:** Convert the stop hook's soft block from a `decision: block` with a quality review prompt into an `type: agent` hook (or a `type: prompt` hook) that:

1. Receives the last assistant message via `last_assistant_message`
2. Evaluates it against quality criteria:
   - Did Claude rationalize ("this is out of scope", "I'll do this later")?
   - Are there obvious correctness issues?
   - Did Claude avoid addressing an earlier question?
3. Returns `{ decision: 'block', reason }` only if issues are found
4. Returns `{ decision: 'allow' }` if the response is substantive

## Options

**Option A — `type: prompt` hook (simpler, but not truly independent)**
Use Claude Code's built-in prompt hook type. Claude Code invokes Claude itself with the prompt — this is still Claude judging Claude, just in a fresh context with no conversation history. Avoids sycophancy from accumulated context but does not use a different model. Lowest friction to implement.

**Option B — `type: agent` hook (more powerful)**
Spawn a subagent with tools (Read, Grep, Glob) that can read files to verify claims in Claude's response before deciding. More latency, more powerful.

**Option C — Shell hook calling Anthropic API directly (true independent judge)**
Call the Haiku API (`claude-haiku-4-5-20251001`) from the hook script with the last message as input. Genuinely different model, genuinely independent evaluation. Full control over prompt. Requires `ANTHROPIC_API_KEY` in environment — already available in Claude Code sessions.

Option A is likely the right starting point — uses built-in Claude Code infrastructure, lowest complexity.

## Open Questions

- What specific rationalization patterns should the judge check for?
- What quality criteria are universal vs. phase-specific?
- How does the prompt hook receive `last_assistant_message`? Does `$ARGUMENTS` contain it?
- Should the judge run on every edit, or only at specific phases?

## Dependencies

- Understand `type: prompt` hook input format before implementing
- Define the evaluation prompt carefully — vague prompts produce vague verdicts

## Work Log

- 2026-03-21 Ticket created as child of 049. Trail of Bits uses Haiku-as-judge in production (community-documented).
- 2026-03-22 Cancelled. Moved to standalone ticket 050-haiku-judge-stop-hook.

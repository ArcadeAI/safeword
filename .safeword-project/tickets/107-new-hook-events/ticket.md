---
id: '107'
title: Evaluate new Claude Code hook events for Safeword
type: task
phase: intake
created: 2026-04-11
related: '101'
---

## Goal

Claude Code now has 26 hook events across 4 handler types. Safeword uses a subset. Evaluate whether newer events (TaskCreated/TaskCompleted, PreCompact/PostCompact, SubagentStart/SubagentStop, prompt/agent handler types) could simplify or improve existing hook logic — particularly the stop hook's ticket-tracking and the quality state management.

## Specific events to evaluate

- **TaskCreated / TaskCompleted** — Could replace stop hook's ticket lifecycle tracking
- **PreCompact / PostCompact** — Could re-inject critical context before compaction instead of relying on session-compact-context.ts
- **SubagentStart / SubagentStop** — Could enforce quality gates on spawned subagents
- **prompt handler type** — Lightweight LLM evaluation for judgment calls (sizing, quality checks) without spawning a full agent
- **agent handler type** — Full subagent with tools for complex gate checks

## High-priority use case: Sizing validation via prompt-type Stop hook

A `prompt`-type Stop hook could validate the agent's sizing assessment independently. After the agent proposes, the Stop hook evaluates: "Does this proposal describe 3+ components or new state? If yes and the agent didn't propose scenarios, nudge."

Key insight: this CAN'T be a UserPromptSubmit hook — sizing needs the agent's proposal as input, which doesn't exist until after the agent responds. A Stop hook fires after the response and can evaluate it.

A Haiku-based prompt hook is cheap, fast, and independent from the main agent — avoids the fox-henhouse problem where the agent evaluates its own sizing.

## Origin

Identified during quality review of ticket #100 (2026-04-11). Current hook architecture predates several of these events.

## Work Log

- 2026-04-16T16:04:00Z Cross-ref: Ticket #126 evaluated PostToolUse additionalContext vs two-hook flag-and-clear for one-shot reminders. Existing events (PostToolUse + UserPromptSubmit) are sufficient — no new events needed for this pattern. Data point for evaluation: newer events may help elsewhere but aren't required for reminder-tier enforcement.
- 2026-04-11T15:42Z Created: Flagged during quality review

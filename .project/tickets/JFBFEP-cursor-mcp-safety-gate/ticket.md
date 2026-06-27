---
id: JFBFEP
slug: cursor-mcp-safety-gate
type: task
phase: intake
status: in_progress
epic: cursor-optimization
relates_to: VAX3Z2
created: 2026-06-25T01:15:28.347Z
last_modified: 2026-06-25T01:15:28.347Z
---

# Add an action-based MCP safety gate for Cursor

**Goal:** Add a Cursor `beforeMCPExecution` safety gate that keeps MCP first-class while blocking only risky actions.

**Why:** Arcade is MCP-heavy, and popular servers like Slack, Linear, and GitHub should stay useful without letting Auto-review silently run side-effecting tool calls.

## Decision

Use an action-based policy, not a blanket MCP block:

- Allow read-only MCP calls by default.
- Ask before side effects, like posting to Slack, updating Linear, or mutating GitHub.
- Deny clearly dangerous or administrative actions unless the project explicitly opts in.

This split keeps `TDX8NT` focused on verifying the shell gate that already exists. This ticket owns the MCP policy and the implementation of a new `beforeMCPExecution` gate.

## Done when

- Cursor wires a `beforeMCPExecution` hook for MCP tools that can return `allow`, `ask`, or `deny`.
- The default policy treats Slack, Linear, and GitHub as normal MCP servers: reads allowed, writes ask, dangerous/admin actions denied.
- The policy is project-configurable without making MCP feel blocked by default.
- Tests prove the gate blocks or asks before side-effecting MCP tool calls, including under Auto-review.

## Source

- Cursor MCP docs: MCP tools follow the same Run Modes as terminal commands; Auto-review routes allowlisted MCP tools immediately and sends the rest to the classifier.
- Cursor hooks docs: `beforeMCPExecution` can return `allow`, `deny`, or `ask`; hook failures fail open unless `failClosed:true`.
- Cursor plugin docs: plugins can bundle MCP servers and hooks, so MCP safety matters for plugin packaging too.

## Work Log

- 2026-06-25T01:15:28.347Z Started: Created ticket JFBFEP
- 2026-06-24 Decision from `/figure-it-out`: keep TDX8NT as Shell-only verification
  and split MCP into this ticket because safeword does not currently wire a
  `beforeMCPExecution` gate. Picked an action-based policy so MCP remains a
  first-class Arcade workflow instead of being globally blocked.

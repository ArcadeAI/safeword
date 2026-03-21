---
id: 049c
slug: scope-evidence-to-bash-output
type: task
status: pending
phase: implement
parent: 049-stop-hook-quality-improvements
---

# Scope done-phase evidence matching to Bash tool output

**Goal:** Change done-phase evidence detection in `stop-quality.ts` to match patterns only within actual Bash tool result blocks in the transcript, rather than anywhere in Claude's last message text.

## Why

**Goodhart's Law:** The current approach matches `✓ X/X tests pass`, `All N scenarios marked complete`, and `Audit passed` anywhere in Claude's response text — including prose Claude writes without running the tools. Claude could satisfy the gate without running `/verify` or `/audit`. Scoping to Bash tool output shifts from trusting Claude's prose to trusting actual tool execution results.

**Trust model:** This converts the gate from intrinsic (Claude produces the evidence string) to external (tool output contains the evidence string). Research confirms external feedback loops are the empirically supported approach.

## What to Change

`packages/cli/templates/hooks/stop-quality.ts` (+ working copy):

**Current:** `combinedText` is the text content of the last assistant message.

**Target:** Parse the transcript JSONL for `tool_result` blocks where the preceding `tool_use` had name `"Bash"`. Extract text content from those blocks only. Run evidence patterns against that content.

### Implementation sketch

```ts
// Pair tool_use + tool_result in JSONL, collect Bash results
function extractBashToolOutput(lines: string[]): string {
  // Walk lines, track last tool_use name, collect tool_result text when name === 'Bash'
}
```

The JSONL structure pairs a `tool_use` content item (with `name: "Bash"`) and its corresponding `tool_result`. Need to handle the JSONL format correctly — tool calls and results appear in separate message objects.

## Open Questions

- Does `last_assistant_message` contain tool_use blocks? Docs confirm: text content only. So transcript parsing is still required for this.
- Should we fall back to full text if no Bash output is found? (e.g. Claude ran tests via a different tool)

## Work Log

- 2026-03-21 Ticket created as child of 049. Research confirms transcript parsing is required (last_assistant_message is text-only).

# Hierarchy Navigation on Ticket Completion

**Status:** Accepted
**Date:** 2026-02-21

**What.** After the done gate passes, the Stop hook marks the current ticket done and finds the next unfinished ticket in the tree.

**Why.** Eliminates manual "what's next?" lookup; agent automatically continues with adjacent work without user prompt

**Trade-off.** The hook writes ticket status before calling `findNextWork`. Otherwise it can select the ticket it just finished.

**Alternatives.** Manual navigation (rejected: interrupts flow), separate navigation command (rejected: requires user prompt)

**Implementation.** `.safeword/hooks/lib/hierarchy.ts` - pure functions `findNextWork`, `updateTicketStatus`, `resolveTicketDirectory`; called from `stop-quality.ts` after done gate passes

**Navigation algorithm:**

1. Mark current ticket `status: done, phase: done`
2. Read parent's `children` array
3. Find first child where `status !== done` → `navigate` to that ticket
4. If all children done → `cascade-done`: mark parent done, recurse from parent
5. If no parent or tree exhausted → `all-done`: allow stop

**Zero-dependency YAML parser:** `hierarchy.ts` uses an inline `parseFrontmatter()` rather than the `yaml` npm package. Hooks run in user projects where `yaml` is not installed. The inline parser needs no runtime dependency.

The [terminal handoff contract](terminal-handoff.md) governs how the host presents the next action.

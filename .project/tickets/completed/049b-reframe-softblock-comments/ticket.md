---
id: 049b
slug: reframe-softblock-comments
type: patch
status: done
phase: implement
parent: 049-stop-hook-quality-improvements
---

# Reframe soft block comments as "quality prompt" not "gate"

**Goal:** Update comments in `stop-quality.ts` so the soft block is accurately described as a quality review prompt (not a gate), reflecting that its purpose is to leverage Claude's judgment on things external tools cannot check.

## Why

The current comments say "soft block" which implies enforcement parity with the "hard block." Research clarified the distinction: the soft block is intentionally a one-shot prompt to apply judgment on elegance, abstraction quality, edge cases, and best practices — not a verifiable gate. Accurate comments prevent future contributors from "fixing" the escape hatch thinking it's a bug.

## What to Change

`packages/cli/templates/hooks/stop-quality.ts` (+ working copy `.safeword/hooks/stop-quality.ts`):

- Rename `softBlock` function to something clearer, or update its JSDoc
- Update the decision logic comment block
- Clarify the `stopHookActive` guard comment: it's loop prevention, not a weakness

## Work Log

- 2026-03-21 Ticket created as child of 049.
- 2026-03-21 Done: updated hardBlockDone JSDoc (no bypass), softBlock JSDoc (bypassable, one-shot), decision logic comment block (distinguishes gate vs prompt), stopHookActive guard comment (loop prevention + intentional design note). Both template and working copy updated.

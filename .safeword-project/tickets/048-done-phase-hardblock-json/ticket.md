---
id: '048'
slug: done-phase-hardblock-json
type: patch
status: in_progress
phase: implement
---

# Switch done-phase hard block from exit(2) to JSON decision:block

**Goal:** Replace `hardBlockDone`'s `console.error + process.exit(2)` with the canonical `{ decision: 'block', reason } + process.exit(0)` pattern in `stop-quality.ts`.

## Why

- Exit 2 is not the canonical Claude Code blocking path — `decision: block` + exit 0 is
- Exit 2 had a past reliability regression (Issue #3656)
- Exit 2 fails silently when hooks are installed via plugin system (Issue #10412)
- When exit 2 is used, stdout JSON is ignored — limits future extensibility (e.g. `suppressOutput`)
- The "hardness" of done-phase enforcement comes from the evidence-pattern logic, not the exit code
- Both mechanisms surface `reason` to Claude in the same way

## What to Change

**File:** `packages/cli/templates/hooks/stop-quality.ts` (template) + `.safeword/hooks/stop-quality.ts` (working copy)

**Current:**

```ts
function hardBlockDone(reason: string): never {
  console.error(reason);
  process.exit(2);
}
```

**Target:**

```ts
function hardBlockDone(reason: string): never {
  console.log(JSON.stringify({ decision: 'block', reason }));
  process.exit(0);
}
```

After this change, `hardBlockDone` and `softBlock` use the same mechanism — the distinction is purely in the content of `reason` (evidence requirements vs. quality review prompt). Consider consolidating into one function.

## Work Log

- 2026-03-21 Ticket created. Research: all 10 hook mechanics claims confirmed by docs. Exit 2 → JSON block is canonical per docs and community practice.

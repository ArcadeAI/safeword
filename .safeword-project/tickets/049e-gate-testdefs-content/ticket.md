---
id: 049e
slug: gate-testdefs-content
type: task
status: done
phase: done
parent: 049-stop-hook-quality-improvements
---

# Gate on test-definitions.md content, not just presence

**Goal:** Strengthen the cumulative artifact check so that `test-definitions.md` must contain at least one real scenario, not just exist as an empty or stub file.

## Why

The current check (`existsSync(testDefsPath)`) is satisfied by an empty file or a file with placeholder content. A feature can reach decomposition or implement phase with a `test-definitions.md` that has no real scenarios.

## What to Change

`packages/cli/templates/hooks/stop-quality.ts` (+ working copy), `checkCumulativeArtifacts()`:

**Current:** checks `existsSync(testDefsPath)`

**Target:** after existence check, read the file and count scenario lines:

- Count lines matching `- [` (checkbox pattern) — any `[ ]` or `[x]`
- If count is 0 → block: "test-definitions.md exists but contains no scenarios"
- Minimum threshold: 1 scenario (could make configurable later, but start simple)

### Implementation sketch

```ts
const content = readFileSync(testDefsPath, 'utf8');
const scenarioCount = (content.match(/^\s*- \[/gm) ?? []).length;
if (scenarioCount === 0) {
  return `Feature at ${ticketInfo.phase} phase: test-definitions.md has no scenarios defined.`;
}
```

## Additional Scope (from 049b review)

The cumulative artifact check currently uses `softBlock`, which means the `stop_hook_active`
bypass lets Claude skip the gate on its second stop attempt. Consider whether the artifact
check should use `hardBlockDone` instead — making it a true gate with no bypass. Trade-off:
no escape hatch if the requirement is wrong. Decide before implementing.

## Work Log

- 2026-03-21 Ticket created as child of 049.
- 2026-03-21 Noted: artifact check uses softBlock (bypassable), not hardBlockDone. Consider switching to hard block as part of this ticket.
- 2026-03-21 Implemented: content check added, switched to hardBlockDone (no bypass). Both working copy and template updated.

---
id: ANAXG4
slug: cursor-failclosed-gating-hooks
type: task
phase: intake
status: in_progress
epic: cursor-changelog-alignment
relates_to: VAX3Z2
---

# Set failClosed:true on Cursor gating hooks (default is fail-open)

**Goal:** Mark safeword's security/gating Cursor hooks `failClosed: true` so a crashed/timed-out/invalid-JSON hook denies rather than silently letting the action through.

**Why:** Cursor hooks default to **fail-open**. A safeword gating hook that throws currently fails *open* — the gate vanishes with no signal.

## Done when

- All blocking gate hooks (`beforeSubmitPrompt`, `preToolUse`, `beforeShellExecution`) carry `failClosed: true` in `.cursor/hooks.json` + generator.
- Observational hooks intentionally left fail-open (a crashing lint hook shouldn't block work) — decision recorded per hook.

## Source

cursor.com/docs/hooks (`failClosed`, default fail-open)

## Work Log

- 2026-05-31 Created from Cursor research.

---
id: VZCADV
slug: managed-block-replacement
type: task
phase: intake
status: backlog
created: 2026-06-19T19:38:40.751Z
last_modified: 2026-06-19T19:38:40.751Z
---

# General managed-block replacement in executeTextPatch (clean textPatch upgrades)

**Goal:** Give `executeTextPatch` an opt-in way to replace a superseded managed block on upgrade — locate the old block by its stable header substring, cut it (header → next blank line), then append the current block — so a structural change to a managed block doesn't leave a stale second block in the customer's file.

**Why:** Surfaced by the EYRK34 quality-review. When a managed `.prettierignore` block changes structure, safeword bumps the marker so existing installs re-apply — but `executeTextPatch` only appends (it never strips the old block; `unpatchContent` runs only on reset). Result: a harmless-but-noisy **double-block** on upgrade. This currently matches the codebase's established append-with-new-marker pattern (the transient-paths block, `schema.ts:887`), so it's deferred — a general opt-in replacement would clean it up for all textPatches and keep future migrations tidy.

## Scope

- Add an opt-in field on `TextPatchDefinition` (e.g. `supersedesHeader: string`) that makes `executeTextPatch`, **when the current marker is absent**, find a prior safeword block by that stable header substring and remove it (header → next blank line) before appending the new block.
- Opt-in only: the other textPatches (codex config, gitignore, transient-paths) keep their current append/marker semantics — no behavior change unless a patch sets the field.
- Apply it to the `.prettierignore` patch (collapses the EYRK34 double-block to one block on upgrade).
- Robust to historical block variants: strip by header→blank-line boundary, not exact prior content (the managed list grew across versions, so exact-content matching would miss older forms).

## Out of scope

- The marker/idempotency model for patches that don't opt in.
- EYRK34's functional behavior (shipped + green) — this is cosmetic cleanup of the upgrade artifact only.

## Done when

- A `.prettierignore` already holding a legacy safeword block, after upgrade, contains exactly ONE safeword managed block (the current owned-dirs one) — legacy block stripped, customer lines preserved, idempotent on re-run.
- Opt-out patches (codex/gitignore) are byte-unchanged by the new mechanism (regression test).
- Full suite + lint green; hook template mirror synced if touched.

## Origin

EYRK34 quality-review (2026-06-19), suggested-improvement #1. Revalidation found the reviewer's "add to `unpatchContent`" fix doesn't work — `executeTextPatch` never reads `unpatchContent` on apply ([reconcile.ts:914](../../../packages/cli/src/reconcile.ts)) — so the real fix is this opt-in `executeTextPatch` change. Deferred from the closing epic [2H2XKH](../2H2XKH-formatter-coexistence/ticket.md) because it's shared infra with its own test matrix.

## Work Log

- 2026-06-19T19:38:40.751Z Created (backlog): tracks the EYRK34 double-block cleanup as opt-in textPatch infra.

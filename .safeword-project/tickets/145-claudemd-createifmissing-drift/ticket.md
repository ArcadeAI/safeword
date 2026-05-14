---
id: 145
type: task
phase: done
status: done
created: 2026-05-14T15:30:00Z
last_modified: 2026-05-14T16:50:00Z
---

# Schema `createIfMissing: false` is silently ignored by executor

**Goal:** Make `executeTextPatch` honor the `createIfMissing: false` flag on `TextPatchDefinition`, or remove the flag and update the schema comment to match actual behavior. Pick whichever direction reflects the intended product behavior.

## Why

While writing the #142 integration test, I expected `safeword install` on a project with no `CLAUDE.md` to leave it absent — the schema comment at `packages/cli/src/schema.ts` on the `CLAUDE.md` entry said `createIfMissing: false, // Only patch if exists, don't create (AGENTS.md is primary)`. The integration test confirmed the opposite: `CLAUDE.md` is created with just the safeword preamble block.

Tracing it down:

- The schema field existed (`TextPatchDefinition.createIfMissing: boolean`).
- The planner used it for _reporting_ — `planTextPatchesWithCreation` only added the path to `wouldCreate` if `createIfMissing` was true.
- The executor (`executeTextPatch`) **never read the field**. It unconditionally did `readFileSafe(...) ?? ''` then `writeFile(fullPath, definition.content + content)` on cache-miss. Empty-string + content wrote a new file.

So the documented contract ("Only patch if exists, don't create") was not enforced. The behavior was "always create on install, regardless of flag."

## Resolution

After exploring three options (enforce as-configured / enforce + flip default / drop the flag), maintainer confirmed:

- AGENTS.md-only setups were not a deliberate product target.
- CLAUDE.md is the canonical Claude Code entry point and should be present on fresh install.

Direction: **drop the flag**. The field had no consumer that exercised `false`, and project philosophy ("Don't design for hypothetical future requirements") argues against keeping dead affordance. If a future AGENTS.md-only need surfaces, the field can be reintroduced with a real consumer and a test.

## Scope

- Removed `createIfMissing: boolean` from `TextPatchDefinition`.
- Removed the field from both `AGENTS.md` and `CLAUDE.md` schema entries.
- Dropped `planTextPatchesWithCreation`; inlined at the single caller with `wouldCreate` tracking driven by filesystem state (which now honestly reports `CLAUDE.md` on fresh install — previously silent creation).
- Updated `tests/schema.test.ts` to assert `marker` and `operation` (the surviving structural fields) instead of the removed flag.

## Out of Scope

- Generalizing to other "schema field documented but unenforced" drift across the codebase. One-shot fix for this specific field.

## Done When

- [x] `executeTextPatch` and `TextPatchDefinition.createIfMissing` agree on a single contract.
- [x] Schema comment on `CLAUDE.md` reflects actual behavior.
- [x] Integration test for the "install when CLAUDE.md absent" case asserts the agreed contract and would fail if the contract regressed.
- [x] No flake — bundled into release PR #89 with full suite green.

## Notes

- Surfaced during #142 integration-test work — see that ticket's verify.md for the discovery context.
- Bundled into release v0.30.3 (PR #89) so the upgrade-mode heal fix and the schema/executor reconciliation ship together.

## Work Log

- 2026-05-14T15:30:00Z Created: filed after #142 surfaced the drift. Documented behavior says `createIfMissing: false` on CLAUDE.md prevents creation; actual behavior creates anyway. Integration test pinned actual behavior to keep #142 from drifting; this ticket reconciles the schema and the executor.
- 2026-05-14T16:45:00Z Implement + Done: dropped the flag, simplified the planner, updated tests. Full suite 1565 passed, 1 skipped. Bundled into release/v0.30.3 (PR #89).

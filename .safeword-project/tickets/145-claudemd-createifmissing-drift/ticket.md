---
id: 145
type: task
phase: understand
status: open
created: 2026-05-14T15:30:00Z
last_modified: 2026-05-14T15:30:00Z
---

# Schema `createIfMissing: false` is silently ignored by executor

**Goal:** Make `executeTextPatch` honor the `createIfMissing: false` flag on `TextPatchDefinition`, or remove the flag and update the schema comment to match actual behavior. Pick whichever direction reflects the intended product behavior.

## Why

While writing the #142 integration test, I expected `safeword install` on a project with no `CLAUDE.md` to leave it absent — the schema comment at [`packages/cli/src/schema.ts`](../../../packages/cli/src/schema.ts) on the `CLAUDE.md` entry says `createIfMissing: false, // Only patch if exists, don't create (AGENTS.md is primary)`. The integration test confirmed the opposite: `CLAUDE.md` is created with just the safeword preamble block.

Tracing it down:

- The schema field exists ([`schema.ts`](../../../packages/cli/src/schema.ts), `TextPatchDefinition.createIfMissing: boolean`).
- The planner uses it for _reporting_ — `planTextPatchesWithCreation` only adds the path to `wouldCreate` if `createIfMissing` is true ([`reconcile.ts:175`](../../../packages/cli/src/reconcile.ts:175)).
- The executor (`executeTextPatch`) **never reads the field**. It unconditionally does `readFileSafe(...) ?? ''` and then `writeFile(fullPath, definition.content + content)` on cache-miss. Empty-string + content writes a new file.

So the documented contract ("Only patch if exists, don't create") is not enforced. The behavior is "always create on install, regardless of flag."

This bites users who:

1. Want `AGENTS.md`-only setups (the comment's stated intent) and find `CLAUDE.md` reappearing after install.
2. Delete `CLAUDE.md` and re-run `safeword install` expecting respect for their choice.

It also misleads contributors reading the schema as documentation of behavior.

## Scope

- Decide direction: enforce the flag (executor checks `definition.createIfMissing` before creating from empty) **or** drop the flag (delete the field, update the `CLAUDE.md` schema entry comment, accept that text-patches always create on install).
- Implement the chosen direction in `executeTextPatch` and/or the schema.
- Update the existing integration test `packages/cli/tests/integration/install-upgrade.test.ts` case "CLAUDE.md install creates with preamble when absent" to reflect the chosen contract:
  - If enforce: rename to "CLAUDE.md install does NOT create when absent and `createIfMissing: false`" and flip the assertion.
  - If drop: keep current test; remove the schema field.

## Out of Scope

- Changing the default for any other text-patch target. `AGENTS.md` has `createIfMissing: true` today and that should remain — it's the primary entry point per the schema comment.
- Generalizing to other "schema field documented but unenforced" drift across the codebase. One-shot fix for this specific field.

## Done When

- [ ] `executeTextPatch` and `TextPatchDefinition.createIfMissing` agree on a single contract.
- [ ] Schema comment on `CLAUDE.md` reflects actual behavior.
- [ ] Integration test for the "install when CLAUDE.md absent" case asserts the agreed contract and would fail if the contract regressed.
- [ ] No flake on 3 consecutive CI runs.

## Notes

- Surfaced during #142 integration-test work — see that ticket's verify.md for the discovery context.
- Likely a 30-minute task. The decision (enforce vs drop) is the only non-trivial bit and could go either way; my read is **enforce**, because the schema comment is load-bearing documentation that users and contributors read, but the maintainer should decide.

## Work Log

- 2026-05-14T15:30:00Z Created: filed after #142 surfaced the drift. Documented behavior says `createIfMissing: false` on CLAUDE.md prevents creation; actual behavior creates anyway. Integration test pinned actual behavior to keep #142 from drifting; this ticket reconciles the schema and the executor.

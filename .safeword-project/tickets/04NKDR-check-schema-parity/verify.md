# 04NKDR — Verify (task)

Add the template→schema (unregistered-template) direction to `runParity` and
hard-block it at pre-commit.

## Verify Checklist

**Test Suite:** ✓ 2204/2204 tests pass (1 skipped; 130 files) — full `bun run test` on HEAD `89b1f19d` (the +5 over the prior 2199 are the new orphan-template tests).
**Lint:** ✅ Clean (eslint + `tsc --noEmit`).
**Behavioral proof (hard-block):** ✓ A temp unregistered template makes `bun scripts/parity-check.ts --mode=contracts-only` print `[TEMPLATE] Unregistered template … __tmp_orphan_check.md` and exit **1** (verified via `command bun` — the `bun` shell wrapper masks exit codes); removing it returns exit 0. The pre-commit's existing `… --mode=contracts-only || exit 1` therefore blocks an unregistered template.
**Real repo:** ✅ Clean — 109 pairs, 3 contracts, 0 orphan templates.

## What changed

- `src/parity.ts`: new `orphan-template` failure kind; `checkOrphanTemplates`
  scans the templates dir (skipping `_`-prefixed dirs) and flags any file not
  referenced by an ownedFiles/managedFiles `template:`. Runs in BOTH modes
  (like contracts), so the pre-commit contracts-only path hard-blocks it.
  `ParitySchema` gained optional `managedFiles` (so personas/glossary templates
  aren't false-flagged).
- `scripts/parity-check.ts`: success summary now notes "no unregistered
  templates"; failures already print kind-agnostically with exit 1.
- `tests/parity.test.ts`: 5 new orphan-template tests; contract tests isolated
  with a clean empty templates dir.

No new `check:schema` script (the pickup re-validation found `parity-check.ts`
already exists + runs in pre-commit). `schema.test.ts`'s equivalent assertion
kept as a backstop. Task — no scenarios/skill-log required by the done gate.

# 04NKDR — Verify (task)

Add the template→schema (unregistered-template) direction to `runParity` and
hard-block it at pre-commit. Verified via the `/verify` skill (this session's
invocation logged in `.safeword-project/skill-invocations.log`).

## Verify Checklist

**Test Suite:** ✓ 2204/2204 tests pass (1 skipped; 130 files) — full `bun run test` at product HEAD `89b1f19d` (the close commit `33a97e6d` touched only ticket docs; the +5 over the prior 2199 are the new orphan-template tests).
**Build:** ✅ Success
**Lint:** ✅ Clean (eslint + `tsc --noEmit`)
**Scenarios:** ⏭️ N/A — task (no test-definitions.md; scenario gate is feature-only)
**Dep Drift:** ✅ Clean — 04NKDR added no dependencies
**Parent Epic:** N/A — standalone ticket (Y2HCNJ-verify follow-up)
**Audit:** Audit passed — see /audit run this session (no architecture violations, no new duplication beyond the intentional independent-backstop walker, no dead code).

## Behavioral proof (hard-block)

A temp unregistered template makes `bun scripts/parity-check.ts --mode=contracts-only`
print `[TEMPLATE] Unregistered template … __tmp_orphan_check.md` and exit **1**
(verified via `command bun` — the `bun` shell wrapper masks exit codes); removing
it returns exit 0. The pre-commit's existing `… --mode=contracts-only || exit 1`
therefore blocks an unregistered template. Real repo clean: 109 pairs, 3
contracts, 0 orphans.

## What changed

- `src/parity.ts`: `orphan-template` failure kind + `checkOrphanTemplates`
  (scans templates dir, skips `_`-prefixed dirs, flags files with no
  ownedFiles/managedFiles `template:`). Runs in both modes; `ParitySchema`
  gained optional `managedFiles`.
- `scripts/parity-check.ts`: success summary notes "no unregistered templates".
- `tests/parity.test.ts`: 5 orphan tests; contract tests isolated with a clean
  empty templates dir.

No new `check:schema` script (pickup re-validation found `parity-check.ts`
already exists + runs in pre-commit). `schema.test.ts`'s equivalent kept as an
independent backstop (the `collectTemplateFiles` duplication is deliberate).

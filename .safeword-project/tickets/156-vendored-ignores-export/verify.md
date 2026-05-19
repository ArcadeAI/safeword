# Verify — Ticket 156: vendored-ignores export + install-time nudge + hygiene pass

## Verify Checklist

**Test Suite:** ✓ 1794/1794 tests pass (94 files; 1 pre-existing skip; full vitest run from `packages/cli/`)
**Build:** ✅ Success (`tsup` ESM + DTS build; CLI binaries + `presets/typescript/index.d.ts` 14.45 KB emitted)
**Lint:** ✅ Clean (`bun run lint` — zero errors at repo root; `tsc --noEmit` clean)
**Scenarios:** All 18 scenarios marked complete
**Dep Drift:** ✅ Clean (no `package.json` changes on this branch; new export ships zero new deps)
**Parent Epic:** N/A (no parent)

## Audit summary

- **Architecture (depcruise):** ✅ No dependency violations (193 modules, 507 deps cruised)
- **Dead code (knip):** ✅ Clean after demoting `printVendoredIgnoresNudge` to module-internal
- **Duplication (jscpd):** 2.36% lines / 2.11% tokens — pre-existing baseline, well under the 5% guideline; no new clones introduced
- **Test quality:** sampled the three new test files (`vendored-ignores.test.ts`, `vendored-ignores-nudge.test.ts`, `config-guard-patterns.test.ts`) — specific assertions (`toEqual`/`toBe`), `it.each` parameterization, temp-dir cleanup, behavior-named tests
- **Outdated:** `eslint 9.39.4 → 10.4.0` (dev, major). Owned by separate in-progress ticket 099-eslint-10-migration — not in scope for 156.

Audit passed.

## What landed

5 commits on `practical-feistel-df769a`:

1. `dc2e14d` — docs(tickets): add 156 — scenarios (was 152 → 153 → 156 after two ticket-ID collisions), dimensions, ticket
2. `99d7ba4` — feat(eslint): add `safeword.configs.vendoredIgnores` export
3. `4d91fb9` — feat(setup,upgrade): print vendoredIgnores nudge when existing eslint config detected
4. `74f9ea1` — chore(hooks): hygiene pass — readable config-guard regexes + intentional cursor/stop catch
5. `9e828e9` — chore: make `printVendoredIgnoresNudge` module-internal (knip cleanup)

Files touched:

- New: `packages/cli/src/presets/typescript/eslint-configs/vendored-ignores.ts` + its test
- New: `packages/cli/src/utils/vendored-ignores-nudge.ts` + its test
- New: `packages/cli/tests/hooks/config-guard-patterns.test.ts`
- Edits: `packages/cli/src/presets/typescript/index.ts` (interface + namespace + re-export)
- Edits: `packages/cli/src/commands/setup.ts` + `upgrade.ts` (single-call wiring)
- Edits: `.safeword/hooks/pre-tool-config-guard.ts` + `.safeword/hooks/cursor/stop.ts` (hygiene)
- Edits: `packages/cli/templates/hooks/pre-tool-config-guard.ts` + `cursor/stop.ts` (pair-parity mirror)

## Follow-up

Ticket **157 — install-time auto-patch** is queued (see `ticket.md` "Follow-up ticket 157" section). Print-only nudge in this ticket is the interim experience until 157 lands the auto-patch UX.

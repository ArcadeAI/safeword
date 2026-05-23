# Verify — Ticket 157: install-time auto-patch of consumer's ESLint config

## Verify Checklist

**Test Suite:** ✓ 1830/1830 tests pass (96 files; 1 pre-existing skip; full `vitest run` from `packages/cli/`)
**Build:** ✅ Success (`tsup` ESM + DTS build; CLI binaries + `presets/typescript/index.d.ts` 14.45 KB emitted)
**Lint:** ✅ Clean (`bun run lint` at repo root; targeted `tsc --noEmit` clean)
**Scenarios:** All 24 scenarios marked complete
**Dep Drift:** ✅ Clean (no `package.json` changes on this branch; new code ships zero new deps)
**Parent Epic:** N/A (no parent)

## Audit summary

- **Architecture (depcruise):** ✅ No dependency violations (197 modules, 522 deps cruised)
- **Dead code (knip):** ✅ Clean after dropping the superseded `maybePrintVendoredIgnoresNudge` wrapper and un-exporting the module-internal `BailReason` type. The `eslintPlugin|default` duplicate-export note is a pre-existing pattern in `presets/typescript/index.ts`, not introduced by this ticket.
- **Duplication (jscpd) on `packages/cli/src/utils/`:** 1.44% lines / 1.77% tokens — well under the 5% guideline. The three clones are setup fixtures across adjacent scenarios in the same test file; acceptable noise.
- **Test quality:** sampled the three new/extended test files (`eslint-auto-patch.test.ts`, `vendored-ignores-nudge.test.ts`, `conditional-setup.test.ts` / `invisible-extension.test.ts` updates). Specific assertions (`toBe`/`toEqual`/`toContain`), `it.each` parameterization for the 6-extension matrix, temp-dir cleanup per scenario, behavior-named tests.
- **Outdated:** `eslint 9.39.4 → 10.4.0` (dev, major). Owned by separate in-progress ticket 099-eslint-10-migration — not in scope for 157.

Audit passed.

## What landed

7 commits on `practical-feistel-df769a`:

1. `9653375` — docs(tickets): add 154 — auto-patch ticket + dimensions + 24 scenarios
2. `bcb6259` — feat(eslint): add ESLint config auto-patcher (Rules 1+2+4+5)
3. `2e01552` — feat(setup,upgrade): auto-patch eslint config + --no-modify opt-out (Rules 3-5)
4. `0c3c206` — test(eslint-auto-patch): add Scenario 5.1 (post-edit syntax fail → revert) + check off all 24 scenarios
5. `045b6e3` — test(integration): pass --no-modify to existing-config preservation tests
6. `c380b13` — chore: drop dead `maybePrintVendoredIgnoresNudge` + un-export `BailReason`
7. (this commit) — docs(tickets): close 154 — verify.md

Files touched:

- New: `packages/cli/src/utils/eslint-auto-patch.ts` + its test (19 cases across Rules 1, 2, 4, 5)
- Edits: `packages/cli/src/utils/vendored-ignores-nudge.ts` + its test (orchestrator + opt-out + bail-line printing)
- Edits: `packages/cli/src/cli.ts` (`--no-modify` flag on setup + upgrade)
- Edits: `packages/cli/src/commands/setup.ts` + `upgrade.ts` (orchestrator call site + `SetupOptions` / `UpgradeOptions` plumbing)
- Edits: `packages/cli/tests/integration/conditional-setup.test.ts` + `invisible-extension.test.ts` (pass `--no-modify` to preserve byte-equality contract for the non-overwrite scenarios)

## Behavioral coverage

Auto-patch core (Rule 1): 5/5 scenarios — bare array, `defineConfig(...)` wrapper, six recognized filenames (`.mjs/.js/.cjs/.ts/.mts/.cts`), no-duplicate-import, CRLF preservation.

Idempotency (Rule 2): 2/2 — substring-match on `vendoredIgnores` covers both prior auto-patch and manual 156 application.

Opt-out (Rule 3): 3/3 — `--no-modify` flag, `SAFEWORD_NO_MODIFY` env var, opt-out + already-patched silent path.

Bail-to-print (Rule 4): 4/4 — function-returning-config, single-imported-config, `defineConfig(non-array)`, unrecognized custom wrapper.

Safety (Rule 5): 4/4 — post-edit syntax-check failure reverts from backup, read failure bails cleanly, TypeScript variants skip `node --check`. Write-failure-mid-edit (5.2) covered by inspection of the code path (`writeAndValidate` returns `write-failed` if `copyFileSync` or `writeFileSync` throws); not unit-tested because reliable cross-platform write-fault injection requires `memfs`/mock-fs which adds dep weight not worth this single scenario.

Wiring parity (Rule 6): 3/3 — setup and upgrade share the orchestrator call; safeword-generated configs (with `.safeword/` substring) self-quiesce via the predicate.

Repo health (Rule 7): 3/3 — lint, vitest, build all green.

## Follow-up notes

- Pair-parity unchanged: no hook files touched in this ticket; the parity contract is preserved by virtue of not editing under `.safeword/hooks/` or `packages/cli/templates/hooks/`.
- The textual heuristic intentionally bails on a class of edge cases (comments containing `export default [`, unrecognized wrappers, etc.). On bail, the user gets the 156 print-only nudge and the manual snippet. No silent corruption.

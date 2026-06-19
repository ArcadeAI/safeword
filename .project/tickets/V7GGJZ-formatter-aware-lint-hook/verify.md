# Verify: Formatter-aware lint hook (V7GGJZ)

Pinned to commits db6361b9, 783935af, fdc9f189, 3e01a0e3 (+ docs/scenarios commit).

## Verify Checklist

**Test Suite:** ✓ 3073/3073 tests pass (3 skipped) — full vitest suite, 207 files
**Gherkin:** ✅ Acceptance lane passes (59 scenarios, 576 steps) — V7GGJZ's feature is `@wip` (step definitions deferred), excluded from the lane
**Build:** ✅ Success (tsup ESM + DTS)
**Lint:** ✅ Clean (`eslint .` + gherkin lint + `tsc --noEmit`)
**Scenarios:** All 9 scenarios marked complete
**Dep Drift:** ✅ Clean (no dependency changes)
**Parent Epic:** 2H2XKH (siblings: 0/2 done — 9C2CFX, EYRK34 not started)
**Reconcile:** N/A — extends the existing formatter-detection pattern (8BNSTE / 1J6JKP); no new pattern introduced

## How each behavior is proven

- **Prettier skip (DEV1.AC1/AC2, precedence):** `detectAlternativeFormatter` + `projectOwnsAlternativeFormatter` unit tests (biome/dprint/oxfmt/deno → true; both-configs → true) + the `runPrettier` early-return gate.
- **Own-prettier / greenfield / `.bak` (DEV2, DEV3):** predicate false-cases → Prettier runs with the resolved config (unchanged post-8BNSTE).
- **ESLint still runs, no restyle (DEV1.AC3):** existing formatter-agnostic config — `recommendedTypeScript` pulls `eslint-plugin-security` via `basePlugins` and bakes `eslint-config-prettier` in (line 132); no `@stylistic` plugin. No V7GGJZ change.
- **No Prettier nag (DEV4.AC1):** `shouldWarnMissingPrettier` unit test + `session-lint-check` wiring.

## Deferred (follow-up)

- **Cucumber acceptance-lane step definitions** for the 9 scenarios (feature tagged `@wip`). The full end-to-end hook run on an installed Biome repo is the one piece not yet wired — the lint hook shells out to `bunx eslint/prettier` and can trigger an upgrade on a bare dir, so it isn't a cheap test. Behaviors are unit-covered today.

## Audit

**Audit passed.** Architecture clean (depcruise: no violations, 354 modules). No new dead code — the
three new exports (`detectAlternativeFormatter`, `projectOwnsAlternativeFormatter`,
`shouldWarnMissingPrettier`) are all consumed; knip's baseline unused-export noise is pre-existing
(template-copy false-positives, per project memory). No new duplication (jscpd: 0 clones across
`detect.ts` ↔ `lint-config.ts` — the rule-mandated set is expressed two ways, not a textual clone).
Test quality: specific boolean assertions, fresh temp dirs per test, edge cases (`.bak`, both-configs,
nonexistent dir) covered. Independent quality-review pass (Sonnet): APPROVE, no criticals.

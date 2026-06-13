# Impl Plan: Auto-run health verification after setup & upgrade

**Status:** implemented

## Approach

Build order (each step leaves the suite green):

1. **Extract `src/health.ts`** — move `HealthStatus`, `checkHealth`, `reportHealthSummary`, and the `find*` helpers out of `commands/check.ts`; `checkLatestVersion` + update reporting stay in check.ts. check.ts re-imports. Behavior-neutral — proven by the existing check suite passing unmodified (DEV2.AC2, integration via existing `tests/commands/check.test.ts`).
2. **Remediation-hint parameter** — `reportHealthSummary(health, options?)` with `options.repairHint` defaulting to today's `Run \`safeword upgrade\` …` strings across all three failure branches (missing packs / missing packages / issues). Unit layer (AC5 outline + standalone-keeps-hint).
3. **No-update-check seam test** — unit: spy on global `fetch`; `checkHealth` on a fixture performs zero network calls and the health module exposes no update-check export (AC3.health_module_has_no_update_check_path).
4. **Wire setup tail** — after `maybeAutoPatchOrNudge`, inside the existing try/catch: run `checkHealth` + `reportHealthSummary`; non-clean → exit non-zero. Post-setup keeps the default upgrade hint (correct repair advice; dimensions note). Integration for clean path (AC1 clean, AC3 setup, AC4 setup-once); unit with injected broken `HealthStatus` for the issues path (AC1 nonzero).
5. **Wire upgrade tail** — same call with a post-upgrade hint override (no `Run \`safeword upgrade\``; summary line ≠`Configuration is healthy` on failure). Integration clean (AC2 clean, AC3 upgrade, AC4 upgrade-once, AC4 advisories-once); unit injected-broken (AC2 nonzero, AC5 outline ×3 branches).
6. **Docs demotion** — SAFEWORD.md template+dogfood pair + website `cli.mdx`: pin "runs automatically after `setup` and `upgrade`", move standalone use under CI/debugging; content test greps the three surfaces (DEV2.AC1).

Test layers: integration = run the real command against a temp fixture (existing setup/upgrade test harness); unit = extracted module + injected HealthStatus at the wiring seam; content = doc-surface grep test.

## Decisions

| Decision          | Choice                                                | Alternatives considered                     | Rejected because                                                                                                                  |
| ----------------- | ----------------------------------------------------- | ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Extraction home   | new `src/health.ts`                                   | export from check.ts; `src/utils/health.ts` | command→command import couples CLIs; utils/ is leaf helpers, health orchestrates reconcile (mirrors `src/reconcile.ts` precedent) |
| Failure semantics | report + exit non-zero, no repair                     | auto-repair loop                            | reconcile already ran — re-running what just failed masks bugs (figure-it-out 2026-06-13)                                         |
| Hint context      | `options.repairHint` param, default = today's strings | second reporter fn; module-level flag       | duplication; hidden state                                                                                                         |
| No-network proof  | `fetch` spy at the unit seam                          | static source-text assertion                | brittle to refactors; spy proves the actual behavior                                                                              |
| Update-check      | stays in check.ts                                     | move to health.ts behind a flag             | health must be network-free by contract (AC3); flags invite accidental wiring                                                     |

## Arch alignment

- **CLI Structure** (ARCHITECTURE.md) — commands stay thin in `src/commands/`; shared engines live at `src/` root (`reconcile.ts`, `schema.ts`); `health.ts` follows.
- **Reconciliation Engine** — health detection is reconcile `dryRun`, reused not duplicated; the self-verify reuses the same core instead of a parallel checker.

## Known deviations

Reconciled at implement-exit (2026-06-13):

- **Stronger than planned:** the issues-found partitions for both setup AND upgrade got real end-to-end subprocess tests (malformed `personas.md` — user content reconcile never repairs) instead of the planned injected-`HealthStatus` wiring tests. The unit seam was only needed for the AC5 hint branches and the no-fetch proof.
- **Smaller than planned:** docs demotion touched only `cli.mdx` — the SAFEWORD.md pair carries no imperative "run `safeword check`" wording (verified by the DEV2.AC1 content test), so the planned pair edit was unnecessary.
- **Added during REFACTOR:** `firstFailureSection` extraction in health.ts and a `selfVerify` helper in upgrade.ts, both to clear the complexity-10 lint cap.

## Assessment triggers

- setup/upgrade gain post-mutation steps after the health call → re-site the call to stay last.
- The health core ever wants a network probe → revisit AC3's no-network contract first.
- `reportHealthSummary` grows a fourth failure branch → extend the AC5 outline.

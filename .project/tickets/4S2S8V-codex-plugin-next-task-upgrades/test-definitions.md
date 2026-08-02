# Test Definitions: Activate Safeword upgrades coherently in Codex

Feature source: `packages/cli/features/codex-plugin-next-task-upgrades.feature`

test-definitions.md is the R/G/R ledger. The restart-bound rows supersede the
original next-task-only rows after the rc.1 live gate disproved that contract.

## Rule R1 — Installation refreshes an existing Git marketplace

- [x] Fresh profile adds before install — RED / GREEN / REFACTOR
- [x] Marketplace add failure prevents install — RED / GREEN / REFACTOR
- [x] Existing Git marketplace upgrades before install — RED / GREEN / REFACTOR
- [x] Marketplace refresh failure prevents stale install — RED / GREEN / REFACTOR

## Rule R2 — Installation status requires a Codex restart

- [x] Successful installation requires app restart — RED / GREEN / REFACTOR
- [x] Running task keeps its loaded bundle — RED / GREEN / REFACTOR
- [x] New task in the same app remains pending — RED / GREEN / REFACTOR
- [ ] Restarted app loads the exact released skills and hooks — RED / GREEN pending rc.2 live gate
- [x] Pending status never claims the running app reloaded — RED / GREEN / REFACTOR

## Rule R3 — Activation proof belongs to the installation and restarted app

- [x] Pre-install proof is invalidated — RED / GREEN / REFACTOR
- [x] Same-host SessionStart cannot complete activation — RED / GREEN / REFACTOR
- [x] Restarted-host SessionStart completes activation — RED / GREEN / REFACTOR
- [x] Version or manifest mismatch prevents completion — RED / GREEN / REFACTOR
- [x] Later tasks preserve completed activation — RED / GREEN / REFACTOR
- [x] POSIX and Windows process identity parsing — RED / GREEN / REFACTOR

## Rule R4 — Legacy markers cannot manufacture proof

- [x] Malformed legacy marker creates no activation — RED / GREEN / REFACTOR
- [x] Stale legacy marker creates no activation — RED / GREEN / REFACTOR

## Feature-level cross-scenario refactor

- [x] Shared host identity and activation-marker logic
- [ ] Full-suite and rc.2 live verification

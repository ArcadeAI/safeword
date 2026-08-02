# Verification: Ship Safeword as a native Claude Code plugin

## Status

- ✓ 6,157/6,162 Vitest tests pass; 5 are intentional skips.
- **Gherkin:** 769/772 scenarios pass; 3 are intentional skips. Every executable non-`@wip`, non-`@manual`, non-`@live` scenario passed.
- Audit passed for the pre-release implementation scope. Plugin generation, packaged identity/inventory hashes, release-contract alignment, cross-host parity, and a real headless Claude host run all passed.
- **Release boundary:** Not executed. No version bump, tag, push, publish, marketplace install, or release was performed.

**PR Scope:** ✅ Diff matches ticket scope. The real-host plugin boundary is proven; interactive `/reload-plugins` and release remain explicitly open.

## Evidence

- `bun run --cwd packages/cli test` — 409 files passed; 6,157 tests passed; 5 skipped.
- `bun run test:bdd` — 769 scenarios passed; 3 skipped; 26,805 steps passed; 4 skipped.
- `bun run lint:eslint` — passed.
- `bun run format --if-present` — completed without file changes.
- `bunx tsc --noEmit` — passed.
- `bun audit` — no vulnerabilities found.
- `bun run --cwd packages/cli generate:claude-plugin` — generated 157 assets.
- `bun run --cwd packages/cli check:claude-plugin` — aligned at `0.71.0-rc.2`.
- `bun scripts/parity-check.ts --mode=all` — 229 pairs and 8 contracts in sync.
- Claude Code `2.1.170` headless acceptance via session-only `--plugin-dir` — host init identified `safeword@inline` at the generated plugin root and exposed all 18 namespaced Safeword skills; `SessionStart`, `UserPromptSubmit`, and five `Stop` hooks completed successfully with zero hook stderr; the session returned `SAFEWORD_HEADLESS_FIXED_OK` with exit 0.
- Native execution proof — Claude wrote `execution-proof-v1.json` for the same generated root, plugin version `0.71.0-rc.2`, and current hook-manifest digest after `UserPromptSubmit`.
- Dispatcher regression — the live run first exposed Bun dropping the runtime-assigned bundled CLI path from aggregate child hooks; the new integration test reproduces that boundary with the variable absent at process startup and passes after explicitly forwarding the current environment.

## Decisions needed (spec / scope / value)

- Authorize the interactive Claude `/reload-plugins` acceptance boundary in a stateful supported host session. Headless `--plugin-dir` proves native loading and hook execution, but it does not emulate an in-session interactive slash-command reload.
- Authorize release-only drift/cache smoke execution and the eventual version/tag/publish workflow in a separate release run.

## Notes

The worktree is pre-release ready. The remaining interactive-reload and release ledger entries are deliberately left open because headless mode cannot drive the former and the user requested stopping short of the latter.

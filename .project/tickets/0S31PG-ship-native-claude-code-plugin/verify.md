# Verification: Ship Safeword as a native Claude Code plugin

## Status

- ✓ 6,157/6,162 Vitest tests pass; 5 are intentional skips.
- **Gherkin:** 769/772 scenarios pass; 3 are intentional skips. Every executable non-`@wip`, non-`@manual`, non-`@live` scenario passed.
- Audit passed for the pre-release implementation scope. Plugin generation, packaged identity/inventory hashes, release-contract alignment, cross-host parity, headless Claude, and interactive same-task reload all passed.
- **Release boundary:** Not executed. No version bump, tag, push, publish, official-marketplace install, or release was performed. The interactive check used a temporary profile and local-directory marketplace only.

**PR Scope:** ✅ Diff matches ticket scope. Headless loading and interactive same-task `/reload-plugins` are proven; release remains explicitly open.

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
- Interactive reload — Claude Code `2.1.170` started an authenticated task with no Safeword plugin, then Safeword `0.71.0-rc.2` was installed into that task's temporary profile from the local generated marketplace. Without restarting, `/reload-plugins` reported `Reloaded: 1 plugin · 0 skills · 7 agents · 24 hooks`; the next prompt returned `SAFEWORD_INTERACTIVE_RELOAD_OK`.
- Same-task proof — the next UserPromptSubmit wrote `execution-proof-v1.json` with session `5d6daf03-bc80-4c7c-99b8-eb03c1c6c04b`, plugin version `0.71.0-rc.2`, and hook-manifest digest `79728d2f2251659a458208ac8d5ea45fe7aebe54e9204e4aaa108de491e39503` at `2026-08-02T21:41:11.331Z`.
- Live workflow proof — a second clean temporary task repeated install plus `/reload-plugins`, then accepted `/safeword:explain` without restart. Claude identified it as the Safeword explain skill, processed its instructions, and ran all five Stop hooks; session `a4d11176-f4a0-4c24-8f12-47a6d8cc7dce` wrote the corresponding UserPromptSubmit proof at `2026-08-02T21:45:31.022Z`. This proves workflow hot-loading despite Claude's reload summary displaying `0 skills`.
- Evidence limit — a local-directory marketplace intentionally executes its source plugin root, so `safeword claude status` remains `unproven` against the copied cache path. Proving the exact official cache root after removing the marketplace source remains the release-only tagged-artifact smoke lane; this run does not claim it.

## Decisions needed (spec / scope / value)

- Authorize release-only drift/cache smoke execution and the eventual version/tag/publish workflow in a separate release run.

## Notes

The worktree is pre-release ready. Interactive same-task activation is proven. Exact official-cache execution and the release ledger remain deliberately open because the user requested stopping short of a release.

## Version Management

When bumping the CLI version, update all **four release-tracked artifacts**:

1. `packages/cli/package.json` — source of truth for npm
2. `.claude-plugin/marketplace.json` → `plugins[0].version` — source of truth for Claude Code plugin
3. `packages/cli/codex-plugin/.codex-plugin/plugin.json` → `version` — source of truth for Codex plugin
4. `packages/cli/codex-plugin/hooks.json` — all five `bunx` commands pin `safeword@<version>`

Do NOT add version to `plugin/.claude-plugin/plugin.json` — per Claude Code docs, relative-path plugins use the marketplace entry only. Pre-commit and release-contract tests block a mismatch between the CLI, plugin manifests, and Codex hook commands.

### Releasing

Publish is CI-driven via OIDC trusted publishing: tag push → `.github/workflows/release.yml` → npm with provenance. No local `bun publish` for normal releases.

Full procedure (bump → PR → admin-merge → annotated tag → workflow runs → verify on npm) lives in the `versioning` skill. Invoke `/versioning` or trust auto-trigger when cutting a release.

Local `bun publish` is still gated by `packages/cli/scripts/check-bun-publish.js` (refuses without matching `v$VERSION` tag on HEAD) — defense in depth, not the canonical path.

## Test Execution

- **Never run more than one vitest process.** If a test run is backgrounded, wait for the completion notification — do not retry.
- Prefer targeted runs over the full suite during development.
- **Where you run matters.** `vitest` is only installed in `packages/cli/node_modules/.bin`, so `npx vitest run …` works **from `packages/cli`**, not the repo root (from root it fails `vitest: not found` — issue #723). From the repo root, run package tests via `bun run test <path>` — both `packages/cli`-relative (`tests/foo.test.ts`) and repo-root-relative (`packages/cli/tests/foo.test.ts`) paths work; the build-lock wrapper rebases the latter (#723) and rebuilds `dist/` first. The wrapper (`packages/cli/scripts/run-vitest-with-build-lock.mjs`, invoked as `node scripts/…` from `packages/cli`) resolves a `vitest` even when PATH lacks one (issue #715).
- Full suite only for final verification before commit.

---@./AGENTS.md

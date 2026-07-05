## Version Management

When bumping the CLI version, update **both** files:

1. `packages/cli/package.json` — source of truth for npm
2. `.claude-plugin/marketplace.json` → `plugins[0].version` — source of truth for Claude Code plugin

Do NOT add version to `plugin/.claude-plugin/plugin.json` — per Claude Code docs, relative-path plugins use the marketplace entry only. A pre-commit hook blocks commits where the two versions differ.

### Releasing

Publish is CI-driven via OIDC trusted publishing: tag push → `.github/workflows/release.yml` → npm with provenance. No local `bun publish` for normal releases.

Full procedure (bump → PR → admin-merge → annotated tag → workflow runs → verify on npm) lives in the `versioning` skill. Invoke `/versioning` or trust auto-trigger when cutting a release.

Local `bun publish` is still gated by `packages/cli/scripts/check-bun-publish.js` (refuses without matching `v$VERSION` tag on HEAD) — defense in depth, not the canonical path.

## Test Execution

- **Never run more than one vitest process.** If a test run is backgrounded, wait for the completion notification — do not retry.
- Prefer targeted runs over the full suite during development.
- **Where you run matters.** `vitest` is only installed in `packages/cli/node_modules/.bin`, so `npx vitest run …` works **from `packages/cli`**, not the repo root (from root it fails `vitest: not found` — issue #723). From the repo root, run package tests via `bun run test tests/path/to/file.test.ts` (paths are `packages/cli`-relative; it forwards through the build-lock wrapper, which also rebuilds `dist/` first). The `node scripts/run-vitest-with-build-lock.mjs` wrapper resolves a `vitest` even when PATH lacks one (issue #715).
- Full suite only for final verification before commit.

---@./AGENTS.md

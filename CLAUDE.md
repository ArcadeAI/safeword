@./.safeword/SAFEWORD.md

---

## Version Management

When bumping the CLI version, update **both** files:

1. `packages/cli/package.json` — source of truth for npm
2. `marketplace.json` → `plugins[0].version` — source of truth for Claude Code plugin

Do NOT add version to `plugin/.claude-plugin/plugin.json` — per Claude Code docs, relative-path plugins use the marketplace entry only. A pre-commit hook blocks commits where the two versions differ.

### Tagging Releases

Every published version must have an annotated git tag (`vX.Y.Z`) on the release commit. Tag bodies should summarize what shipped — see `git show v0.32.0` for the style.

After committing the version bump and before `bun publish`:

```bash
git tag -a vX.Y.Z -m "Release vX.Y.Z\n\n<rollup of changes since prior tag>"
git push origin vX.Y.Z
```

`prepublishOnly` runs `packages/cli/scripts/check-bun-publish.js`, which refuses to publish if HEAD is not tagged `v$VERSION`. The error message prints the exact tag + push commands to run.

## Test Execution

- **Never run more than one vitest process.** If a test run is backgrounded, wait for the completion notification — do not retry.
- Prefer targeted runs (`npx vitest run tests/path/to/file.test.ts`) over full suite during development.
- Full suite only for final verification before commit.

---@./AGENTS.md

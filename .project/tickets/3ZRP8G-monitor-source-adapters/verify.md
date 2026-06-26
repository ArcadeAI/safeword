# Verify: 3ZRP8G monitor source adapters

## Result

Done. The monitor now covers Claude Code, Codex CLI, and Cursor sources through source adapters and committed reviewed snapshots.

## Evidence

- Source adapters:
  - Claude Code: `https://raw.githubusercontent.com/anthropics/claude-code/main/CHANGELOG.md`
  - Codex CLI: `https://github.com/openai/codex/releases.atom`
  - Cursor: `https://cursor.com/changelog`
- Reviewed snapshots:
  - `.github/changelog-snapshots/claude-code.txt`
  - `.github/changelog-snapshots/codex-cli.txt`
  - `.github/changelog-snapshots/cursor.txt`
- Cursor HTML normalization is covered against cosmetic markup changes and entity decoding.
- Codex Atom normalization is covered against release title/date/link extraction.

Focused tests:

```sh
SAFEWORD_TEST_LOCK_DIR=/Users/alex/.codex/worktrees/monitor-source-adapters/.test-lock bun run --cwd packages/cli test tests/upstream-monitor/sources.test.ts tests/upstream-monitor/issues.test.ts
```

Result:

```text
Test Files  2 passed (2)
Tests       5 passed (5)
```

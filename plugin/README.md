# Safeword — Claude Code Plugin

Bootstrap plugin that installs [safeword](https://safeword.dev) into your project via Claude Code's plugin system.

## What is safeword?

Safeword configures AI coding agents with proven development workflows:

- **BDD orchestration** — define behaviors before implementation
- **Auto-linting** — fixes code style on every edit
- **Quality reviews** — automatic review when changes are proposed
- **Debugging framework** — systematic four-phase debugging
- **Refactoring discipline** — small-step, test-verified refactoring

## Installation

### From the Claude Code marketplace

```
/plugin install safeword
```

### From GitHub

```
/plugin marketplace add TheMostlyGreat/safeword
/plugin install safeword@safeword
```

### For development

```bash
claude --plugin-dir /path/to/safeword/plugin
```

## Usage

After installing the plugin, start a new Claude Code session. Claude will automatically detect that safeword isn't configured and run the setup for you.

You can also run setup manually:

- `/safeword:setup` — install safeword into the current project
- `/safeword:upgrade` — upgrade to the latest version

## Prerequisites

- [Bun](https://bun.sh) or [Node.js](https://nodejs.org) (for `bunx` or `npx`)

## After setup

Once setup completes, everything is installed locally in your project (`.safeword/`, `.claude/`). The plugin can be safely uninstalled — all functionality is preserved.

## Known limitations

- **Non-project directories**: The setup hint appears in any directory without `.safeword/`, including non-project directories. It's harmless — just ignore it or run setup if relevant.
- **Cursor/other editors**: This plugin is Claude Code only. For Cursor support, use `bunx safeword@latest setup` directly.

## Learn more

- [Website](https://safeword.dev)
- [GitHub](https://github.com/TheMostlyGreat/safeword)
- [CLI documentation](https://github.com/TheMostlyGreat/safeword/tree/main/packages/cli)

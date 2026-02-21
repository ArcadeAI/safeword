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

After installing the plugin, start a new Claude Code session. You'll see a hint to run setup:

```
SAFEWORD: Not configured for this project. Run /safeword:setup to install...
```

Run `/safeword:setup` and Claude will install safeword into your project.

## Prerequisites

- [Bun](https://bun.sh) or [Node.js](https://nodejs.org) (for `bunx` or `npx`)

## After setup

Once `bunx safeword setup` completes, everything is installed locally in your project (`.safeword/`, `.claude/`). The plugin can be safely uninstalled — all functionality is preserved.

## Learn more

- [Website](https://safeword.dev)
- [GitHub](https://github.com/TheMostlyGreat/safeword)
- [CLI documentation](https://github.com/TheMostlyGreat/safeword/tree/main/packages/cli)

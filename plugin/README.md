# Safeword — Claude Code Plugin

Native, versioned [safeword](https://safeword.dev) workflows and hooks for Claude Code.

## What is safeword?

Safeword configures AI coding agents with proven development workflows:

- **BDD orchestration** — define behaviors before implementation
- **Auto-linting** — fixes code style on every edit
- **Quality reviews** — automatic review when changes are proposed
- **Debugging framework** — systematic four-phase debugging
- **Refactoring discipline** — small-step, test-verified refactoring

## Installation

### Recommended CLI lifecycle

```bash
safeword claude install
# In Claude Code:
/reload-plugins
safeword claude status
```

The installer pins the official release at user scope and verifies the installed
cache payload. It does not modify project files.

### From GitHub

```
/plugin marketplace add ArcadeAI/safeword
/plugin install safeword@safeword
```

### For development

```bash
claude --plugin-dir /path/to/safeword/plugin
```

## Usage

After installing or updating, run `/reload-plugins` to make the plugin available
in the current task. The next prompt records execution proof bound to the exact
version, hook-manifest digest, and canonical installed cache path.

Project state is still created explicitly:

- `safeword setup` — create or reconcile project-owned state
- `/safeword:bdd`, `/safeword:debug`, and the other namespaced skills — run native workflows

For a legacy project, inspect migration state before removing anything:

```bash
safeword claude status
safeword claude cleanup
# Run the exact --yes --plan command returned by the preview.
safeword claude recover # only when status says recovery-required
```

Legacy protection stays authoritative until exact plugin execution is proven.
Cleanup is project-only and preserves unrecognized or third-party Claude content.

## Prerequisites

- Claude Code 2.1.170 or newer
- Bun (the installed plugin carries its exact bundled CLI runtime)

## After setup

Project-owned tickets, configuration, guides, and runtime state remain in the
repository. Framework code executes from Claude's versioned installed plugin
cache; uninstalling the plugin removes that Claude delivery surface.

## Known limitations

- **Interactive trust**: Safeword never accepts plugin or workspace trust on your behalf.
- **Live reload refusal**: If Claude refuses `/reload-plugins`, keep legacy protection and retry after resolving the host prompt.
- **Cursor/other editors**: This plugin is Claude Code only. For Cursor support, use `bunx safeword@latest setup` directly.

## Learn more

- [Website](https://safeword.dev)
- [GitHub](https://github.com/ArcadeAI/safeword)
- [CLI documentation](https://github.com/ArcadeAI/safeword/tree/main/packages/cli)

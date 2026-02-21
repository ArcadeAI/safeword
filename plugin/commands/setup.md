---
description: Install safeword configuration into this project
---

# Safeword Setup

Install safeword's AI coding agent configuration into the current project.

## Instructions

Run the safeword CLI:

```bash
bunx safeword@latest setup
```

If bun is not installed, use npx:

```bash
npx safeword@latest setup
```

Setup auto-detects your project's languages (TypeScript, Python, Go, Rust) and installs the appropriate configuration. No prompts — it just runs.

## What Gets Installed

- **Skills**: BDD orchestration, systematic debugging, refactoring, quality reviewing
- **Commands**: /bdd, /lint, /audit, /done, /quality-review, /refactor, /cleanup-zombies
- **Hooks**: Auto-lint on edit, quality review on stop, timestamp injection, question guidance
- **Guides**: Testing, planning, architecture, debugging, context files, and more
- **Templates**: Feature specs, task specs, design docs, tickets, work logs
- **ESLint + Prettier**: Pre-configured with security scanning and framework-specific rules

## After Installation

Verify setup:

```bash
bunx safeword@latest check
```

Once installed, everything is local to the project. The safeword plugin can be uninstalled — all functionality is preserved.

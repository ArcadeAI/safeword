---
description: Install safeword configuration into this project
---

# Safeword Setup

Install safeword's AI coding agent configuration into the current project.

## Instructions

1. Check if safeword is already installed:

```bash
test -d .safeword && echo "Already installed" || echo "Not installed"
```

2. Run the convergent setup command for both new and existing installations:

```bash
bunx safeword@latest setup
```

3. If `bunx` is not available, try:

```bash
npx safeword@latest setup
```

Setup auto-detects languages (TypeScript, Python, Go, Rust), creates missing configuration, and updates Safeword-owned files while preserving project customizations.

## What Gets Installed

- **Skills**: BDD orchestration, systematic debugging, refactoring, quality reviewing
- **Commands**: /bdd, /lint, /audit, /verify, /quality-review, /refactor, /cleanup-zombies
- **Hooks**: Auto-lint on edit, quality review on stop, timestamp injection, question guidance
- **Guides**: Testing, planning, architecture, debugging, context files, and more
- **Templates**: Feature specs, task specs, design docs, tickets, work logs
- **ESLint + Prettier**: Pre-configured with security scanning and framework-specific rules

## After Installation

Report what was created, then suggest committing the new files.

The safeword plugin can be uninstalled after setup — all functionality is local to the project.

---
name: cleanup-zombies
description: Kill zombie dev servers and test processes. Use when ports are
  blocked, processes are hanging, or test runners won't start.
---

## Packaged runtime

Resolve [the bundled Safeword runtime](../../runtime/cli.js) relative to this containing asset, not the project working directory.
Before each shell block, assign SAFEWORD_PLUGIN_RUNTIME to that resolved absolute file path in a separate shell statement ending with a semicolon, then invoke the helper in that same shell call.
Do not use `SAFEWORD_PLUGIN_RUNTIME=... bun "$SAFEWORD_PLUGIN_RUNTIME" ...`: the shell expands the argument before applying that environment assignment.
Keep PROJECT_DIR bound to the actual project. Never substitute a project helper or another agent cache.

# Cleanup Zombies

Kill zombie processes (dev servers, Playwright browsers, test runners) for the current project only. Safe to use in multi-project environments.

## Instructions

Run the cleanup script — it previews what would be killed (nothing dies without
explicit consent; the preview-first ritual is script-enforced):

```bash
bun "$SAFEWORD_PLUGIN_RUNTIME" project runtime cleanup-zombies --
```

If the preview looks correct, confirm the kill with `--yes`:

```bash
bun "$SAFEWORD_PLUGIN_RUNTIME" project runtime cleanup-zombies -- --yes
```

## What It Does

1. **Auto-detects framework** - Finds port from vite.config.ts, next.config.js, etc. (checks root, `packages/*/`, `apps/*/` for monorepos)
2. **Checks project-owned port processes** - Inspects the dev port and in-range test port (port + 1000), reporting owners it skips when project ownership cannot be verified
3. **Checks project-owned test processes** - Inspects Playwright, Chromium, and Electron matches whose working directory is inside this project
4. **Revalidates before signaling** - Only kills processes whose current working directory still belongs to this project

## Manual Override

If auto-detection fails or you need a specific port:

```bash
# Explicit port (preview, then add --yes to kill)
bun "$SAFEWORD_PLUGIN_RUNTIME" project runtime cleanup-zombies -- 5173

# Port + additional pattern
bun "$SAFEWORD_PLUGIN_RUNTIME" project runtime cleanup-zombies -- --yes 5173 "electron"
```

## When to Use

- Port already in use when starting dev server
- Tests hanging or failing due to zombie processes
- Switching between projects
- Before running E2E tests
- After interrupted test runs

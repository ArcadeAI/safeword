---
description: Upgrade safeword configuration to the latest version
---

# Safeword Upgrade

Upgrade safeword's configuration in the current project to the latest version.

## Instructions

1. Confirm safeword is installed:

```bash
test -d .safeword || echo "Not installed — run /safeword:setup first"
```

2. If not installed, suggest `/safeword:setup` instead and stop.

3. If installed, run:

```bash
bunx safeword@latest upgrade
```

4. If `bunx` is not available, try:

```bash
npx safeword@latest upgrade
```

## After Upgrade

Report what was updated, then suggest committing the changes.

---
id: '082'
slug: setup-lifecycle-epic
title: 'Epic: Setup lifecycle — auto-commit, auto-upgrade, and settings'
type: Feature
status: open
epic: setup-lifecycle
---

# Epic: Setup lifecycle — auto-commit, auto-upgrade, and settings

**Type:** Feature (epic)

**Goal:** Safeword should manage its own lifecycle automatically. After setup, files should be committed. When a new version is available, it should upgrade itself. Users should be able to configure these behaviors.

**Context:** Dogfooding on ArcadeAI/monorepo revealed that safeword creates friction in its own setup flow — generating ~53 files that trigger its LOC gate, requiring manual commits, and relying on users to know when to upgrade.

## Tickets

| ID      | Title                           | Status    | Depends On |
| ------- | ------------------------------- | --------- | ---------- |
| **074** | LOC gate exclude tooling files  | Code done | —          |
| **078** | Auto-commit after setup/upgrade | Open      | —          |
| **081** | Auto-upgrade on session start   | Open      | 078        |

## Settings (in `.safeword/config.json`)

```json
{
  "version": "0.26.1",
  "installedPacks": ["typescript", "python", "golang", "sql"],
  "autoCommit": true,
  "autoUpgrade": true
}
```

- `autoCommit` — commit safeword-generated files after setup/upgrade (default: `true`, opt-out: `--no-commit` flag or `false` in config)
- `autoUpgrade` — upgrade safeword on session start when newer version available (default: `true`)

## Sequencing

1. **074** (done) — Safety net: LOC gate ignores tooling files
2. **078** — Auto-commit after setup/upgrade, add `autoCommit` setting, clean up dead `pythonFiles`
3. **081** — Auto-upgrade on session start, add `autoUpgrade` setting, depends on 078 for committing upgrade output

## Related

- **075** (linter resilience) — not part of this epic but discovered in same dogfooding session
- **079** (architecture detection) — not part of this epic but complements setup flow
- **080** (ticket ID collisions) — infrastructure fix, independent

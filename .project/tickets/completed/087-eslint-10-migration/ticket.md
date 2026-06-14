---
id: 087
type: task
phase: intake
status: superseded
superseded_by: '099'
created: 2026-03-29T19:16:00Z
last_modified: 2026-03-29T19:16:00Z
---

# ESLint 9→10 Migration

**Goal:** Upgrade ESLint from v9 to v10 across the preset and dev tooling.

**Why:** ESLint 10 released Feb 2026. Staying on 9 blocks `@eslint/js` 10.x and future plugin updates.

## Blockers

6 plugins lack ESLint 10 peer dep support (as of 2026-03-29):

- `eslint-plugin-jsx-a11y` (caps at `^9`)
- `eslint-plugin-react` (caps at `^9.7`)
- `eslint-plugin-react-hooks` (caps at `^9.0.0`)
- `eslint-plugin-promise` (caps at `^9.0.0`)
- `eslint-plugin-vitest` (caps at `^9.0.0`)
- `@tanstack/eslint-plugin-query` (caps at `^9.0.0`)

## Breaking Changes to Address

- Legacy `.eslintrc` format removed (safeword already uses flat config)
- `context.getCwd()` → `context.cwd` (check custom rules)
- `eslint-env` comments now error (check templates)
- Node.js minimum: ^20.19.0 || ^22.13.0 || >=24
- Config discovery algorithm changed (starts from file, not cwd)

## Work Log

- 2026-03-29T19:31:00Z Note: bumped eslint-plugin-sonarjs to v4 and eslint-plugin-security to v4 — both already supported ESLint 10 peer dep, original 6 blockers unchanged
- 2026-03-29T19:16:00Z Created: from audit session — only major outdated dep

---

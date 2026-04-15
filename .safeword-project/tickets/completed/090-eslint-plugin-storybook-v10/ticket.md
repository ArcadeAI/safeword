---
id: 090
type: task
phase: done
status: done
created: 2026-03-29T19:16:00Z
last_modified: 2026-03-29T19:55:00Z
---

# Upgrade eslint-plugin-storybook 0.12→10

**Goal:** Upgrade eslint-plugin-storybook from v0.12.0 to v10.3.3.

**Why:** Plugin absorbed into Storybook monorepo. v0.12 archived Nov 2025. v10 aligns with Storybook 10, adds `storybook: '^10.3.3'` peer dep.

## Solution

Made storybook plugin conditional — only included when Storybook is detected in user's deps. This avoids peer dep warnings for non-Storybook users (majority of safeword users).

Changes:

- Added `hasStorybook()` detection to `detect.ts` (checks `storybook`, `@storybook/react`, etc.)
- Made storybook config conditional in ESLint template snippet
- Upgraded plugin from v0.12.0 to v10.3.3

## Work Log

- 2026-03-29T19:55:00Z Complete: conditional detection + upgrade, 288 tests pass
- 2026-03-29T19:46:00Z Research: v10 adds `storybook` peer dep (v0.12 had none). Option C (conditional) chosen.
- 2026-03-29T19:16:00Z Created: from audit — pinned at 0.12.0, latest is 10.3.3

---

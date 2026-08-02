---
id: 6F971C
slug: keep-developer-tooling-audit-clean
type: task
phase: done
status: done
created: 2026-07-25T03:56:24.832Z
last_modified: 2026-07-31T03:25:00.000Z
---

# Keep developer tooling audit clean

**Goal:** Remove confirmed audit hygiene findings and refresh safe tooling dependencies.

**Why:** Keeping the development toolchain secure and its audit signals trustworthy prevents known dependency risks and reduces noise that can hide real regressions.

## Work Log

- 2026-07-25T03:56:24.832Z Started: Created ticket 6F971C
- 2026-07-25T04:15:13.000Z Updated: Raised ESLint to 10.8.0, removed the stale Knip `which` ignore, and pinned patched `brace-expansion` and `fast-uri` releases; `bun audit` is clean.
- 2026-07-31T03:25:00.000Z Completed: Release review confirmed the dependency audit, Knip, lint, and architecture lanes remain clean.

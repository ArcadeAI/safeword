---
id: G2216W
slug: enforce-dogfood-parity-in-ci
type: patch
phase: verify
status: in_progress
created: 2026-07-25T15:05:01.091Z
last_modified: 2026-07-25T15:07:45Z
---

# Enforce dogfood parity in CI

**Goal:** Block pull requests when source templates and dogfood configuration drift.

**Why:** Prevent templates from shipping without matching repository configuration.

## Work Log

- 2026-07-25T15:07:45Z Verified: Focused CI-wiring test, release parity test, direct all-mode parity check, Prettier, ESLint, Gherkin lint, and TypeScript typecheck passed.
- 2026-07-25T15:06:02Z Implementing: Added a dedicated `dogfood-parity` CI job; the command is intentionally separate from release tests so it is visible as an independently required PR check.
- 2026-07-25T15:05:01Z Found: `bun scripts/parity-check.ts --fix` repaired two drifted dogfood mirrors: `.safeword/hooks/lib/lint.ts` and `.safeword/hooks/lib/host-toolchain.ts`.
- 2026-07-25T15:05:01.091Z Started: Created ticket G2216W

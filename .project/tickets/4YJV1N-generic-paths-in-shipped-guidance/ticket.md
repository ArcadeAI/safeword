---
id: 4YJV1N
slug: generic-paths-in-shipped-guidance
type: patch
phase: intake
status: in_progress
created: 2026-06-16T13:07:39.086Z
last_modified: 2026-06-16T13:07:39.086Z
---

# Use generic file paths in shipped guidance examples

**Goal:** Shipped guidance examples should cite generic `src/...` paths, not safeword's own `packages/cli/src/...` monorepo paths.

**Why:** Customer-facing instructions currently teach safeword's internal layout as the citation norm, which is confusing for flat or non-monorepo customer repos.

> Source: `PRODUCT-AUDIT-leakage.md` → Axis 1.

## Findings (file:line)

- `templates/SAFEWORD.md:190` — example: _"`packages/cli/src/auth.ts:42` was swallowing the refresh error."_
- `templates/SAFEWORD.md:205` — instruction: _"write `packages/cli/src/foo.ts:142` inline."_
- `templates/skills/tdd-review/SKILL.md:70` — _"implement minimum code in `packages/cli/src/lint.ts`."_

## Acceptance criteria

- [ ] All three replaced with generic placeholders (e.g. `src/auth.ts:42`).
- [ ] Quick scan confirms no other shipped template cites `packages/cli/...` as a customer example.

## Work Log

- 2026-06-16T13:07:39.086Z Started: Created ticket 4YJV1N

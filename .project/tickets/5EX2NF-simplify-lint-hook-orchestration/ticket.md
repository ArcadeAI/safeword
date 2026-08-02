---
id: 5EX2NF
slug: simplify-lint-hook-orchestration
type: task
phase: intake
status: in_progress
created: 2026-07-31T03:22:03.818Z
last_modified: 2026-07-31T03:22:03.818Z
---

# Make lint hook behavior easier to change safely

**Goal:** Split lint-file orchestration into focused helpers without changing hook behavior

**Why:** The current long orchestration function mixes detection execution and reporting concerns

**Scope:** Characterize `lintFile`, extract cohesive detection/execution/reporting
helpers, keep the standalone hook runtime boundary intact, and sync the template
to its dogfood mirror.

**Out of Scope:** New linters, new blocking behavior, changed diagnostics, or
changes to hook event wiring.

## Done When

- [ ] `lintFile` delegates to focused helpers with one responsibility each.
- [ ] Existing command selection, exit codes, diagnostics, and missing-tool behavior are unchanged.
- [ ] Template and installed mirror remain byte-for-byte in parity.

## Tests

- [ ] Expand characterization coverage before extraction.
- [ ] Run the lint hook unit, integration, parity, shell, and typecheck lanes.

## Work Log

- 2026-07-31T03:22:03.818Z Started: Created ticket 5EX2NF
- 2026-07-31T03:23:00.000Z Deferred: Release refactor review found the long orchestration function; a follow-up keeps the current release behavior-focused.

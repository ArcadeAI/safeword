---
id: 013e
type: task
phase: done
status: done
parent: '013'
created: 2025-01-09T11:45:00Z
last_modified: 2026-01-10T19:43:00Z
---

# Schema File Validation Command

**Goal:** Add a test that verifies schema ↔ template file integrity.

**Why:** Prevents orphaned files that exist in templates but never get installed, caught manually today during cleanup review.

## Requirements

1. **Internal dev tooling** (not customer-facing): Test file that runs with `npm test`
2. **Two-way validation**:
   - Template files → Schema: Every file in `templates/` has a `template:` reference
   - Schema → Template files: Every `template:` reference points to existing file
3. **CI integration**: Runs automatically with test suite

## Discovery Findings

- **Output:** Simple - just list failures, no auto-fix
- **Nested dirs:** Yes - recurse into `skills/*/`, `hooks/lib/`, etc.
- **Schema entry types:**
  - `{ template: 'path' }` → validate these (should have file)
  - `{ content: () => ... }` → skip (generated content)
  - `{ generator: () => ... }` → skip (dynamic generation)
- **Language packs:** Out of scope - all use generators, no template files
- **Implementation:** Test file (`tests/schema-validation.test.ts`)

## Work Log

- 2026-01-10 11:43 - Discovery complete, proceeding to scenarios

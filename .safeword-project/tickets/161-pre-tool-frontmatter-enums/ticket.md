---
id: 161
type: task
phase: intake
status: in_progress
created: 2026-05-18T05:41:00Z
last_modified: 2026-05-18T05:41:00Z
scope: |
  Extend `pre-tool-quality.ts` to validate ticket.md frontmatter on EVERY
  ticket.md edit (not just when test-definitions.md is being created). Checks:
  - `phase` is one of: intake | define-behavior | scenario-gate | decomposition
    | implement | verify | done
  - `status` is one of: in_progress | done | cancelled | superseded | wontfix
    | blocked
  - `type` is one of: patch | task | feature
  - type/phase coherence: type=patch with phase=scenario-gate is invalid;
    type=feature without phase=intake|define-behavior|... is invalid
  - Required fields present per type (features need scope/out_of_scope/done_when;
    patches can omit)
  Deny tool call with actionable message pointing at the spec.
out_of_scope: |
  - Retroactive validation of existing tickets (audit does that — ticket 159)
  - Adding new enum values to the schema (only enforce existing ones)
  - Auto-correcting frontmatter
done_when: |
  - pre-tool-quality.ts has new gate firing on ticket.md create/edit
  - Test added that asserts each enum violation is denied
  - Test asserts type/phase mismatch is denied
  - All existing 152+ tickets pass validation (or fix the violators)
  - Template sync: hook in `.safeword/` matches `packages/cli/templates/`
---

# Extend pre-tool-quality.ts: frontmatter enum + coherence validation

**Goal:** Catch invalid ticket frontmatter at write time, not when an unrelated downstream gate trips.

**Why:** The existing pre-tool-quality.ts checks scope/out_of_scope/done_when ONLY when test-definitions.md is being created. A user can write a ticket.md with `phase: "implementt"` (typo) or `status: "doing"` (invalid enum) and the hook says nothing — the bad state is only caught later, possibly never. Real-time prevention beats periodic /audit detection.

## Work Log

- 2026-05-18T05:41:00Z Started: ticket created from 152 audit-skill improvement debate

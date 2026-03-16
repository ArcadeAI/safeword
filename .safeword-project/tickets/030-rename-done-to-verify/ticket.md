---
id: 030
slug: rename-done-to-verify
type: feature
status: in_progress
phase: implement
---

# Rename /done to /verify with Dependency Drift Check

**Goal:** Replace the `/done` command with `/verify` — a self-documenting verb that proves a ticket meets its criteria. Add dependency drift detection (package.json vs ARCHITECTURE.md) to `/verify`. Require `/audit` evidence in the stop hook for done phase completion.

**Scope:**

- Rename `/done` command → `/verify` (hard cut, no alias)
- Rename `/done` skill file references in DONE.md and stop hook
- Update stop hook to require audit evidence pattern for done phase
- Add dependency drift check to `/verify`: flag deps in package.json not mentioned in ARCHITECTURE.md (and vice versa)
- `/verify` works without ticket context (just tests + build + lint)
- Update all references in templates, skills, commands, Cursor rules
- Update distributed templates and schema registration

**Out of scope:**

- Full doc staleness detection (stays in `/audit`)
- Semantic change detection (Option E pattern matching — future ticket if needed)
- Changes to `/audit` command itself
- Changes to quality gate hooks (LOC, refactor, phase gates unchanged)

**Context:** Design discussion in conversation — `/done` is an adjective pretending to be a verb. `/verify` is BDD-native (verification phase), self-documenting, and works both mid-implement and at done phase. See memory: `project_verify_command.md`.

## Work Log

- 2026-03-15T22:59Z Started: Ticket created from design discussion
- 2026-03-15T23:00Z Complete: Phase 0-2 - Context established from prior design discussion

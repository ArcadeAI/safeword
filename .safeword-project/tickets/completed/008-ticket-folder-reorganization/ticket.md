---
id: 008
type: feature
phase: done
status: done
parent: 001
created: 2026-01-07T16:36:00Z
last_modified: 2026-01-09T04:59:00Z
---

# Ticket/Artifact Folder Reorganization

**Goal:** Consolidate all project artifacts into `.safeword-project/` with ticket folders.

## Work Log

- 2026-01-08T05:00:00Z Follow-up: Created ticket 013d for BDD flow enforcement improvements (discovered during audit)
- 2026-01-09T01:31:00Z Complete: All template/guide path references updated (11 files)
- 2026-01-09T01:30:00Z Complete: Schema tests pass (5 tests for ownedDirs/preservedDirs/deprecatedDirs)
- 2026-01-09T01:29:00Z Complete: Updated schema.ts (ownedDirs, preservedDirs, deprecatedDirs)
- 2026-01-09T01:28:00Z Complete: Deleted stale .safeword/planning/ and .safeword/tickets/
- 2026-01-09T01:27:00Z Complete: Moved roadmap to backlog/
- 2026-01-09T01:26:00Z Complete: Migrated 13 issues to ticket folders, 4 test-definitions colocated, 1 spec colocated
- 2026-01-09T01:20:00Z Complete: BDD Phase 5 - Decomposed into 3 implementation tasks
- 2026-01-09T01:19:00Z Complete: BDD Phase 4 - User approved test definitions
- 2026-01-09T01:18:00Z Complete: BDD Phase 3 - Wrote 17 test definitions (4 suites)
- 2026-01-09T01:16:00Z Complete: BDD Phase 1-2 - Discovery questions answered (migrate now, delete linting, colocate test-defs)
- 2026-01-09T01:14:00Z Started: BDD Phase 0 - Read ticket, understood scope

## Decision Summary

1. **Ticket folders** (Option A) - colocate ticket + test-definitions + spec
2. **Remove `.safeword/planning/`** - CLI shouldn't manage project artifacts
3. **Single source of truth** - all project work lives in `.safeword-project/`

## Target Structure

### This Project (`.safeword-project/`)

```
.safeword-project/
├── tickets/                   # All work items
│   ├── 001-stateful-bdd-flow/
│   │   ├── ticket.md
│   │   ├── spec.md
│   │   └── test-definitions.md
│   ├── 006-phase-aware-quality/
│   │   ├── ticket.md
│   │   └── test-definitions.md
│   └── completed/             # Archive for done tickets
├── backlog/                   # Future ideas (not yet tickets)
├── tmp/                       # Non-work material (linting reviews, etc.)
└── guides/                    # Authoring guides (stays as-is)
```

### CLI Templates (what gets installed)

```
.safeword-project/
├── tickets/
│   └── completed/
└── tmp/                       # Scratch space for research, logs, etc.
```

No `backlog/` or `guides/` - those are project-specific.

## File Naming Convention

| File                  | Purpose                                   |
| --------------------- | ----------------------------------------- |
| `ticket.md`           | Ticket definition (frontmatter + content) |
| `test-definitions.md` | BDD scenarios (Given/When/Then)           |
| `spec.md`             | Feature spec for epics (optional)         |
| `design.md`           | Design doc for complex tickets (optional) |

## Changes Required

### 1. CLI Schema Changes

| Change                                                         | Location    |
| -------------------------------------------------------------- | ----------- |
| Remove `ownedDirs` entries for `.safeword/planning/*`          | `schema.ts` |
| Remove `preservedDirs` entry for `.safeword/tickets/completed` | `schema.ts` |
| Add `.safeword-project/tickets/completed` to `preservedDirs`   | `schema.ts` |
| Add `.safeword-project/tmp` to `preservedDirs`                 | `schema.ts` |

### 2. Template/Guide Updates

| File                        | Change                                                                                   |
| --------------------------- | ---------------------------------------------------------------------------------------- |
| `SAFEWORD.md`               | Update artifact paths: `.safeword/planning/*` → `.safeword-project/tickets/`, add `tmp/` |
| `planning-guide.md`         | Update all path references                                                               |
| `ticket-template.md`        | Update path reference                                                                    |
| BDD skill (SKILL.md + .mdc) | Update artifact paths                                                                    |
| `done.md` command           | Update glob patterns                                                                     |
| `stop-quality.ts` hook      | Already correct (uses `.safeword-project/issues/`) → update to `tickets/`                |

### 3. This Project Migration

| Action                          | Details                                                 |
| ------------------------------- | ------------------------------------------------------- |
| Create `tickets/`               | New folder structure                                    |
| Migrate `issues/*.md`           | Move to `tickets/{id}-{slug}/ticket.md`                 |
| Migrate `test-definitions/*.md` | Move to matching ticket folders                         |
| Migrate `specs/*.md`            | Move to epic ticket folders                             |
| Create `backlog/`               | For future ideas from `.safeword/planning/specs/`       |
| Create `tmp/`                   | Move linting reviews from `.safeword/planning/linting/` |
| Delete `.safeword/planning/`    | After migration complete                                |
| Delete `.safeword/tickets/`     | After migration complete                                |

### 4. Content Assessment (`.safeword/planning/`)

| Folder                     | Files | Action                               |
| -------------------------- | ----- | ------------------------------------ |
| `specs/roadmap-2025-12.md` | 1     | Keep in `backlog/` as reference      |
| `specs/feature-*.md`       | 5     | Delete (stale, pre-BDD)              |
| `specs/task-*.md`          | 2     | Delete (stale)                       |
| `test-definitions/`        | 5     | Delete (old format, replaced by BDD) |
| `design/`                  | 4     | Delete (stale)                       |
| `issues/lint-audit-*.md`   | 1     | Delete (marked FIXED)                |
| `linting/*.md`             | 19    | Move to `tmp/` as reference          |
| `plans/`                   | Empty | Delete                               |

## Out of Scope

- Changing BDD phases themselves
- Changing ticket metadata format (frontmatter stays same)
- Creating CLI commands for backlog/tmp management

## Acceptance Criteria

- [x] CLI schema: `.safeword/planning/*` removed from ownedDirs
- [x] CLI schema: `.safeword-project/tickets/completed` in preservedDirs
- [x] CLI schema: `.safeword-project/tmp` in preservedDirs
- [x] All path references updated in templates/guides
- [x] BDD skill uses `.safeword-project/tickets/` paths
- [x] This project: tickets migrated to folder structure
- [x] This project: stale planning content deleted
- [x] This project: linting reviews deleted (user chose delete over move to tmp/)
- [x] `issues/` and `test-definitions/` directories removed

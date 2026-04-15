---
id: 007
type: feature
phase: done
status: done
parent: 001
created: 2026-01-07T06:16:00Z
last_modified: 2026-01-07T17:50:00Z
---

# Iteration 6: Implementation Phases (5-7)

**Goal:** Complete BDD workflow with robust implementation phases - technical decomposition, outside-in TDD guidance, and done gate with comprehensive audit.

**Parent Epic:** 001-stateful-bdd-flow

## Stories Covered

From parent spec (Stories 6, 7, 8, 11 partial):

- **Story 6:** Phase 5 - Technical Decomposition
- **Story 7:** Phase 6 - Outside-In TDD Implementation
- **Story 8:** Phase 7 - Done Gate with verification
- **Story 11:** Command structure (partial - `/audit` expansion)

## Scope

**In Scope:**

1. **Expand `/audit` command** to include documentation drift checks:
   - Architecture docs match code (absorbs current `/drift`)
   - Agent instructions match workflow (AGENTS.md, skills, commands)
   - README is current
   - Keep existing: dead code, duplication, outdated deps, architecture violations

2. **Delete `/drift` command** - functionality merged into `/audit`

3. **BDD Skill Phase 5 enrichments:**
   - Design doc reference for complex features (3+ components)

4. **BDD Skill Phase 6 enrichments:**
   - Outside-in TDD layering clarity (E2E first → unit/integration with mocks)
   - Test fixture creation guidance

5. **BDD Skill Phase 7 enrichments:**
   - Holistic refactor table (cross-scenario cleanup)
   - Scenario tagging guidance (@smoke, @regression)
   - Flake detection guidance (run 3x, no flakes)
   - Reference expanded `/audit` instead of separate `/verify`

**Out of Scope:**

- Changes to Phase 0-4 (already complete)
- New hook behaviors (done phase hard block already implemented)
- Decomposition thresholds (already documented)
- `/verify` as separate command (merged into `/audit`)

## Discovery Notes

- `/drift` absorbed into `/audit` - single comprehensive health check
- No deprecation needed - no user base yet, just delete `/drift`
- `/audit` becomes the one command for Phase 7 "is everything clean?"

## Implementation Considerations

1. **Schema registration** - need to add expanded `/audit` checks to schema.ts, remove `/drift` from schema
2. **Tests** - existing `/drift` tests need migration to `/audit` tests
3. **BDD skill syncing** - changes to template need sync to `.claude/`, `.cursor/`, `.safeword/` copies
4. **Edge cases:**
   - ARCHITECTURE.md doesn't exist → Create or skip (same as current `/drift` behavior)
   - Skills/commands don't match workflow → Report drift, don't auto-fix (user decides)
   - README staleness → Check last modified date vs recent commits, flag if stale

## Task Breakdown

| #   | Task                             | Files               | Status |
| --- | -------------------------------- | ------------------- | ------ |
| 1   | Delete `/drift` command          | drift.md (3 copies) | [x]    |
| 2   | `/audit` report format           | audit.md (3 copies) | [x]    |
| 3   | `/audit` agent config checks     | audit.md (same)     | [x]    |
| 4   | `/audit` project docs checks     | audit.md (same)     | [x]    |
| 5   | BDD Phase 6: outside-in guidance | SKILL.md (3 copies) | [x]    |
| 6   | BDD Phase 6: fixture guidance    | SKILL.md (same)     | [x]    |
| 7   | BDD Phase 7: refactor table      | SKILL.md (same)     | [x]    |
| 8   | BDD Phase 7: flake detection     | SKILL.md (same)     | [x]    |
| 9   | BDD Phase 7: scenario tagging    | SKILL.md (same)     | [x]    |

## Work Log

---

- 2026-01-07T17:50:00Z Phase 7: Done gate complete, all scenarios verified
- 2026-01-07T17:45:00Z Phase 6: All tasks complete - synced to .claude/, .cursor/
- 2026-01-07T16:35:00Z Phase 5: Task breakdown complete (8 tasks)
- 2026-01-07T06:25:00Z Discovery: Decided to merge /drift into /audit, delete /drift
- 2026-01-07T06:16:00Z Created: Ticket for Iteration 6 (Stories 6, 7, 8)

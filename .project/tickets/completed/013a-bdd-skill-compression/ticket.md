---
id: '013a'
title: BDD skill compression and phase-based splitting
type: feature
status: done
phase: done
priority: medium
created: 2026-01-08
parent: '013'
last_modified: 2026-01-10
---

# BDD Skill Compression

## Problem

The BDD skill is 630 lines—too large for optimal LLM performance. Additionally, SAFEWORD.md (380 lines) has content overlap with the BDD skill, violating progressive disclosure.

## Solution: Phase-Based File Structure + Skill Delegation + SAFEWORD Cleanup

Split the monolithic skill into focused, phase-specific files that load on demand. Remove duplication from SAFEWORD.md.

---

## Part 1: SAFEWORD.md Cleanup

### 1.1 Delete "Feature Development" Section

**26 lines of duplication.** This section partially explains BDD flow, but:

- BDD skill has complete phase documentation
- Work Level Detection already routes to `/bdd`
- Violates "each fact stated exactly once" principle

**Action:** Delete entirely.

### 1.2 Add Resumption Pre-Check to Work Level Detection

**Gap found:** Work Level Detection classifies NEW work but doesn't handle EXISTING work (resumption).

User says "resume ticket 003" → tree falls through to "task" even if ticket is type:feature.

**Add 2 lines at top of Work Level Detection:**

```markdown
**Resuming existing work?** If user references a ticket ID/slug or says "resume"/"continue":
→ Read ticket, use its `type:` field (feature/task/patch) instead of this tree.
```

### 1.3 Modify Work Level Detection Announcements

Current announcements describe output text AND actions. Simplify to explicit skill invocation:

**Before:**

```markdown
- **feature:** "Feature. Defining behaviors first. `/tdd` to override." → BDD phases (0-7), TDD inline at Phase 6
```

**After:**

```markdown
- **feature:** "Feature. `/tdd` to override." → Run `/bdd`
```

### 1.4 Update BDD Skill Description (Defense-in-Depth)

Add 'resume', 'continue', 'ticket' to trigger words:

**Before:**

```yaml
description: ...Use when user says 'add', 'implement', 'build', 'feature', 'iteration', 'story', 'phase', or references an iteration/story from a spec...
```

**After:**

```yaml
description: ...Use when user says 'add', 'implement', 'build', 'feature', 'iteration', 'story', 'phase', 'resume', 'continue', or references a ticket/iteration/story...
```

### SAFEWORD.md Net Change

| Change                       | Lines                |
| ---------------------------- | -------------------- |
| Delete "Feature Development" | -26                  |
| Add resumption pre-check     | +2                   |
| Modify announcements         | +0 (same line count) |
| **Net**                      | **-24 lines**        |

---

## Part 2: BDD Skill Phase-Based Splitting

### Refactoring Delegation

**Remove Phase 6.3 REFACTOR content entirely.** Delegate all refactoring to `/refactor` skill:

| Phase        | Current                                          | Change                                                  |
| ------------ | ------------------------------------------------ | ------------------------------------------------------- |
| 6.3 REFACTOR | 28 lines inline (smells table, protocol, revert) | Replace with: "Run `/refactor` for cleanup after GREEN" |
| 7 Done Gate  | Already says "run /refactor"                     | Keep as-is                                              |

**Line savings:** ~25 lines removed from SKILL.md

### Claude Code Structure (Phase-Based References)

```text
.claude/skills/safeword-bdd-orchestrating/
├── SKILL.md           (~150 lines) - Core dispatch, phase overview, resume logic
├── DISCOVERY.md       (~50 lines)  - Phase 0-2 (intake, context, stories)
├── SCENARIOS.md       (~40 lines)  - Phase 3-4 (Given/When/Then, quality gate)
├── DECOMPOSITION.md   (~35 lines)  - Phase 5 (task breakdown)
├── TDD.md             (~70 lines)  - Phase 6 (RED/GREEN, delegate /refactor)
├── DONE.md            (~30 lines)  - Phase 7 (completion checklist)
└── SPLITTING.md       (~40 lines)  - Split protocol (thresholds, examples)
```

Claude Code supports on-demand file references (one level deep). Main SKILL.md dispatches to phase files.

### Cursor Structure (Progressive Disclosure)

```text
.cursor/rules/
├── bdd-core.mdc          (~90 lines)  - Dispatch, phases, resume, WHEN to split table
├── bdd-discovery.mdc     (~50 lines)  - Phase 0-2
├── bdd-scenarios.mdc     (~40 lines)  - Phase 3-4
├── bdd-decomposition.mdc (~35 lines)  - Phase 5
├── bdd-tdd.mdc           (~70 lines)  - Phase 6 (RED/GREEN only, REFACTOR delegates)
├── bdd-done.mdc          (~30 lines)  - Phase 7
└── bdd-splitting.mdc     (~40 lines)  - HOW to split (protocol, examples)
```

All files under 100 lines. Agent loads phase-specific rules based on descriptions.

### Description Patterns for Reliable Loading

| File                    | Description                                                                                             |
| ----------------------- | ------------------------------------------------------------------------------------------------------- |
| `bdd-core.mdc`          | "USE WHEN starting feature work, running /bdd, or resuming a BDD ticket. Orchestrates BDD phases."      |
| `bdd-discovery.mdc`     | "USE WHEN in BDD intake phase OR ticket has phase: intake. Guides discovery and context gathering."     |
| `bdd-scenarios.mdc`     | "USE WHEN in BDD define-behavior or scenario-gate phase. Guides Given/When/Then creation."              |
| `bdd-decomposition.mdc` | "USE WHEN in BDD decomposition phase. Guides task breakdown and component analysis."                    |
| `bdd-tdd.mdc`           | "USE WHEN in BDD implement phase. RED/GREEN cycle; run /refactor after GREEN."                          |
| `bdd-done.mdc`          | "USE WHEN in BDD done phase OR all scenarios marked [x]. Completion checklist."                         |
| `bdd-splitting.mdc`     | "USE WHEN BDD thresholds exceeded (2+ stories, >15 scenarios, >20 tasks). Split protocol and examples." |

---

## Expected Outcome

### SAFEWORD.md

| Metric               | Before                    | After           |
| -------------------- | ------------------------- | --------------- |
| Lines                | 380                       | ~356            |
| Duplication with BDD | Yes (Feature Development) | No              |
| Resumption handling  | Missing                   | Pre-check added |

### BDD Skill (Cursor)

| Metric           | Before        | After                   |
| ---------------- | ------------- | ----------------------- |
| Files            | 1 (628 lines) | 7 (all under 100 lines) |
| Tokens per phase | ~600 lines    | ~90-160 lines           |
| Under 100 lines  | No            | Yes (all files)         |

### BDD Skill (Claude Code)

| Metric            | Before        | After                              |
| ----------------- | ------------- | ---------------------------------- |
| Files             | 1 (630 lines) | 7 (SKILL.md ~150 + 6 phase files)  |
| SKILL.md lines    | 630           | ~150                               |
| Phase files       | N/A           | All under 100 lines                |
| On-demand loading | No            | Yes (phase files load when needed) |

---

## Files to Create/Modify

### Modify (SAFEWORD Cleanup)

1. `packages/cli/templates/SAFEWORD.md`
   - Delete "Feature Development" section (between Work Level Detection and Self-Testing)
   - Add resumption pre-check (2 lines at top of Work Level Detection)
   - Update announcements to explicit skill invocation

2. `packages/cli/templates/skills/safeword-bdd-orchestrating/SKILL.md`
   - Update description with 'resume', 'continue', 'ticket' triggers

### New Claude Code Files (in `packages/cli/templates/skills/safeword-bdd-orchestrating/`)

1. `DISCOVERY.md` - Phase 0-2
2. `SCENARIOS.md` - Phase 3-4
3. `DECOMPOSITION.md` - Phase 5
4. `TDD.md` - Phase 6
5. `DONE.md` - Phase 7
6. `SPLITTING.md` - Split protocol

### New Cursor Files (in `packages/cli/templates/cursor/rules/`)

1. `bdd-core.mdc`
2. `bdd-discovery.mdc`
3. `bdd-scenarios.mdc`
4. `bdd-decomposition.mdc`
5. `bdd-tdd.mdc`
6. `bdd-done.mdc`
7. `bdd-splitting.mdc`

### Modify (Schema)

1. `packages/cli/src/schema.ts` (register all new files)

### Delete

1. `packages/cli/templates/cursor/rules/safeword-bdd-orchestrating.mdc` (replaced by split files)

---

## Minor Consolidation (During Implementation)

- Remove Given/When/Then format details from `planning-guide.md` (~20 lines) - BDD skill Phase 3 covers scenario drafting

---

## Acceptance Criteria

### SAFEWORD.md Cleanup

- [ ] "Feature Development" section deleted
- [ ] Resumption pre-check added to Work Level Detection
- [ ] Announcements use explicit skill invocation ("Run `/bdd`")
- [ ] No duplication between SAFEWORD.md and BDD skill

### BDD Skill Description

- [ ] Description includes 'resume', 'continue', 'ticket' triggers

### BDD Skill Splitting

- [ ] Claude Code SKILL.md under 200 lines (dispatcher only)
- [ ] Claude Code phase files all under 100 lines
- [ ] All Cursor rules under 100 lines
- [ ] Phase 6.3 replaced with `/refactor` invocation (both platforms)
- [ ] Phase 7 runs `/refactor` for cross-scenario cleanup (both platforms)
- [ ] Verify `/refactor` skill activates when called from BDD flow

### Schema & Parity

- [ ] Schema updated with all new files (6 Claude + 7 Cursor)
- [ ] Given/When/Then format removed from planning-guide.md
- [ ] Parity test: Claude and Cursor have equivalent content

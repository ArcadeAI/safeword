---
id: '013c'
title: Consolidate TDD content between testing guide and BDD skill
type: feature
status: done
priority: medium
created: 2026-01-08
parent: '013'
---

# Testing Guide Consolidation

## Problem

TDD content is duplicated between testing-guide.md (440 lines) and BDD skill (630 lines):

| Content                  | Testing Guide | BDD Skill     | Lines    |
| ------------------------ | ------------- | ------------- | -------- |
| TDD workflow (RED→GREEN) | Lines 116-168 | Lines 223-319 | ~50 each |
| Red flags table          | Lines 128-134 | Lines 232-239 | ~7 each  |
| Mock anti-pattern        | Lines 143-158 | Lines 268-285 | ~15 each |

**Maintenance burden:** Changes to TDD best practices require updating two places. Risk of drift.

## Analysis

Different user journeys justify some redundancy:

| Work type              | Entry point                    | TDD source |
| ---------------------- | ------------------------------ | ---------- |
| Patch/task (1-2 files) | SAFEWORD.md → testing-guide.md | Guide      |
| Feature (3+ files)     | BDD skill auto-activates       | Skill      |

But identical code examples and tables should exist in ONE canonical location.

## Solution

**Canonical source:** BDD skill owns detailed TDD workflow (it's operational, phase-embedded).

**Testing guide keeps:**

- Test philosophy, test integrity (NEVER skip)
- Test type selection matrix
- Bug detection matrix
- AAA pattern, naming, fixtures
- E2E port isolation
- LLM eval costs
- **Minimal operational TDD for tasks (~20 lines)**

**Testing guide removes:**

- Detailed RED/GREEN/REFACTOR phases with verification gates (→ BDD skill)
- Red flags table (→ BDD skill)
- Mock anti-pattern code example (→ BDD skill)
- Walking skeleton section (→ BDD skill)

**Testing guide adds:**

TDD Quick Reference section for task-level work:

```markdown
## TDD Quick Reference (Tasks)

For tasks (1-2 files), follow this cycle:

1. **RED** - Write one failing test for the expected behavior
2. **GREEN** - Write minimum code to pass the test
3. **REFACTOR** - Clean up, run `/refactor` if needed

Commit after each GREEN phase.

### Escalation Check

If during implementation you discover:

- 3+ files need changes, OR
- Multiple user flows affected, OR
- New state management needed

**Stop and escalate:** "This is bigger than expected. Switching to `/bdd` for proper behavior definition."

For full TDD with verification gates, walking skeleton, and phase orchestration,
start feature work or run `/bdd` - the BDD skill provides detailed guidance.
```

## Expected Outcome

| Metric               | Before    | After     |
| -------------------- | --------- | --------- |
| Testing guide lines  | 440       | ~280      |
| Duplicated content   | ~70 lines | 0         |
| Canonical TDD source | Ambiguous | BDD skill |

## Files to Modify

1. `.safeword/guides/testing-guide.md` (consolidate)
2. `packages/cli/templates/guides/testing-guide.md` (same changes)

## Acceptance Criteria

- [ ] Testing guide under 300 lines
- [ ] No duplicated code examples between guide and skill
- [ ] Guide references BDD skill for full TDD workflow
- [ ] Both files (installed + template) updated

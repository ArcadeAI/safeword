# BDD Skill vs Guides: Duplication & Misalignment Report

## Executive Summary

The BDD skill (`SKILL.md`) and guides folder contain **significant overlap** in TDD/BDD workflow content. The key issue: **three documents describe the same BDD→TDD workflow** at different levels of detail, creating maintenance burden and potential for drift.

**Key finding:** `bdd-concept.md` is unreferenced anywhere in the codebase and should be deleted.

---

## Documents Analyzed

| Document          | Location                                                            | Lines | Purpose                               |
| ----------------- | ------------------------------------------------------------------- | ----- | ------------------------------------- |
| BDD Skill         | `packages/cli/templates/skills/safeword-bdd-orchestrating/SKILL.md` | 630   | Active skill for LLM orchestration    |
| BDD Concept Guide | `.safeword-project/guides/bdd-concept.md`                           | 782   | Theory & comprehensive workflow       |
| Testing Guide     | `.safeword/guides/testing-guide.md`                                 | 440   | TDD methodology & test types          |
| Planning Guide    | `.safeword/guides/planning-guide.md`                                | 432   | Specs, user stories, test definitions |

---

## 🔴 DUPLICATIVE Content (Same Information, Multiple Places)

### 1. TDD RED→GREEN→REFACTOR Workflow

**Found in 3 places with nearly identical content:**

| Location                           | Coverage                             |
| ---------------------------------- | ------------------------------------ |
| `SKILL.md` (lines 223-318)         | Full TDD cycle in Phase 6            |
| `testing-guide.md` (lines 116-168) | Full TDD cycle as standalone section |
| `bdd-concept.md` (lines 379-448)   | TDD micro-loop explanation           |

**Specific duplications:**

- Red flags table (test passes immediately, syntax error, wrote implementation, multiple tests)
- Anti-pattern: Mock implementations example (same code snippet in SKILL.md and testing-guide.md)
- REFACTOR rules (tests pass before/after, one change at a time)

**Example - Same mock implementation warning in both:**

```typescript
// ❌ BAD - Hardcoded to pass test
function calculateDiscount(amount, tier) {
  return 80; // Passes test but isn't real
}
```

This exact example appears in both `SKILL.md:273-285` and `testing-guide.md:147-158`.

### 2. BDD Phase Structure

**Found in 2 places:**

| Location         | Phases Defined                                                                        |
| ---------------- | ------------------------------------------------------------------------------------- |
| `SKILL.md`       | 6 phases: intake → define-behavior → scenario-gate → decomposition → implement → done |
| `bdd-concept.md` | 10 phases (0-10): Adds release readiness, post-release verification                   |

**Misalignment:** `bdd-concept.md` has 3 extra phases (8-10) that `SKILL.md` doesn't track.

### 3. Scenario Quality Criteria

**Found in 2 places with same criteria:**

| Criterion     | SKILL.md:139-145 | bdd-concept.md:179-186 |
| ------------- | ---------------- | ---------------------- |
| Atomic        | ✓                | ✓                      |
| Observable    | ✓                | ✓                      |
| Deterministic | ✓                | ✓                      |

Same table, different formatting.

### 4. Given/When/Then Scenario Format

**Found in 3 places:**

| Location                  | Context                   |
| ------------------------- | ------------------------- |
| `SKILL.md:122-129`        | Phase 3 scenario drafting |
| `bdd-concept.md:30-36`    | BDD example               |
| `planning-guide.md:74-94` | User story format section |

---

## 🟡 MISALIGNED Content (Different Information, Should Be Consistent)

### 1. Phase Count Mismatch

| Document         | Phases    | Final Phase                             |
| ---------------- | --------- | --------------------------------------- |
| `SKILL.md`       | 6 phases  | "Done Gate"                             |
| `bdd-concept.md` | 10 phases | "Post-release Verification and Closure" |

**Resolution:** Done Gate is the right boundary for the skill. Release management is out of scope.

### 2. Discovery Phase Depth

| Document         | Discovery Approach                         |
| ---------------- | ------------------------------------------ |
| `SKILL.md`       | 5 rounds max, PM-style questions           |
| `bdd-concept.md` | More structured: 3 Amigos, Example Mapping |

**SKILL.md mentions:**

- Round 1: User experience
- Round 2: Failure modes
- Round 3: Boundaries
- Round 4: Scenarios
- Round 5: Stakeholder regret

**bdd-concept.md mentions:**

- 3 Amigos kickoff (Product + Eng + QA)
- Example mapping (Rules, Examples, Questions)
- Domain glossary

### 3. Pre-BDD Steps

| Document         | Pre-BDD Steps                                                                                |
| ---------------- | -------------------------------------------------------------------------------------------- |
| `SKILL.md`       | Context check (goal/scope) only                                                              |
| `bdd-concept.md` | 6 steps: Intake, Problem Framing, Success Definition, Scope Box, Baseline, Feasibility, Prep |

**bdd-concept.md has much more rigorous pre-work** that the skill doesn't enforce.

### 4. Decomposition Thresholds

**SKILL.md defines specific thresholds (lines 404-417):**

- Entry: 2+ user stories OR vague scope
- Phase 3: >15 scenarios OR 3+ distinct clusters
- Phase 5: >20 tasks OR 5+ major components
- Phase 6: >10 tests per slice
- TDD Loop: >5 unit tests for single E2E

**bdd-concept.md has no numeric thresholds** - just general guidance.

### 5. Test Layer Strategy

| Document                 | Test Layering                                        |
| ------------------------ | ---------------------------------------------------- |
| `SKILL.md:197-205`       | Outside-in: E2E → Integration → Unit                 |
| `testing-guide.md:43-56` | Speed hierarchy: Unit → Integration → LLM Eval → E2E |

**Clarification:** These serve different purposes:

- **SKILL.md outside-in** = order of _writing tests_ during BDD feature development
- **testing-guide.md speed hierarchy** = which _test type to choose_ for catching a bug

Not a true conflict.

---

## 🟢 COMPLEMENTARY Content (Different But Not Conflicting)

### 1. Testing Guide Unique Content

- Test type decision tree (lines 59-83)
- Bug detection matrix (lines 95-111)
- LLM evaluation examples (lines 222-234)
- E2E with persistent dev servers (lines 237-275)
- Cost considerations for LLM evals (lines 392-405)

### 2. Planning Guide Unique Content

- INVEST validation checklist (lines 113-124)
- User story formats (Standard, Given-When-Then, Job Story)
- Size guidelines table (lines 146-154)
- Technical constraints section (lines 159-179)

### 3. BDD Concept Guide Unique Content

- Team/stakeholder coordination (3 Amigos)
- Release readiness phases (9-10)
- Post-release verification loop
- Operational follow-through

---

## Consolidation Analysis

### Constraints from Skill Authoring Guide

1. **Skills must be self-contained** - progressive disclosure only allows references _within_ the skill folder, not to external guides
2. **Size limit: 500 lines** - current BDD skill is 630 lines (over limit)
3. **Conciseness matters** - "Claude is already smart. Only add context it doesn't have."

### Constraints from LLM Writing Guide

1. **MECE** - each doc should have clear, non-overlapping purpose
2. **No contradictions** - different sections must align
3. **Recency bias** - critical rules at END of documents

### Recommendation: Scope Separation

| Document            | Purpose                                    | Action                                            |
| ------------------- | ------------------------------------------ | ------------------------------------------------- |
| `SKILL.md`          | Operational (what to do now)               | Keep self-contained, compress to <500 lines       |
| `bdd-concept.md`    | Unreferenced, duplicative                  | **DELETE**                                        |
| `testing-guide.md`  | Reference (test types, selection, tools)   | Remove BDD-specific workflow (that's skill's job) |
| `planning-guide.md` | Reference (specs, stories, test def files) | Keep as-is (complementary, not duplicative)       |

---

## Action Items

1. **Delete `bdd-concept.md`** - unreferenced, 782 lines of content that duplicates the skill

2. **Compress SKILL.md to <500 lines** - per ticket 013-bdd-skill-compression

3. **Remove TDD workflow section from testing-guide.md** - keep only test type selection, examples, and tooling. TDD workflow is the skill's responsibility.

4. **Add clarifying note to testing-guide.md** about test layering strategies (speed hierarchy vs outside-in) being for different contexts

---

## Related

- [013-bdd-skill-compression.md](./../issues/013-bdd-skill-compression.md) - covers the SKILL.md compression work

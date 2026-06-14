---
id: 013d
type: task
phase: done
status: done
parent: '013'
created: 2026-01-08T05:00:00Z
last_modified: 2026-01-08T05:00:00Z
---

# BDD Flow Enforcement Improvements

**Goal:** Ensure LLMs maintain ticket state and work logs throughout BDD workflow execution.

**Why:** During ticket 008 implementation, the agent completed all BDD phases and implementation work but failed to update the ticket's phase/status fields or maintain the work log. An audit was required to discover this gap.

## Problem Statement

The BDD skill (`safeword-bdd-orchestrating`) guides the agent through phases 0-7, but:

1. **No explicit checkpoint steps** - The skill doesn't require updating ticket frontmatter at phase transitions
2. **Work log maintenance is implicit** - Instructions mention it but don't enforce it
3. **Done gate bypass possible** - Agent can mark `status: done` without evidence from `/done` command

## Proposed Solution

### 1. BDD Skill Phase Exit Checkpoints

Add explicit exit checkpoint to each phase. Granularity varies by phase structure:

#### Phase 0-2 (Context/Discovery)

Keep prose (branching paths), add exit checkpoint:

```markdown
### Phase 0-2 Exit (REQUIRED)

Before proceeding to Phase 3:

1. Verify ticket exists: `.safeword-project/tickets/{id}-{slug}/ticket.md`
2. Update frontmatter: `phase: define-behavior`
3. Add work log: `- {timestamp} Complete: Phase 0-2 - Context established`
```

#### Phase 3 (Define Behavior)

Add numbered sub-steps (sequential work):

```markdown
### 3.1 Draft Scenarios

1. Read spec goal/scope
2. Draft Given/When/Then (happy path, failures, edges)
3. Present to user, iterate until approved

### 3.2 Save & Exit (REQUIRED)

1. Save to `.safeword-project/tickets/{id}-{slug}/test-definitions.md`
2. Update frontmatter: `phase: scenario-gate`
3. Add work log: `- {timestamp} Complete: Phase 3 - {N} scenarios defined`
```

#### Phase 4 (Scenario Gate)

Keep as checklist (single validation pass), add exit checkpoint:

```markdown
### Phase 4 Exit (REQUIRED)

Before proceeding to Phase 5:

1. Each scenario validated (Atomic, Observable, Deterministic)
2. Issues reported or confirmed clean
3. Update frontmatter: `phase: decomposition`
4. Add work log: `- {timestamp} Complete: Phase 4 - Scenarios validated`
```

#### Phase 5 (Decomposition)

Keep existing 4 steps, add exit checkpoint:

```markdown
### Phase 5 Exit (REQUIRED)

Before proceeding to Phase 6:

1. Task breakdown documented in ticket
2. Update frontmatter: `phase: implement`
3. Add work log: `- {timestamp} Complete: Phase 5 - Decomposed into {N} tasks`
```

#### Phase 6 (TDD)

Already well-structured with 6.1-6.4 sub-steps and commit discipline. No changes needed.

#### Phase 7 (Done Gate)

Already delegates to `/done`. No changes to skill needed.

### 2. Layered Hook Enforcement (Cumulative Artifact Checks)

**Goal:** Catch problems early by checking cumulative requirements, not per-phase.

**Core insight:** If agent claims phase X, all artifacts from phases < X must exist.

#### Cumulative Requirements by Type

**Features (`type: feature`):**

| Claimed Phase   | Required Artifacts (cumulative) |
| --------------- | ------------------------------- |
| intake          | ticket.md                       |
| define-behavior | ticket.md (writing test-defs)   |
| scenario-gate+  | ticket.md + test-definitions.md |
| done            | Above + /done evidence          |

**Tasks (`type: task`):**

| Claimed Phase | Required Artifacts (cumulative) |
| ------------- | ------------------------------- |
| intake        | ticket.md                       |
| implement     | ticket.md (skip BDD phases)     |
| done          | Above + /done evidence          |

Tasks skip define-behavior → decomposition phases. They go directly from intake → implement.

**Patches (`type: patch`):**

No enforcement. Patches are trivial changes that may not even need tickets.

**Debugging (`subtype: bug-investigated`):**

For complex bugs requiring investigation (used `/debug` skill):

| Claimed Phase | Required Artifacts (cumulative)       |
| ------------- | ------------------------------------- |
| investigating | ticket.md                             |
| implementing  | ticket.md + Root Cause section filled |
| done          | Above + regression test + tests pass  |

**Simple bugs** (`type: task` without investigation): Same as regular tasks.

**Why separate debugging enforcement?**

- Investigation-first discipline prevents symptom fixes
- Root cause documentation captures learning
- Regression tests prevent bug recurrence
- Aligns with BDD/refactoring "discover before implement" philosophy

#### Layer 1: Stop Hook (Cumulative Check)

On every stop, verify cumulative artifacts exist for claimed phase:

```typescript
// In stop-quality.ts
const FEATURE_PHASE_ORDER = [
  'intake',
  'define-behavior',
  'scenario-gate',
  'decomposition',
  'implement',
  'done',
];

function getCumulativeRequirements(
  phase: BddPhase,
  ticketDir: string,
  ticketType: string,
): Check[] {
  // Patches: no enforcement
  if (ticketType === 'patch') return [];

  const checks: Check[] = [];

  // All types need ticket.md
  checks.push({ file: `${ticketDir}/ticket.md`, message: 'Missing ticket.md' });

  // Features: test-definitions.md required at scenario-gate+
  if (ticketType === 'feature') {
    const phaseIndex = FEATURE_PHASE_ORDER.indexOf(phase);
    if (phaseIndex >= 2) {
      checks.push({
        file: `${ticketDir}/test-definitions.md`,
        message: 'Missing test-definitions.md',
      });
    }
  }

  // Tasks: no additional artifacts (inline tests in ticket.md)

  // Bug-investigated: require Root Cause section in ticket.md (at implementing+)
  // Note: Content check would require reading file, keep simple for now

  return checks;
}

// Soft block if cumulative requirements not met
for (const req of getCumulativeRequirements(currentPhase, ticketDir, ticketType)) {
  if (!existsSync(req.file)) {
    softBlock(`Phase ${currentPhase} requires: ${req.message}`);
  }
}
```

**Behavior:** Soft block - prompts agent to create missing artifacts.

#### Layer 2: Done Gate (Hard Block)

Evidence requirements vary by type:

| Type    | Required Evidence                             |
| ------- | --------------------------------------------- |
| feature | `✓ X/X tests pass` + `All N scenarios marked` |
| task    | `✓ X/X tests pass` only                       |
| patch   | `✓ X/X tests pass` only (if ticket exists)    |

```typescript
if (currentPhase === 'done') {
  const hasTestEvidence = /✓\s*\d+\/\d+\s*tests?\s*pass/i.test(combinedText);
  const hasScenarioEvidence = /all\s+\d+\s+scenarios?\s+marked/i.test(combinedText);

  if (ticketType === 'feature') {
    // Features need both test pass and scenarios complete
    if (!hasTestEvidence || !hasScenarioEvidence) {
      hardBlockDone('Feature requires: tests pass + scenarios complete. Run /done.');
    }
  } else {
    // Tasks and patches just need tests pass
    if (!hasTestEvidence) {
      hardBlockDone('Tests must pass before marking done. Run /done.');
    }
  }
}
```

#### Why Cumulative?

- **Catches skipped phases:** Agent claims `implement` but never created test-definitions.md → blocked
- **Catches stale phase field:** Agent did work but forgot to update phase → artifacts missing for claimed phase
- **Simple to implement:** Just file existence checks, no content parsing

### 3. TDD Cycle Enforcement (Skill Checkpoint Only)

**Problem:** Agent can skip 6.3 REFACTOR and go directly to 6.4 Mark.

**Solution:** Update BDD skill Phase 6.4 with explicit checkpoint:

```markdown
#### 6.4 Mark & Iterate

Before marking scenario complete:

1. **Confirm refactor status** (say one of these):
   - "Refactored: [what improved]" + show refactor commit
   - "No refactoring needed: code is clean"
2. Mark scenario `[x]` in test-definitions
3. Return to 6.1 for next scenario
```

**Why no hook enforcement?**

- Commit pattern matching is fragile and complex
- Refactor can legitimately be skipped
- Skill checkpoint + quality review prompts are sufficient
- Hooks should enforce artifacts, not process steps

## Acceptance Criteria

- [x] BDD skill has explicit checkpoint steps at each phase exit
- [x] Checkpoint steps require: frontmatter update + work log entry
- [x] BDD skill Phase 6.4 requires refactor confirmation before marking
- [x] Stop hook checks cumulative artifact requirements
- [x] Stop hook soft-blocks when artifacts missing for claimed phase
- [x] Done gate: features require tests pass + scenarios complete
- [x] Done gate: tasks/patches require tests pass only
- [x] Debugging skill requires root cause doc before fix (skill update)
- [x] Bug-investigated tickets require regression test before done (via debugging skill Phase 4)

## Implementation Order

1. **Update BDD skill** with phase exit checkpoints
2. **Update BDD skill Phase 6.4** with refactor confirmation checkpoint
3. **Update debugging skill** with root cause checkpoint before Phase 4
4. **Enhance stop-quality.ts** with cumulative artifact checks
5. **Update task-spec-template.md** with required Root Cause section for bugs

## Out of Scope

- Changing the BDD phases themselves
- PostToolUse hooks (fires too often, after-the-fact)
- Git hooks (affects humans too)

**Note:** Done gate evidence requirements now vary by type. This modifies existing `/done` behavior to be type-aware.

## Related

- Ticket 008: Discovered the flow compliance gap
- Ticket 013a: BDD skill restructuring (dependency)
- Epic 013: Parent epic for skills restructuring

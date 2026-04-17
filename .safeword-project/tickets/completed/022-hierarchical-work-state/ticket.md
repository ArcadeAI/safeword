---
id: 022
type: epic
phase: intake
status: superseded
superseded_by: ['024', '025']
created: 2026-01-11T22:00:00Z
last_modified: 2026-02-21T16:15:00Z
supersedes: ['017']
---

# Hierarchical Work State Machine

> **Superseded by [024 - Continuous Quality Gates](../024-continuous-quality-gates/ticket.md) + [025 - Hierarchy Navigation](../025-hierarchy-navigation/ticket.md)**
> The stack-based state machine was over-engineered. LOC + phase gates (024) and hierarchy navigation (025) achieve the same goals with flat state and filesystem walks.

**User Story:** When working on complex features that span epics, tickets, scenarios, and TDD cycles, I want the system to track where I am, inject the right context at each step, and enforce quality gates so I don't lose progress or drift from the plan.

**Goal:** Unified state machine that tracks nested work items, injects phase-appropriate context, and enforces commits at natural checkpoints.

## The Problem (from 017)

**Quality gaps during long BDD runs:**

| Phase           | Duration    | Human Gate?        | Quality Review? |
| --------------- | ----------- | ------------------ | --------------- |
| intake          | 5-10 min    | Yes (questions)    | Stop hook fires |
| define-behavior | 10-15 min   | No                 | May not fire    |
| scenario-gate   | 2-5 min     | **Yes (approval)** | Stop hook fires |
| decomposition   | 5-10 min    | No                 | May not fire    |
| implement       | **30+ min** | No                 | **Gap!**        |
| done            | 5 min       | Yes (verification) | Stop hook fires |

**The gap:** Implement phase can run 30+ minutes without quality review. Agent may accumulate errors, drift from spec, skip TDD commits.

**Why 017's flat state is insufficient:**

1. Can't track nested work (parent ticket → child ticket → scenario → TDD)
2. No way to know "where am I in the hierarchy?"
3. No backtracking to revisit prior steps
4. Single `lastKnownPhase` assumes one active work item
5. Context injection and enforcement are separate concerns (017b) when they should be unified

## Solution: Stack-Based Hierarchical State

### Core Insight

Work items form a stack. As you enter deeper contexts, push. As you complete, pop. History enables backtracking.

```text
[ticket] 017 Continuous Quality Monitoring (has children)
  └─ [ticket] 017a LOC Quality Tracking (has scenarios)
       └─ [tdd] scenario: threshold-gate, cycle: GREEN  ← you are here
```

A ticket's role is determined by what it contains:

- Has `children[]` → parent ticket (navigate to child tickets)
- Has `scenarios[]` → leaf ticket (navigate to TDD cycles)
- Has both → parent with its own work (rare but valid)

### Three Unified Mechanisms

| Mechanism         | What It Does                              | When It Fires    |
| ----------------- | ----------------------------------------- | ---------------- |
| Context Injection | Read phase file, inject into gate message | State transition |
| LOC Enforcement   | Block after 400 LOC uncommitted           | PreToolUse       |
| Phase Gates       | Block at phase transitions until commit   | PreToolUse       |

All three operate on the same state, use the same enforcement pattern (PostToolUse → state → PreToolUse), and clear on the same action (commit).

## State Schema

```json
// .safeword-project/quality-state.json
{
  "activeRoot": "017",
  "locSinceCommit": 234,
  "lastCommitHash": "a1b2c3d",
  "gate": {
    "type": "phase",
    "reason": "Entering implement phase",
    "contextFile": "TDD.md"
  },

  "roots": {
    "017": {
      "stack": [
        {
          "type": "ticket",
          "id": "017",
          "workLevel": "feature",
          "phase": "implement",
          "ticketDir": ".safeword-project/tickets/017-continuous-quality-monitoring",
          "children": ["017a", "017b"],
          "currentChild": "017a"
        },
        {
          "type": "ticket",
          "id": "017a",
          "workLevel": "task",
          "phase": "implement",
          "ticketDir": ".safeword-project/tickets/017a-loc-quality-tracking",
          "scenarios": ["loc-tracking", "threshold-gate"],
          "currentScenario": "threshold-gate",
          "scenariosCompleted": 1
        },
        {
          "type": "tdd",
          "scenario": "threshold-gate",
          "cycle": "green",
          "lastCommitType": "test"
        }
      ],
      "historyStack": {
        "017": { "phase": "implement", "currentChild": "017a" },
        "017a": { "phase": "implement", "currentScenario": "threshold-gate" }
      }
    },
    "045": {
      "stack": [],
      "historyStack": {}
    }
  }
}
```

Multiple roots can exist - only one is `activeRoot`. Parked roots retain their full state.

### Work Item Types

| Type     | Role                     | Key Fields                                             |
| -------- | ------------------------ | ------------------------------------------------------ |
| `ticket` | Any work item            | `id`, `workLevel`, `phase`, `ticketDir`                |
|          | + with children          | `children[]`, `currentChild`                           |
|          | + with scenarios         | `scenarios[]`, `currentScenario`, `scenariosCompleted` |
| `tdd`    | TDD cycle for a scenario | `scenario`, `cycle`, `lastCommitType`                  |

`workLevel` is assessed during intake: `patch | task | feature`

**Navigation logic:**

- If ticket has `children[]` and no `scenarios[]` → enter child ticket
- If ticket has `scenarios[]` → enter TDD for current scenario
- If ticket has both → user chooses (uncommon)

## Dynamic Work Lifecycle

The hierarchy isn't static - it evolves as work progresses.

### Root Anchor

State tracks an `activeRoot` - the current work context. Multiple roots can exist (parked), but only one is active:

```json
{
  "activeRoot": "022",
  "roots": {
    "022": { "stack": [...], "historyStack": {...} },
    "017": { "stack": [...], "historyStack": {...} }
  }
}
```

### Work Level Assessment at Entry

Every ticket goes through work level detection during intake:

```typescript
type WorkLevel = 'patch' | 'task' | 'feature';

interface TicketWorkItem {
  type: 'ticket';
  id: string;
  workLevel: WorkLevel; // assessed at intake
  phase: BddPhase;
  // ...
}
```

**Detection signals** (from existing BDD rubrics):

- File count: 1-2 files → patch/task, 3+ files → feature
- New state/flows → feature
- Test complexity → feature
- User says "add", "implement", "build" → feature

### Dynamic Child Creation

Children aren't pre-defined - they're created during decomposition:

```typescript
function createSubticket(
  state: HierarchicalState,
  parentId: string,
  childSpec: { id: string; title: string },
): void {
  const parent = state.stack.find(w => w.id === parentId);
  if (!parent) return;

  // Add to parent's children
  parent.children = parent.children ?? [];
  parent.children.push(childSpec.id);

  // Create ticket directory and file
  createTicketFiles(childSpec);
}
```

### Upgrade Triggers

Work can be upgraded mid-flight based on existing rubrics:

| Trigger                  | Current Level | Upgrade To   | Action                           |
| ------------------------ | ------------- | ------------ | -------------------------------- |
| 3+ files touched         | task          | feature      | Enter BDD flow, create scenarios |
| Complex decomposition    | task          | feature      | Create subtickets                |
| >5 scenarios             | feature       | epic (split) | Break into child features        |
| >400 LOC in one scenario | -             | -            | Split scenario                   |

```typescript
function checkUpgradeTriggers(state: HierarchicalState): UpgradeAction | null {
  const current = currentTicket(state);
  if (!current) return null;

  // Task → Feature upgrade
  if (current.workLevel === 'task') {
    const filesChanged = countFilesChanged();
    if (filesChanged >= 3) {
      return { type: 'upgrade', from: 'task', to: 'feature' };
    }
  }

  // Feature → Split into children
  if (current.workLevel === 'feature' && current.scenarios?.length > 5) {
    return { type: 'split', reason: 'Too many scenarios' };
  }

  return null;
}
```

### Split Flow

When decomposition reveals subtickets:

1. PostToolUse detects split trigger (e.g., decomposition creates multiple task sections)
2. Gate set: "This work should be split into subtickets"
3. Agent creates child tickets via `createSubticket()`
4. Parent ticket's `children[]` populated
5. Enter first child, continue work

### Context Switching

What happens when switching to different work depends on relationship to current root.

**Related work (same root):** Hop to another branch in the graph.

```text
Working: 017 → 017a → TDD (threshold-gate)
User: "Let's work on 017b instead"
Action: Pop to 017, push 017b
Result: 017a state preserved in history, now in 017b
```

```typescript
function switchToBranch(state: HierarchicalState, targetId: string): void {
  // Find common ancestor
  const targetTicket = findTicketInTree(state.rootTicket, targetId);
  if (!targetTicket) return; // Not in this tree

  // Pop to parent that contains target
  while (state.stack.length > 0) {
    const current = currentWork(state);
    if (current?.children?.includes(targetId)) {
      // Found parent - update currentChild and push target
      current.currentChild = targetId;
      enterTicket(state, targetId);
      return;
    }
    exitCurrentWork(state); // Saves to history
  }
}
```

**Unrelated work (different root):** Pause current graph, start new root.

```text
Working: 017 → 017a → TDD
User: "Let's work on 045"
Action: Park entire 017 graph, start fresh with 045
Result: 017 graph paused, can resume later
```

```typescript
interface QualityState {
  activeRoot: string | null;
  roots: {
    [rootId: string]: {
      stack: WorkItem[];
      historyStack: Record<string, Partial<WorkItem>>;
    };
  };
  locSinceCommit: number;
  lastCommitHash: string;
  gate: Gate | null;
}

function switchRoot(state: QualityState, newRootId: string): void {
  // Park current root
  if (state.activeRoot) {
    state.roots[state.activeRoot] = {
      stack: state.stack,
      historyStack: state.historyStack,
    };
  }

  // Switch to new root (resume if exists, fresh if new)
  state.activeRoot = newRootId;
  const existing = state.roots[newRootId];
  if (existing) {
    state.stack = existing.stack;
    state.historyStack = existing.historyStack;
  } else {
    state.stack = [];
    state.historyStack = {};
    enterTicket(state, newRootId);
  }
}
```

**Detection:** How do we know if target is related to current root?

- Check if target ticket has `parent:` chain leading to current root
- Or check if current root has target in its descendant tree
- If neither → different root

### Backward Compatibility

Flat state fields derived from stack for 017a/017b hooks during migration:

```typescript
function flatView(state: HierarchicalState): FlatState {
  const ticket = state.stack.find(w => w.type === 'ticket');
  const tdd = state.stack.find(w => w.type === 'tdd');

  return {
    locSinceCommit: state.locSinceCommit,
    lastCommitHash: state.lastCommitHash,
    lastKnownPhase: ticket?.phase ?? null,
    phaseGate: state.gate?.type === 'phase' ? state.gate : null,
    tdd: {
      lastCommitType: tdd?.lastCommitType ?? null,
      scenariosCompleted: ticket?.scenariosCompleted ?? 0,
      scenariosTotal: ticket?.scenarios?.length ?? 0,
    },
  };
}
```

## Context Injection

### Phase Files (Read at Runtime)

| Phase             | Source File      | Injected When            |
| ----------------- | ---------------- | ------------------------ |
| `intake`          | DISCOVERY.md     | Entering intake          |
| `define-behavior` | SCENARIOS.md     | Entering define-behavior |
| `scenario-gate`   | SCENARIOS.md     | Entering scenario-gate   |
| `decomposition`   | DECOMPOSITION.md | Entering decomposition   |
| `implement`       | TDD.md           | Entering implement       |
| `done`            | DONE.md          | Entering done            |

**Why read full files:** No drift (source IS the message), no "click through" needed, single source of truth. Phase files are small (~45-70 lines each).

### TDD Context Enhancement

When in `implement` phase, gate message includes TDD progress:

```text
SAFEWORD: Entering implement phase.

TDD Progress: 1/3 scenarios complete
Current: threshold-gate
Last commit: test: threshold detection
Expected next: feat: threshold detection (GREEN)

[TDD.md content]

Commit to proceed.
```

## Enforcement

### PostToolUse → State → PreToolUse Pattern

| Hook        | What It Does                            | Can Block?   |
| ----------- | --------------------------------------- | ------------ |
| PostToolUse | Detect changes, update state, set gates | No           |
| PreToolUse  | Check state, enforce gates              | Yes (exit 2) |

### Gate Triggers

| Trigger             | Detection                                  | Gate Set                                                         |
| ------------------- | ------------------------------------------ | ---------------------------------------------------------------- |
| LOC threshold (400) | PostToolUse counts LOC on edit             | `{ type: "loc", locSinceCommit: 450 }`                           |
| Phase transition    | PostToolUse detects ticket.md phase change | `{ type: "phase", toPhase: "implement", contextFile: "TDD.md" }` |
| Ticket enter        | User references new ticket                 | `{ type: "context", entering: "017a" }`                          |

### Gate Clearing

All gates clear on **commit**:

```typescript
function checkGates(state: HierarchicalState): void {
  const currentHead = execSync('git rev-parse HEAD', { encoding: 'utf-8' }).trim();

  if (state.lastCommitHash !== currentHead) {
    // Commit happened - clear all gates, reset LOC
    state.gate = null;
    state.locSinceCommit = 0;
    state.lastCommitHash = currentHead;

    // Update TDD state from commit message
    updateTddFromCommit(state);
  }
}
```

### Cursor Parity

| Mechanism         | Claude Code        | Cursor                       |
| ----------------- | ------------------ | ---------------------------- |
| LOC enforcement   | PreToolUse exit(2) | stop hook `followup_message` |
| Phase gates       | PreToolUse exit(2) | stop hook `followup_message` |
| Context injection | Same gate message  | Same gate message            |

Cursor's `afterFileEdit` can't block. Use stop hook for soft enforcement with same messages.

## Stack Operations

### Push (Enter Deeper Context)

```typescript
function enterTicket(state: HierarchicalState, ticketId: string): void {
  // Check history for resume
  const history = state.historyStack[ticketId];
  if (history) {
    state.stack.push({ ...history });
    return;
  }

  // Fresh entry - read ticket to get phase and scenarios
  const ticketDir = findTicketDir(ticketId);
  const phase = readPhaseFromTicket(ticketDir);
  const scenarios = readScenariosFromTestDefs(ticketDir);

  state.stack.push({
    type: 'ticket',
    id: ticketId,
    ticketDir,
    phase,
    scenarios,
    currentScenario: scenarios[0] ?? null,
    scenariosCompleted: 0,
  });

  // Set context gate
  state.gate = {
    type: 'phase',
    toPhase: phase,
    contextFile: PHASE_FILES[phase],
  };
}
```

### Pop (Complete/Exit)

```typescript
function exitCurrentWork(state: HierarchicalState): void {
  const item = state.stack.pop();
  if (!item) return;

  // Save to history for potential backtrack
  if (item.id) {
    state.historyStack[item.id] = { ...item };
  }

  // Update parent's progress
  const parent = currentWork(state);
  if (parent?.type === 'ticket' && item.type === 'tdd') {
    parent.scenariosCompleted = (parent.scenariosCompleted ?? 0) + 1;
    const nextIdx = parent.scenarios?.indexOf(item.scenario) ?? -1;
    parent.currentScenario = parent.scenarios?.[nextIdx + 1] ?? null;
  }
}
```

### Backtrack (History States)

```typescript
function backtrackTo(state: HierarchicalState, targetId: string): boolean {
  // Check if target is in current stack
  const idx = state.stack.findIndex(w => w.id === targetId);
  if (idx >= 0) {
    // Pop down to target
    while (state.stack.length > idx + 1) {
      exitCurrentWork(state);
    }
    return true;
  }

  // Check history
  const history = state.historyStack[targetId];
  if (!history) return false;

  // Clear stack, restore from history
  while (state.stack.length > 0) {
    exitCurrentWork(state);
  }
  state.stack.push({ ...history });
  return true;
}
```

## Relationship to 017

This epic supersedes 017. The mechanisms from 017a (LOC enforcement) and 017b (phase gates) are incorporated here as unified concerns within the hierarchical model.

| 017 Ticket        | Status    | In 022                                  |
| ----------------- | --------- | --------------------------------------- |
| 017a LOC tracking | Subsumed  | LOC enforcement in unified state        |
| 017b Phase gates  | Subsumed  | Phase gates + context injection unified |
| 017c Hierarchical | Extracted | This epic (022)                         |

## Subtickets

| ID   | Name               | Scope                                    |
| ---- | ------------------ | ---------------------------------------- |
| 022a | Core State Machine | Stack operations, history, state schema  |
| 022b | Work Lifecycle     | Work level assessment, upgrades, splits  |
| 022c | Context Injection  | Phase file reading, TDD progress display |
| 022d | Enforcement Hooks  | PreToolUse/PostToolUse, gate checking    |
| 022e | Cursor Parity      | Stop hook with same messages             |

## Success Criteria

**State tracking:**

- [ ] Stack-based state tracks ticket (with children) → ticket (with scenarios) → TDD
- [ ] Multiple roots supported (`activeRoot` + parked roots)
- [ ] History states enable backtracking to prior work
- [ ] Branch switching within same root preserves history
- [ ] Root switching parks/resumes full graph state

**Work lifecycle:**

- [ ] Work level (`patch | task | feature`) assessed at ticket entry
- [ ] Upgrade triggers detect when task → feature
- [ ] Dynamic child creation during decomposition
- [ ] Split flow when work exceeds thresholds

**Enforcement:**

- [ ] Context injection reads phase files at runtime (no drift)
- [ ] LOC gate blocks at 400 uncommitted lines
- [ ] Phase gate blocks at transitions with injected context
- [ ] TDD progress shown during implement phase
- [ ] All gates clear on commit

**Parity:**

- [ ] Cursor gets soft enforcement via stop hook
- [ ] Backward compatible: flat view available for migration

## Open Questions

### Core Design (Resolve During Intake)

1. ~~**Cross-ticket switching**: What happens when user jumps to unrelated ticket mid-work?~~ → Resolved: Related = hop branch, unrelated = park root and switch

2. **Initialization**: How does state bootstrap on first use in a project?
   - First ticket reference creates state?
   - Explicit `/bdd` invocation?
   - What if state file doesn't exist?

3. **Root auto-detection**: When starting on child ticket (e.g., 017a), auto-detect true root via `parent:` chain?
   - Walk `parent:` frontmatter to find ancestor with no parent?
   - Or require explicit root specification?
   - What if parent chain is broken?

### Implementation Details (Defer to Subtickets)

4. **History cleanup**: When to garbage-collect old history entries? Parked roots?
   - Never (state grows unbounded)?
   - After N days inactive?
   - On explicit "close ticket" action?

5. **Children detection**: Read from ticket frontmatter `children:[]` or scan for `{id}*` directories?
   - Frontmatter is explicit but requires maintenance
   - Directory scan is automatic but may catch unrelated files

6. **Ticket ID generation**: When creating dynamic subtickets, how generate IDs?
   - Increment from parent (017a, 017b, 017c)?
   - Use ticket title slug?
   - Both? (022a-core-state-machine)

7. **State persistence scope**: File grows unbounded with parked roots.
   - Accept unbounded growth?
   - Archive parked roots to separate files?
   - Prune after root completion?

8. **IDE-specific paths**: Phase files in `.claude/skills/...` vs `.cursor/`.
   - Detect current IDE and use appropriate path?
   - Use `.safeword/skills/` as canonical location?
   - Symlink or copy during setup?

## Work Log

---

- 2026-01-11T22:30:00Z Added: Full open questions list (initialization, root auto-detection, cleanup, ID gen, paths)
- 2026-01-11T22:20:00Z Added: Context switching (branch hop vs root park/resume)
- 2026-01-11T22:15:00Z Added: Dynamic work lifecycle (workLevel, upgrade triggers, split flow)
- 2026-01-11T22:10:00Z Simplified: Removed explicit 'epic' type - ticket role determined by children/scenarios
- 2026-01-11T22:00:00Z Created: Extracted from 017c, expanded to full scope

---

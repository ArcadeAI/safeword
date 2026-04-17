---
id: 017b
type: feature
phase: intake
status: superseded
superseded_by: 024
parent: 017
created: 2026-01-10T20:23:00Z
last_modified: 2026-02-21T16:15:00Z
---

# Phase Transition Quality Gates

> **Superseded by [024 - Continuous Quality Gates](../024-continuous-quality-gates/ticket.md)**
> Merged with 017a into a single ticket — they share the same hook pair and state file.

**User Story:** When I run `/bdd` and the agent moves from scenario definition to implementation, I want a quality gate so I can validate the plan before coding begins.

**Goal:** Trigger quality review at BDD phase boundaries, ensuring work is validated before moving to the next phase.

**Parent:** [017 - Continuous Quality Monitoring](../017-continuous-quality-monitoring/ticket.md)

## The Solution

Use PostToolUse -> state -> PreToolUse pattern (same as 017a).

```text
Agent edits ticket.md to change phase
    ↓
PostToolUse: Detect phase change, set gate in state
    ↓
Next Edit attempted
    ↓
PreToolUse: Check gate, block with phase-appropriate message
    ↓
Agent commits
    ↓
Next PreToolUse: HEAD changed, gate clears
```

## State File

Extends 017a's state with phase and TDD tracking:

```json
// .safeword-project/quality-state.json
{
  "locSinceCommit": 234,
  "lastCommitHash": "a1b2c3d",
  "lastKnownPhase": "implement",
  "phaseGate": null,
  "tdd": {
    "lastCommitType": "test",
    "scenariosCompleted": 2,
    "scenariosTotal": 5
  }
}
```

## TDD Substate Tracking (Option A: Tracking Only)

During `implement` phase, track TDD cycle position and scenario progress. No blocking - just surface in quality reviews.

### Detection: Commit Message Parsing

PostToolUse after commit parses message to update `lastCommitType`:

```typescript
function updateTddState(projectDir: string): void {
  const state = loadQualityState(projectDir);
  if (state.lastKnownPhase !== 'implement') return;

  const commitMsg = execSync('git log -1 --format=%s', { encoding: 'utf-8' }).trim();

  if (commitMsg.match(/^test:/i)) {
    state.tdd.lastCommitType = 'test';
  } else if (commitMsg.match(/^feat:/i)) {
    state.tdd.lastCommitType = 'feat';
  } else if (commitMsg.match(/^refactor:/i)) {
    state.tdd.lastCommitType = 'refactor';
  }

  saveQualityState(projectDir, state);
}
```

### Detection: Scenario Progress

Parse test-definitions.md to count completed scenarios:

```typescript
function updateScenarioProgress(projectDir: string, ticketDir: string): void {
  const testDefsPath = `${ticketDir}/test-definitions.md`;
  if (!existsSync(testDefsPath)) return;

  const content = readFileSync(testDefsPath, 'utf-8');
  const unchecked = (content.match(/- \[ \]/g) || []).length;
  const checked = (content.match(/- \[x\]/gi) || []).length;

  state.tdd.scenariosTotal = unchecked + checked;
  state.tdd.scenariosCompleted = checked;
}
```

### Quality Review: TDD Progress Display

When in `implement` phase, quality review shows:

```text
TDD Progress: 2/5 scenarios complete
Last commit: test: User can log in
Expected next: feat: User can log in (GREEN)

[TDD.md content]
```

Infer expected next from `lastCommitType`:

| lastCommitType | Expected Next                          |
| -------------- | -------------------------------------- |
| `test`         | `feat:` (GREEN)                        |
| `feat`         | `refactor:` or `test:` (next scenario) |
| `refactor`     | `test:` (next scenario RED)            |
| `null`         | `test:` (start first scenario)         |

### Initialize on Phase Enter

When entering `implement` phase:

```typescript
if (currentPhase === 'implement' && state.lastKnownPhase !== 'implement') {
  state.tdd = {
    lastCommitType: null,
    scenariosCompleted: 0,
    scenariosTotal: 0,
  };
  updateScenarioProgress(projectDir, ticketDir);
}
```

## Phase-Specific Context Injection

**Problem:** Skills are soft enforcement—the agent _may_ read phase files, but it's not guaranteed.

**Solution:** Read the actual phase file at runtime and inject it into the gate message. No excerpts, no drift, no "click through" needed.

| Phase             | Source File      |
| ----------------- | ---------------- |
| `intake`          | DISCOVERY.md     |
| `define-behavior` | SCENARIOS.md     |
| `scenario-gate`   | SCENARIOS.md     |
| `decomposition`   | DECOMPOSITION.md |
| `implement`       | TDD.md           |
| `done`            | DONE.md          |

**Why read full files:**

- Phase files are small (~45-70 lines each)
- No drift - source IS the message
- No "click through" needed - agent has full context
- Single source of truth

**Gate all phase transitions:**

```typescript
if (currentPhase && currentPhase !== state.lastKnownPhase) {
  state.phaseGate = { pending: true, toPhase: currentPhase };
  state.lastKnownPhase = currentPhase;
  saveQualityState(projectDir, state);
}
```

## Implementation

### PostToolUse: Detect Phase Change

```typescript
// In post-tool-lint.ts

function detectPhaseChange(projectDir: string, editedFile: string): void {
  // Only check when ticket.md is edited
  if (!editedFile.endsWith('ticket.md')) return;
  if (!editedFile.includes('.safeword-project/tickets/')) return;

  const content = readFileSync(editedFile, 'utf-8');
  const phaseMatch = content.match(/^phase:\s*(\S+)/m);
  const currentPhase = phaseMatch?.[1];

  const state = loadQualityState(projectDir);

  if (currentPhase && currentPhase !== state.lastKnownPhase) {
    // Phase changed - set gate for key transitions
    if (currentPhase === 'implement' || currentPhase === 'done') {
      state.phaseGate = { pending: true, toPhase: currentPhase };
    }
    state.lastKnownPhase = currentPhase;
    saveQualityState(projectDir, state);
  }
}
```

### PreToolUse: Enforce Gate

```typescript
// In pre-tool-quality.ts

function checkPhaseGate(state: QualityState, currentHead: string): void {
  if (!state.phaseGate?.pending) return;

  // Gate clears on commit
  if (state.lastCommitHash !== currentHead) return;

  const message = getGateMessage(state.phaseGate.toPhase);
  console.error(message);
  process.exit(2);
}
```

### Phase-Specific Messages (Read at Runtime)

```typescript
// In lib/quality.ts

const PHASE_FILES: Record<BddPhase, string> = {
  intake: 'DISCOVERY.md',
  'define-behavior': 'SCENARIOS.md',
  'scenario-gate': 'SCENARIOS.md',
  decomposition: 'DECOMPOSITION.md',
  implement: 'TDD.md',
  done: 'DONE.md',
};

function getGateMessage(projectDir: string, phase: BddPhase): string {
  const skillDir = `${projectDir}/.claude/skills/safeword-bdd-orchestrating`;
  const phaseFile = PHASE_FILES[phase];
  const content = readFileSync(`${skillDir}/${phaseFile}`, 'utf-8');

  return `SAFEWORD: Entering ${phase} phase.

${content}

Commit to proceed.`;
}
```

**Benefits:**

- Source file IS the message (no drift)
- Single source of truth for phase instructions
- Agent gets full context without needing to "click through"

## Fix Cursor Phase-Awareness

Current bug: `cursor/stop.ts` uses generic `QUALITY_REVIEW_MESSAGE`.

```typescript
// cursor/stop.ts - BEFORE
import { QUALITY_REVIEW_MESSAGE } from '../lib/quality.ts';
followup_message: QUALITY_REVIEW_MESSAGE;

// cursor/stop.ts - AFTER
import { getQualityMessage, getCurrentPhase } from '../lib/quality.ts';
const phase = getCurrentPhase(projectDir);
followup_message: getQualityMessage(phase);
```

Extract `getCurrentPhase()` to `lib/quality.ts` for reuse.

## Cursor Parity

Cursor's `afterFileEdit` can't block phase gates. Use stop hook:

```typescript
// cursor/stop.ts
const state = loadQualityState();
if (state.phaseGate?.pending) {
  return {
    followup_message: getGateMessage(state.phaseGate.toPhase),
  };
}
```

Soft enforcement, but effective.

## Acceptance Criteria

- [ ] PostToolUse detects phase change in ticket.md
- [ ] PreToolUse blocks at ALL phase transitions
- [ ] Gate clears on commit (HEAD changes)
- [ ] `getGateMessage(phase)` reads phase file at runtime (no hardcoded excerpts)
- [ ] Phase file mapping: intake→DISCOVERY.md, implement→TDD.md, etc.
- [ ] `getCurrentPhase()` extracted to lib/quality.ts
- [ ] Cursor stop.ts uses phase-aware messages
- [ ] State tracks `lastKnownPhase` and `phaseGate`
- [ ] TDD tracking: `lastCommitType` parsed from commit messages
- [ ] TDD tracking: `scenariosCompleted`/`scenariosTotal` from test-definitions.md
- [ ] Quality review shows TDD progress during implement phase

## Testing

1. Edit ticket.md to change phase to `define-behavior` → gate set
2. Attempt next edit → PreToolUse blocks with scenario drafting context
3. Commit → next edit allowed
4. Edit ticket.md to change phase to `implement` → gate set with TDD context
5. Edit ticket.md to change phase to `done` → gate set with completion checklist
6. In Cursor: phase change → stop hook shows phase-specific message

## Work Log

---

- 2026-01-11T21:27:00Z Added: TDD substate tracking (Option A - tracking only, no blocking)
- 2026-01-11T21:15:00Z Revised: Read phase files at runtime instead of hardcoded excerpts (no drift)
- 2026-01-11T17:15:00Z Added: Phase-specific context injection design
- 2026-01-11T16:45:00Z Revised: PostToolUse→state→PreToolUse pattern, TDD-aware messages
- 2026-01-10T20:23:00Z Created: Phase transition gates design

---

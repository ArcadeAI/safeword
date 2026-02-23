---
id: 024
type: feature
phase: done
status: done
parent: null
supersedes: ['017a', '017b']
created: 2026-02-21T16:15:00Z
last_modified: 2026-02-23T01:10:00Z
---

# Continuous Quality Gates (LOC + Phase)

**User Story:** When I point the agent at a ticket and let it run, I want automatic commit checkpoints at LOC thresholds and phase transitions so errors don't compound during long implement phases and the agent doesn't skip BDD steps.

**Goal:** Block edits when 400+ LOC uncommitted (commit discipline) and at phase transitions (process compliance), injecting phase-appropriate context at each gate.

**Merges:** 017a (LOC enforcement) + 017b (phase gates). These share the same hook pair and state file — splitting them would mean building the infrastructure twice.

## The Problem

During long BDD runs (30+ min implement phases), the agent can:

1. **Accumulate 800+ LOC** without committing — errors compound, rollback is painful
2. **Skip BDD phases** — jump from intake to coding without defining scenarios
3. **Drift from the plan** — no checkpoint forces the agent to pause and align

The existing Stop hook (013d) catches issues at stop time, but by then 30+ minutes of unchecked work may have accumulated.

## The Solution

PostToolUse → state file → PreToolUse pattern. PostToolUse observes (can't block), writes to state. PreToolUse reads state and can block (exit 2).

```text
Edit happens
    ↓
PostToolUse: Count LOC, detect phase change, update state
    ↓
Next Edit attempted
    ↓
PreToolUse: Check state → block if LOC > 400 or phase gate set
    ↓
Agent commits
    ↓
Next PreToolUse: HEAD changed, gate clears
```

## State File

```json
// .safeword-project/quality-state.json
{
  "locSinceCommit": 234,
  "lastCommitHash": "a1b2c3d",
  "activeTicket": "013b",
  "lastKnownPhase": "implement",
  "gate": null
}
```

5 fields. Git is the source of truth for LOC count. Ticket frontmatter is the source of truth for phase.

### Gate Values

When a gate is set, it contains a reason string:

```json
{
  "gate": "loc"
}
```

or

```json
{
  "gate": "phase:implement"
}
```

Gate clears when HEAD changes (commit happened).

## Hook Architecture

### PostToolUse: `post-tool-quality.ts`

Fires on Edit|Write|MultiEdit|NotebookEdit. Responsibilities:

1. **Count LOC** via `git diff --stat HEAD` — count insertions + deletions
2. **Detect phase change** — if edited file is a ticket.md, check if `phase:` changed from `lastKnownPhase`
3. **Track active ticket** — if edited file is under `.safeword-project/tickets/`, extract ticket ID
4. **Set gate** if LOC > 400 or phase changed
5. **Write state** to `quality-state.json`

```typescript
function updateQualityState(projectDir: string, editedFile: string): void {
  const stateFile = `${projectDir}/.safeword-project/quality-state.json`;
  const state = loadOrCreateState(stateFile);

  // Check if commit happened (gate clears)
  const currentHead = execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim();
  if (state.lastCommitHash !== currentHead) {
    state.locSinceCommit = 0;
    state.lastCommitHash = currentHead;
    state.gate = null;
  }

  // Count LOC
  const diffStat = execSync('git diff --stat HEAD', { encoding: 'utf-8' });
  const insMatch = diffStat.match(/(\d+) insertions?\(\+\)/);
  const delMatch = diffStat.match(/(\d+) deletions?\(-\)/);
  state.locSinceCommit =
    (insMatch ? parseInt(insMatch[1]) : 0) + (delMatch ? parseInt(delMatch[1]) : 0);

  // LOC gate
  if (state.locSinceCommit >= 400) {
    state.gate = 'loc';
  }

  // Phase change detection
  if (editedFile.includes('.safeword-project/tickets/') && editedFile.endsWith('ticket.md')) {
    const content = readFileSync(editedFile, 'utf-8');
    const phaseMatch = content.match(/^phase:\s*(\S+)/m);
    const currentPhase = phaseMatch?.[1];

    if (currentPhase && currentPhase !== state.lastKnownPhase) {
      state.gate = `phase:${currentPhase}`;
      state.lastKnownPhase = currentPhase;
    }
  }

  writeFileSync(stateFile, JSON.stringify(state, null, 2));
}
```

### PreToolUse: `pre-tool-quality.ts`

Fires on Edit|Write|MultiEdit|NotebookEdit. Responsibilities:

1. **Read state** from `quality-state.json`
2. **Check if commit happened** — if HEAD changed, clear gate and allow
3. **Block if gate set** — exit 2 with appropriate message

```typescript
const LOC_THRESHOLD = 400;

async function main() {
  const input = await Bun.stdin.json();
  const tool = input.tool_name;

  if (!['Edit', 'Write', 'MultiEdit', 'NotebookEdit'].includes(tool)) {
    process.exit(0);
  }

  const stateFile = `${projectDir}/.safeword-project/quality-state.json`;
  if (!existsSync(stateFile)) process.exit(0);

  const state = JSON.parse(readFileSync(stateFile, 'utf-8'));
  const currentHead = execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim();

  // Commit happened → gate clears
  if (state.lastCommitHash !== currentHead) {
    process.exit(0);
  }

  if (!state.gate) process.exit(0);

  if (state.gate === 'loc') {
    console.error(`SAFEWORD: ${state.locSinceCommit} LOC since last commit (threshold: ${LOC_THRESHOLD}).

Commit your progress before continuing.

TDD reminder:
- RED: commit test ("test: [scenario]")
- GREEN: commit implementation ("feat: [scenario]")
- REFACTOR: commit cleanup`);
    process.exit(2);
  }

  if (state.gate.startsWith('phase:')) {
    const phase = state.gate.replace('phase:', '');
    const phaseContext = readPhaseFile(projectDir, phase);
    console.error(`SAFEWORD: Entering ${phase} phase.

${phaseContext}

Commit to proceed.`);
    process.exit(2);
  }

  process.exit(0);
}
```

### Phase Context Injection

Read phase files at runtime from `.claude/skills/safeword-bdd-orchestrating/` — no drift, single source of truth:

| Phase             | Source File      |
| ----------------- | ---------------- |
| `intake`          | DISCOVERY.md     |
| `define-behavior` | SCENARIOS.md     |
| `scenario-gate`   | SCENARIOS.md     |
| `decomposition`   | DECOMPOSITION.md |
| `implement`       | TDD.md           |
| `done`            | DONE.md          |

Phase files are small (~45-70 lines each). The injected message IS the source file content.

## Why 400 LOC?

| Research Finding                               | Source                     |
| ---------------------------------------------- | -------------------------- |
| 200-400 LOC per review is optimal              | Code review best practices |
| Beyond 400 LOC, reviewers skim                 | Industry studies           |
| Teams with <400 LOC reviews: 40% fewer defects | Production data            |

TDD alignment: Each RED-GREEN-REFACTOR cycle is ~100-300 LOC. 400 threshold catches agents skipping commits.

## Edge Cases

| Case                  | Handling                                              |
| --------------------- | ----------------------------------------------------- |
| New repo (no commits) | Skip enforcement until first commit                   |
| Binary files          | Excluded from git diff --stat                         |
| State file missing    | Initialize on first PostToolUse                       |
| Commit mid-session    | HEAD changes, gate clears                             |
| Phase edited twice    | Last phase wins                                       |
| Non-ticket edit       | LOC still tracked, phase unchanged                    |
| Untracked new files   | Not counted by `git diff --stat HEAD` (v1 limitation) |
| LOC + phase both trip | Last-write-wins in gate field; both clear on commit   |

## Hook Registration

Add to `.claude/settings.json`:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Edit|Write|MultiEdit|NotebookEdit",
        "hooks": [
          {
            "type": "command",
            "command": "bun \"$CLAUDE_PROJECT_DIR\"/.safeword/hooks/pre-tool-quality.ts"
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Edit|Write|MultiEdit|NotebookEdit",
        "hooks": [
          {
            "type": "command",
            "command": "bun \"$CLAUDE_PROJECT_DIR\"/.safeword/hooks/post-tool-quality.ts"
          }
        ]
      }
    ]
  }
}
```

## Acceptance Criteria

- [x] PostToolUse counts LOC via `git diff --stat HEAD`
- [x] PostToolUse detects phase change when ticket.md edited
- [x] PreToolUse blocks Edit/Write at 400+ LOC with TDD reminder
- [x] PreToolUse blocks at phase transitions with phase file content
- [x] All gates clear when commit happens (HEAD changes)
- [x] Phase context reads files at runtime (no hardcoded excerpts)
- [x] State file has 5 fields only
- [x] No noticeable latency (<50ms per hook)
- [x] Existing post-tool-lint.ts and stop-quality.ts unaffected

## Testing

1. Make edits totaling < 400 LOC → no block
2. Make edits totaling 400+ LOC → PreToolUse blocks with TDD reminder
3. Commit → next edit allowed (gate clears)
4. Edit ticket.md to change phase → gate set with phase context
5. Commit → phase gate clears
6. Edit non-ticket file → LOC tracked but no phase gate
7. State file missing → created on first PostToolUse

## Work Log

---

- 2026-02-23T02:30:00Z Complete: Phase 6-7 - TDD implementation complete. 12/12 tests passing. Hooks registered in settings.json
- 2026-02-23T01:15:00Z Complete: Phase 4-5 - Scenarios validated, decomposed into 3 tasks (PostToolUse, PreToolUse, registration)
- 2026-02-23T01:12:00Z Complete: Phase 3 - 12 scenarios defined across 4 suites (LOC gate, phase gate, state management, edge cases)
- 2026-02-23T01:10:00Z Complete: Phase 0-2 - Context established (5 review passes, ticket created from 017a+017b+022 analysis)
- 2026-02-21T16:15:00Z Created: Merged 017a + 017b into single ticket with simplified 5-field state

---

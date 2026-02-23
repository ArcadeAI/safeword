---
id: 017a
type: feature
phase: intake
status: superseded
superseded_by: 024
parent: 017
created: 2026-01-10T20:23:00Z
last_modified: 2026-02-21T16:15:00Z
---

# LOC-Based Commit Enforcement

> **Superseded by [024 - Continuous Quality Gates](../024-continuous-quality-gates/ticket.md)**
> Merged with 017b into a single ticket — they share the same hook pair and state file.

**User Story:** When I run `/bdd` and the agent implements for 30+ minutes straight, I want quality checks to happen automatically so I don't discover compounding errors at the end.

**Goal:** Block edits when 400+ LOC uncommitted, enforcing TDD commit discipline.

**Parent:** [017 - Continuous Quality Monitoring](../017-continuous-quality-monitoring/ticket.md)

## The Solution

Use PostToolUse -> state -> PreToolUse pattern to enforce commits.

```text
Edit happens
    ↓
PostToolUse: Calculate LOC since last commit, store in state
    ↓
Next Edit attempted
    ↓
PreToolUse: Check state, block if LOC > 400
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
  "lastCommitHash": "a1b2c3d"
}
```

Simple. Git is the source of truth for LOC count.

## Implementation

### PostToolUse: Track LOC

```typescript
// In post-tool-lint.ts, after linting

function updateQualityState(projectDir: string): void {
  const stateFile = `${projectDir}/.safeword-project/quality-state.json`;

  // Get current HEAD
  const currentHead = execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim();

  // Get LOC since last commit (all uncommitted changes)
  const diffStat = execSync('git diff --stat HEAD', { encoding: 'utf-8' });
  const locMatch = diffStat.match(/(\d+) insertions?.*?(\d+) deletions?/);
  const locSinceCommit = locMatch ? parseInt(locMatch[1]) + parseInt(locMatch[2]) : 0;

  const state = { locSinceCommit, lastCommitHash: currentHead };
  writeFileSync(stateFile, JSON.stringify(state, null, 2));
}
```

### PreToolUse: Enforce Threshold

```typescript
// New hook: pre-tool-quality.ts

const LOC_THRESHOLD = 400;

async function main() {
  const input = await Bun.stdin.json();
  const tool = input.tool_name;

  // Only gate Edit/Write operations
  if (!['Edit', 'Write', 'MultiEdit', 'NotebookEdit'].includes(tool)) {
    process.exit(0);
  }

  const stateFile = `${projectDir}/.safeword-project/quality-state.json`;
  if (!existsSync(stateFile)) {
    process.exit(0); // No state yet, allow
  }

  const state = JSON.parse(readFileSync(stateFile, 'utf-8'));
  const currentHead = execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim();

  // If commit happened, gate clears
  if (state.lastCommitHash !== currentHead) {
    process.exit(0);
  }

  // Check threshold
  if (state.locSinceCommit >= LOC_THRESHOLD) {
    console.error(`SAFEWORD: ${state.locSinceCommit} LOC since last commit.

Commit your progress before continuing.

TDD reminder:
- RED: commit test ("test: [scenario]")
- GREEN: commit implementation ("feat: [scenario]")
- REFACTOR: commit cleanup

Run: git add -A && git commit -m "your message"`);
    process.exit(2);
  }

  process.exit(0);
}
```

## Why 400 LOC?

| Research Finding                               | Source                     |
| ---------------------------------------------- | -------------------------- |
| 200-400 LOC per review is optimal              | Code review best practices |
| Beyond 400 LOC, reviewers skim                 | Industry studies           |
| Teams with <400 LOC reviews: 40% fewer defects | Production data            |

**TDD alignment:** Each RED-GREEN-REFACTOR cycle is ~100-300 LOC. 400 threshold catches agents skipping commits.

## Edge Cases

| Case                  | Handling                            |
| --------------------- | ----------------------------------- |
| New repo (no commits) | Skip enforcement until first commit |
| Binary file           | Excluded from git diff --stat       |
| State file missing    | Initialize on first PostToolUse     |
| Commit mid-session    | HEAD changes, gate clears           |
| `git reset --hard`    | LOC drops, agent can continue       |

## Cursor Parity

Cursor's `afterFileEdit` can't block. Use stop hook instead:

```typescript
// cursor/stop.ts
const state = loadQualityState();
if (state.locSinceCommit >= 400) {
  return {
    followup_message: `You have ${state.locSinceCommit} LOC uncommitted. Please commit before continuing.`,
  };
}
```

This is softer enforcement (nudge vs block) but still effective.

## Acceptance Criteria

- [ ] PostToolUse updates `quality-state.json` with LOC count
- [ ] PreToolUse blocks Edit/Write at 400+ LOC
- [ ] Gate clears when commit happens (HEAD changes)
- [ ] Message includes TDD reminder
- [ ] Cursor gets soft enforcement via stop hook
- [ ] No noticeable latency (<50ms per hook)

## What We Removed

| Original Design           | Decision | Rationale                                  |
| ------------------------- | -------- | ------------------------------------------ |
| 200 LOC soft reminder     | Dropped  | Adds context without blocking              |
| Time-based thresholds     | Dropped  | No timer hooks exist                       |
| Session tracking          | Dropped  | Git HEAD is the only baseline that matters |
| Lint warning acceleration | Dropped  | Separate concern, keep simple              |

## Testing

1. Make edits totaling < 400 LOC → no block
2. Make edits totaling 400+ LOC → PreToolUse blocks
3. Commit → next edit allowed
4. In Cursor: stop hook nudges at 400+ LOC

## Work Log

---

- 2026-01-11T16:40:00Z Revised: Simplified to PostToolUse→state→PreToolUse pattern
- 2026-01-10T20:23:00Z Created: Initial LOC-based quality tracking design

---

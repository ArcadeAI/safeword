# Test Definitions: Continuous Quality Gates (Ticket #024)

> **Note:** Phase gates and TDD gates were redesigned in #114 (enforcement redesign). Phase/TDD blocking replaced with prompt hook reminders. LOC gate and artifact prerequisite gate remain as hard blocks. See quality-gates.test.ts for current behavior.

**Guide**: `.safeword/guides/testing-guide.md` - Structure, status tracking, and TDD workflow
**Template**: `.safeword/templates/test-definitions-feature.md`

**Feature**: LOC enforcement and phase transition gates via PostToolUse/PreToolUse hook pair
**Related Issue**: #024
**Test File**: `packages/cli/tests/integration/quality-gates.test.ts`
**Total Tests**: 12 (12 passing, 0 skipped, 0 not implemented)

---

## Test Suite 1: LOC Gate

PostToolUse counts LOC from `git diff --stat HEAD`. PreToolUse blocks edits when threshold exceeded. Gate clears on commit.

### Test 1.1: Below threshold allows edits [x]

**Status**: ✅ Passing
**Description**: Edits under 400 LOC do not trigger blocking

**Steps**:

1. Create a safeword project with git repo and initial commit
2. Create state file with `locSinceCommit: 100`, `gate: null`, matching current HEAD
3. Run PreToolUse hook with `{ "tool_name": "Edit" }` on stdin

**Expected**:

- Exit code 0
- No stderr output

---

### Test 1.2: PostToolUse sets LOC gate at threshold [x]

**Status**: ✅ Passing
**Description**: When uncommitted LOC reaches 400+, PostToolUse sets `gate: "loc"` in state

**Steps**:

1. Create a safeword project with git repo and initial commit
2. Add a file with 400+ lines of content (tracked, staged changes via `git add` then modify again for unstaged diff)
3. Run PostToolUse hook with `{ "tool_name": "Edit", "tool_input": { "file_path": "large-file.ts" } }` on stdin

**Expected**:

- State file `quality-state.json` contains `"gate": "loc"`
- `locSinceCommit` >= 400

---

### Test 1.3: PreToolUse blocks with TDD reminder at LOC gate [x]

**Status**: ✅ Passing
**Description**: When gate is "loc", PreToolUse blocks with exit 2 and TDD context on stderr

**Steps**:

1. Create a safeword project with git repo and initial commit
2. Create state file with `gate: "loc"`, `locSinceCommit: 450`, `lastCommitHash` matching current HEAD
3. Run PreToolUse hook with `{ "tool_name": "Edit" }` on stdin

**Expected**:

- Exit code 2
- Stderr contains "SAFEWORD"
- Stderr contains "450 LOC"
- Stderr contains "RED" and "GREEN" and "REFACTOR" (TDD reminder)

---

### Test 1.4: LOC gate clears on commit [x]

**Status**: ✅ Passing
**Description**: After a commit (HEAD changes), PreToolUse allows edits even if state has gate set

**Steps**:

1. Create a safeword project with git repo and initial commit
2. Create state file with `gate: "loc"`, `lastCommitHash: "stale-hash"` (doesn't match current HEAD)
3. Run PreToolUse hook with `{ "tool_name": "Edit" }` on stdin

**Expected**:

- Exit code 0 (gate cleared because HEAD changed)

---

## Test Suite 2: Phase Gate

PostToolUse detects phase changes in ticket.md. PreToolUse blocks with phase-appropriate context from skill files. Gate clears on commit.

### Test 2.1: PostToolUse detects phase change in ticket.md [x]

**Status**: ✅ Passing
**Description**: When ticket.md is edited and phase changed, PostToolUse sets phase gate in state

**Steps**:

1. Create a safeword project with git repo and initial commit
2. Create a ticket at `.safeword-project/tickets/099-test/ticket.md` with `phase: intake`
3. Create state file with `lastKnownPhase: "intake"`, `gate: null`
4. Edit ticket.md to `phase: implement`
5. Run PostToolUse hook with `{ "tool_name": "Edit", "tool_input": { "file_path": ".../099-test/ticket.md" } }` on stdin

**Expected**:

- State file contains `"gate": "phase:implement"`
- State file contains `"lastKnownPhase": "implement"`

---

### Test 2.2: PreToolUse blocks with phase file content [x]

**Status**: ✅ Passing
**Description**: When phase gate is set, PreToolUse blocks with content read from the actual phase file

**Steps**:

1. Create a safeword project with git repo and initial commit
2. Create skill directory with a phase file (e.g., TDD.md with known content)
3. Create state file with `gate: "phase:implement"`, `lastCommitHash` matching current HEAD
4. Run PreToolUse hook with `{ "tool_name": "Edit" }` on stdin

**Expected**:

- Exit code 2
- Stderr contains "SAFEWORD"
- Stderr contains "Entering implement phase"
- Stderr contains content from the TDD.md file (read at runtime, not hardcoded)

---

### Test 2.3: Phase gate clears on commit [x]

**Status**: ✅ Passing
**Description**: After a commit, phase gate clears just like LOC gate

**Steps**:

1. Create a safeword project with git repo and initial commit
2. Create state file with `gate: "phase:implement"`, `lastCommitHash: "stale-hash"`
3. Run PreToolUse hook with `{ "tool_name": "Edit" }` on stdin

**Expected**:

- Exit code 0 (gate cleared because HEAD changed)

---

### Test 2.4: Non-ticket edit does not set phase gate [x]

**Status**: ✅ Passing
**Description**: Editing a regular file tracks LOC but does not trigger phase detection

**Steps**:

1. Create a safeword project with git repo and initial commit
2. Create state file with `gate: null`, `lastKnownPhase: "intake"`
3. Run PostToolUse hook with `{ "tool_name": "Edit", "tool_input": { "file_path": "src/foo.ts" } }` on stdin

**Expected**:

- State file `gate` remains `null` (no phase gate)
- `lastKnownPhase` remains "intake"
- `locSinceCommit` is updated (LOC still tracked)

---

## Test Suite 3: State Management

State file lifecycle — creation, initialization, and field structure.

### Test 3.1: PreToolUse allows when state file missing [x]

**Status**: ✅ Passing
**Description**: If quality-state.json doesn't exist, PreToolUse exits 0 without crashing

**Steps**:

1. Create a safeword project with git repo (no quality-state.json)
2. Run PreToolUse hook with `{ "tool_name": "Edit" }` on stdin

**Expected**:

- Exit code 0
- No stderr output
- No state file created (PreToolUse is read-only)

---

### Test 3.2: PostToolUse creates state file with 5 fields [x]

**Status**: ✅ Passing
**Description**: First PostToolUse creates quality-state.json with exactly 5 fields

**Steps**:

1. Create a safeword project with git repo (no quality-state.json)
2. Run PostToolUse hook with `{ "tool_name": "Edit", "tool_input": { "file_path": "src/foo.ts" } }` on stdin

**Expected**:

- `quality-state.json` created at `.safeword-project/quality-state.json`
- Contains exactly 5 keys: `locSinceCommit`, `lastCommitHash`, `activeTicket`, `lastKnownPhase`, `gate`
- `lastCommitHash` matches current HEAD
- `gate` is `null`

---

## Test Suite 4: Edge Cases

Tool filtering and diff edge cases.

### Test 4.1: PreToolUse passes through non-edit tools [x]

**Status**: ✅ Passing
**Description**: PreToolUse only blocks Edit/Write/MultiEdit/NotebookEdit, not other tools

**Steps**:

1. Create a safeword project with git repo
2. Create state file with `gate: "loc"`, `lastCommitHash` matching current HEAD
3. Run PreToolUse hook with `{ "tool_name": "Bash" }` on stdin

**Expected**:

- Exit code 0 (allows Bash even though LOC gate is set)

---

### Test 4.2: Insertions-only diff counts LOC correctly [x]

**Status**: ✅ Passing
**Description**: New files (insertions only, no deletions) are counted in LOC total

**Steps**:

1. Create a safeword project with git repo and initial commit
2. Create a new file with 50 lines (do not commit — creates insertions-only diff)
3. Stage the file with `git add`
4. Run PostToolUse hook

**Expected**:

- `locSinceCommit` is approximately 50 (not 0)
- Insertions-only diffs are handled by the regex

---

## Summary

**Total**: 12 tests
**Passing**: 12 tests (100%)
**Skipped**: 0 tests (0%)
**Not Implemented**: 0 tests (0%)
**Failing**: 0 tests (0%)

### Coverage by Feature

| Feature          | Tests | Status  |
| ---------------- | ----- | ------- |
| LOC Gate         | 4/4   | ✅ 100% |
| Phase Gate       | 4/4   | ✅ 100% |
| State Management | 2/2   | ✅ 100% |
| Edge Cases       | 2/2   | ✅ 100% |

---

## Test Execution

```bash
# Run all tests for this feature
bun run --cwd packages/cli test -- --grep "quality-gates"

# Run specific suite
bun run --cwd packages/cli test -- --grep "LOC Gate"
```

---

**Last Updated**: 2026-02-23

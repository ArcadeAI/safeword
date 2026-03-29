# Feature Spec: Declarative Rule Engine (Ticket #054)

**Guide**: `.safeword/guides/planning-guide.md`
**Template**: `.safeword/templates/feature-spec-template.md`

**Feature**: Replace imperative hook enforcement with a declarative rule engine
**Status**: ❌ Not Started (0/4 stories complete)

---

## Context

Safeword enforces development quality through 5 TypeScript hook files:

| Hook                       | Event                         | Decision          | Logic                                          |
| -------------------------- | ----------------------------- | ----------------- | ---------------------------------------------- |
| `pre-tool-quality.ts`      | PreToolUse (Edit/Write)       | DENY              | Phase blocking + gate enforcement              |
| `post-tool-quality.ts`     | PostToolUse (Edit/Write/Bash) | State mutation    | LOC counting, phase/TDD detection, gate firing |
| `pre-tool-config-guard.ts` | PreToolUse (Edit/Write)       | ASK               | Config file pattern matching                   |
| `stop-quality.ts`          | Stop                          | BLOCK (hard/soft) | Done-gate evidence, test execution, hierarchy  |
| `post-tool-bypass-warn.ts` | PostToolUse (Edit/Write)      | WARN              | Anti-pattern regex matching                    |

Each hook has its own condition checking, state management, and action logic. Rules are hardcoded in TypeScript. Users cannot customize enforcement without forking hooks.

### What changes

Rules move from TypeScript `if/else` blocks into YAML declarations. A single evaluator replaces the decision logic in each hook. Computation functions (LOC counting, TDD step parsing, test execution) stay in TypeScript but become named functions the rules reference.

### What stays the same

- Hook registration in `settings.json` (Claude Code's hook system is the runtime)
- `quality-state.json` as the state persistence mechanism
- The hook scripts themselves (they become thin shells that call the evaluator)
- All current enforcement behavior (rules must achieve exact parity)

---

## Technical Constraints

### Performance

- [ ] Rule evaluation adds < 50ms to hook execution (current hooks run in ~20-80ms)
- [ ] YAML parsing cached after first load (rules don't change mid-session)

### Compatibility

- [ ] Works with Claude Code hooks (PreToolUse, PostToolUse, Stop)
- [ ] Works with Cursor hooks (same hook format)
- [ ] Bun runtime (current hook runtime)

### Dependencies

- [ ] `yaml` package (already in project)
- [ ] No new runtime dependencies

---

## Story 1: Rule format and evaluator core

**As a** safeword maintainer
**I want to** define enforcement rules in YAML and have an evaluator process them
**So that** I can see all rules in one place and modify them without changing TypeScript

**Acceptance Criteria**:

- [ ] Rule format supports: name, event, match (tool pattern), when (predicates), action, message
- [ ] Evaluator loads rules from `.safeword/rules.yaml`
- [ ] Evaluator filters rules by event name and tool matcher
- [ ] Evaluator evaluates `when` predicates against current state
- [ ] Evaluator returns the action of the first matching rule (deny/ask/gate/warn/allow)
- [ ] Rules that need computation reference named functions (e.g., `computed: loc_since_commit`)
- [ ] Malformed rules.yaml produces clear error at load time (not silent failure)
- [ ] Missing rules.yaml is a hard error for built-in, no-op for user rules

**Implementation Status**: ❌ Not Started

**Notes**:

### Rule format

```yaml
version: 1

rules:
  # Simple predicate: phase membership
  - name: block-code-edits-in-planning
    event: PreToolUse
    match: Edit|Write|MultiEdit|NotebookEdit
    when:
      phase_in: [intake, define-behavior, scenario-gate, decomposition, done]
      file_not_meta: true # skip .safeword/, .claude/, .cursor/ paths
    action: deny
    message: "Phase {phase} doesn't allow code edits. Complete {phase} first."

  # Computed predicate: LOC threshold
  - name: loc-gate
    event: PostToolUse
    match: Edit|Write|MultiEdit|NotebookEdit|Bash
    when:
      computed: loc_since_commit
      gt: 400
      gate_not_tdd: true # don't override active TDD gates
    action: gate
    gate_id: loc
    message: '400+ LOC since last commit. Commit before continuing.'

  # Pattern predicate: file path matching
  - name: config-guard
    event: PreToolUse
    match: Edit|Write
    when:
      file_matches_any:
        - 'eslint\.config\.[mc]?[jt]s$'
        - 'tsconfig.*\.json$'
        - 'vitest\.config\.[mc]?[jt]s$'
        - 'jest\.config\.[mc]?[jt]s$'
        - '\.prettierrc'
        - '\.github\/workflows\/.*\.ya?ml$'
    action: ask
    message: "Config change requires approval. Fix code, don't weaken configs."

  # Content predicate: bypass pattern detection
  - name: bypass-warn
    event: PostToolUse
    match: Edit|Write
    when:
      content_matches_any:
        - 'eslint-disable(?:-next-line|-line)?'
        - '@ts-ignore'
        - '@ts-expect-error'
        - '@ts-nocheck'
        - '\bas\s+any\b'
        - '\b(it|test|describe)\.(skip|only)\s*\('
    action: warn
    message: "Bypass pattern detected. Fix code, don't weaken enforcement."

  # Gate enforcement (PreToolUse reads existing gates)
  - name: enforce-active-gate
    event: PreToolUse
    match: Edit|Write|MultiEdit|NotebookEdit
    when:
      gate_active: true
      file_not_meta: true
      commit_not_cleared: true # gate clears on new commit
    action: deny
    message: 'Gate active: {gate}. Commit to clear.'

  # TDD step detection (PostToolUse observes changes)
  - name: tdd-step-change
    event: PostToolUse
    match: Edit|Write
    when:
      file_is: test-definitions.md
      phase_is: implement
      computed: tdd_step_changed
    action: gate
    gate_id: 'tdd:{tdd_step}'
    message: 'TDD step completed: {tdd_step}. Review before continuing.'

  # Phase transition detection
  - name: phase-transition
    event: PostToolUse
    match: Edit|Write
    when:
      file_is_ticket: true
      computed: phase_changed
    action: gate
    gate_id: 'phase:{new_phase}'
    message: 'Phase transition to {new_phase}. Commit to acknowledge.'
```

### Predicate types

| Predicate                  | Type              | What it checks                                    |
| -------------------------- | ----------------- | ------------------------------------------------- |
| `phase_in`                 | List membership   | Current ticket phase is in list                   |
| `phase_is`                 | Equality          | Current ticket phase equals value                 |
| `file_not_meta`            | Built-in          | File path not in .safeword/, .claude/, .cursor/   |
| `file_matches_any`         | Regex list        | File path matches any pattern                     |
| `file_is`                  | Basename equality | File basename equals value                        |
| `file_is_ticket`           | Built-in          | File is a ticket.md in .safeword-project/tickets/ |
| `content_matches_any`      | Regex list        | Tool content matches any pattern                  |
| `gate_active`              | Boolean           | quality-state.json has non-null gate              |
| `gate_not_tdd`             | Boolean           | Active gate doesn't start with "tdd:"             |
| `commit_not_cleared`       | Boolean           | Git HEAD matches state's lastCommitHash           |
| `computed`                 | Named function    | Calls a TypeScript function that returns a value  |
| `gt` / `gte` / `lt` / `eq` | Comparison        | Compare computed value to threshold               |

### Computed functions (TypeScript, not YAML)

These stay as TypeScript because they involve I/O, subprocess calls, or complex parsing:

| Function           | What it does                                                   | Used by          |
| ------------------ | -------------------------------------------------------------- | ---------------- |
| `loc_since_commit` | Runs `git diff --stat HEAD`, parses insertions + deletions     | loc-gate         |
| `tdd_step_changed` | Parses test-definitions.md checkboxes, detects step transition | tdd-step-change  |
| `phase_changed`    | Reads ticket.md frontmatter, compares to lastKnownPhase        | phase-transition |
| `run_tests`        | Executes test command, returns pass/fail                       | done-gate (stop) |

---

## Story 2: Migrate existing hooks to rule evaluation

**As a** safeword maintainer
**I want to** replace the hardcoded logic in each hook with calls to the rule evaluator
**So that** all enforcement flows through one path and I can verify the rule set

**Acceptance Criteria**:

- [ ] `pre-tool-quality.ts` delegates to evaluator for phase blocking and gate enforcement
- [ ] `pre-tool-config-guard.ts` delegates to evaluator for config file protection
- [ ] `post-tool-quality.ts` delegates to evaluator for LOC/phase/TDD detection
- [ ] `post-tool-bypass-warn.ts` delegates to evaluator for bypass pattern warnings
- [ ] `stop-quality.ts` delegates to evaluator for done-gate checks
- [ ] All existing tests pass (exact behavioral parity)
- [ ] Hook files become thin shells: parse input → call evaluator → format output

**Implementation Status**: ❌ Not Started

**Notes**:

### Migration order (simplest first)

1. **`pre-tool-config-guard.ts`** — Pure pattern matching, no state, no computation. Easiest to verify parity.
2. **`post-tool-bypass-warn.ts`** — Pure pattern matching on content. No state writes.
3. **`pre-tool-quality.ts`** — Reads state + phase. No writes. Medium complexity.
4. **`post-tool-quality.ts`** — Reads AND writes state. Has computation (LOC, TDD, phase). Most complex.
5. **`stop-quality.ts`** — Special case: runs tests, reads transcripts, walks hierarchy. May stay partially imperative with rule-based decisions layered on top.

### The stop hook question

`stop-quality.ts` is the hardest to declarativize. It:

- Reads the transcript (JSONL parsing)
- Runs tests as a subprocess
- Walks the ticket hierarchy
- Has hard-block vs soft-block distinction
- Has bypass logic (stop_hook_active)

**Recommendation:** Keep `stop-quality.ts` as a hybrid. The _decision rules_ (what evidence is required, when to hard-block vs soft-block) go into YAML. The _mechanics_ (running tests, parsing transcripts, walking hierarchy) stay in TypeScript. The hook calls the evaluator to get the decision, then executes it.

---

## Story 3: User-defined rules

**As a** developer using safeword
**I want to** add my own enforcement rules without modifying safeword's code
**So that** I can enforce project-specific policies (e.g., protect certain directories, require reviews for specific file types)

**Acceptance Criteria**:

- [ ] User rules loaded from `.safeword-project/rules.yaml`
- [ ] User rules evaluated AFTER built-in rules (built-in rules take precedence for deny/block)
- [ ] User rules can use all predicate types available to built-in rules
- [ ] User rules cannot override built-in `deny` rules with `allow`
- [ ] Example user rule documented in template
- [ ] Invalid user rules produce clear error messages at session start
- [ ] Missing or empty `.safeword-project/rules.yaml` is a no-op (not an error)

**Implementation Status**: ❌ Not Started

**Notes**:

### Rule precedence

```
1. Built-in deny rules (highest priority — cannot be overridden)
2. User deny rules
3. Built-in ask rules
4. User ask rules
5. Built-in warn rules
6. User warn rules
7. Default: allow
```

Within the same priority level, first match wins.

### Example user rules

```yaml
# .safeword-project/rules.yaml
version: 1

rules:
  - name: protect-database-migrations
    event: PreToolUse
    match: Edit|Write
    when:
      file_matches_any:
        - 'migrations/.*\.sql$'
    action: ask
    message: 'Database migration edit. Are you sure?'

  - name: require-tests-for-api
    event: PostToolUse
    match: Edit|Write
    when:
      file_matches_any:
        - 'src/api/.*\.ts$'
    action: warn
    message: 'API file changed. Ensure corresponding test exists.'
```

---

## Story 4: Rule consistency checker (`safeword rules` commands)

**As a** safeword maintainer or user
**I want to** check my rule set for contradictions, gaps, and errors
**So that** I can trust the enforcement is correct before it runs

**Acceptance Criteria**:

- [ ] `safeword rules list` prints all active rules (built-in + user) with event, match, action
- [ ] `safeword rules check` validates: no contradictions, no syntax errors, all referenced computeds exist
- [ ] Contradiction detection: two rules with same event + overlapping match + overlapping predicates but different actions
- [ ] Missing computed detection: rule references a computed function that doesn't exist
- [ ] Invalid predicate detection: unknown predicate type
- [ ] Zero user rules is a valid state (checker passes cleanly)
- [ ] Exit code 0 if clean, 1 if issues found
- [ ] Human-readable output with rule names and specific conflict descriptions

**Implementation Status**: ❌ Not Started

**Notes**:

### What "contradiction" means

Two rules contradict if they could both match the same tool call but produce different actions. Example:

```yaml
# Rule A: deny edits in planning phases
- name: block-planning
  event: PreToolUse
  match: Edit
  when:
    phase_in: [intake]
  action: deny

# Rule B: allow edits to specific file in all phases
- name: allow-readme
  event: PreToolUse
  match: Edit
  when:
    file_is: README.md
  action: allow
```

These contradict: editing README.md during intake matches both. The checker flags this. Resolution: first-match-wins per precedence order, but the checker warns so the author can make intent explicit.

### What the checker does NOT do

- It doesn't prove rules are _correct_ (that's ticket 053's domain)
- It doesn't simulate execution paths
- It doesn't check that rules cover all scenarios (no gap analysis beyond obvious misses)

This is a syntactic/structural check, not a formal verification. It catches authoring mistakes, not design flaws.

---

## Summary

**Completed**: 0/4 stories (0%)
**Remaining**: 4/4 stories (100%)

### Phase 1: Foundation ❌

- Story 1: Rule format and evaluator core
- Story 2: Migrate existing hooks to rule evaluation

### Phase 2: Extensibility ❌

- Story 3: User-defined rules
- Story 4: Rule consistency checker

**Next Steps**: Define and stabilize the rule format (Story 1), then port the simplest hook (config-guard) as proof of concept before migrating the rest.

# Feature Spec: Safeword MCP Server & Plan Verification (Ticket #055)

**Guide**: `.safeword/guides/planning-guide.md`
**Template**: `.safeword/templates/feature-spec-template.md`

**Feature**: MCP server for workflow state + plan verification
**Status**: ❌ Not Started (0/5 stories complete)

---

## Context

### The two problems this solves

**Problem 1: Claude loses context.** After context compaction or long sessions, Claude doesn't know where it is in the workflow. Today it has to: read quality-state.json, read ticket.md frontmatter, parse test-definitions.md checkboxes, run git diff --stat. Four file reads and a subprocess just to reorient. An MCP tool returns this in one call.

**Problem 2: Enforcement is reactive.** Hooks catch violations after the agent tries something wrong. For a 5-scenario BDD feature, the agent may hit 3-5 gates during execution — each one a wasted tool call, hook round-trip, and recovery. Plan verification catches structural problems before work starts.

### Architecture: server as brain, hooks as muscles

```
┌──────────────────────────────────────────────────┐
│              safeword MCP Server                  │
│               (stdio, Bun runtime)                │
│                                                   │
│  Tools:                Resources:                 │
│  ├─ safeword_status    ├─ @safeword:plan          │
│  ├─ safeword_advance   ├─ @safeword:rules         │
│  ├─ safeword_gate      ├─ @safeword:progress      │
│  ├─ safeword_plan                                 │
│  ├─ safeword_step                                 │
│  └─ safeword_amend                                │
│                                                   │
│  State: in-memory cache, backed by files          │
│  ├─ quality-state-{session}.json (read/write)     │
│  ├─ plan.yaml (read/write)                        │
│  └─ ticket.md frontmatter (read)                  │
└──────────────────┬───────────────────────────────┘
                   │ shared file state
    ┌──────────────┼──────────────┐
    │              │              │
┌───▼───┐    ┌────▼────┐   ┌────▼─────┐
│PreTool│    │PostTool │   │  Stop    │
│ Hook  │    │  Hook   │   │  Hook    │
│ DENY  │    │ UPDATE  │   │ BLOCK    │
└───────┘    └─────────┘   └──────────┘
```

**Key constraint:** MCP tools cannot block other tool calls. Only hooks can deny/block. The server provides state and intelligence; hooks provide enforcement. Both read/write the same files. If the server crashes, hooks still work from files alone.

### What stays the same

- Hook registration in `settings.json` (enforcement layer unchanged)
- `quality-state.json` as the state format
- All existing enforcement behavior (hooks remain the safety net)
- The rule engine from ticket 054 (rules.yaml is the policy source)

### Dependencies

- **Ticket 054** (declarative rule engine) — plan verification checks plans against rules.yaml
- Informed by ticket 053 (state machine model defines valid transitions)

---

## Technical Constraints

### Performance

- [ ] MCP tool responses return in < 100ms (mostly in-memory reads)
- [ ] Server startup < 500ms (Bun stdio process)
- [ ] No impact on hook execution time (hooks read files, not the server)

### Compatibility

- [ ] Works with Claude Code MCP (stdio transport)
- [ ] Works with Cursor MCP (stdio transport)
- [ ] Bun runtime (consistent with hook runtime)
- [ ] Graceful degradation: if server is down, hooks still enforce from files

### Dependencies

- [ ] `@anthropic-ai/mcp` or `@modelcontextprotocol/sdk` (MCP server SDK)
- [ ] `yaml` package (already in project)
- [ ] No other new runtime dependencies

---

## Story 1: MCP server with status tool

**As a** developer using safeword with Claude Code
**I want to** call a single tool to know where I am in the workflow
**So that** I can reorient after context compaction without reading multiple files

**Acceptance Criteria**:

- [ ] MCP server starts as stdio process via `.mcp.json` registration
- [ ] `safeword_status()` returns: active ticket, phase, TDD step, active gate, LOC since commit
- [ ] Response is structured JSON that Claude can reason about
- [ ] Server caches state in memory, refreshes from files when they change
- [ ] Server handles missing state gracefully (no active ticket → returns `{ticket: null}`)
- [ ] Server startup logged at SessionStart (version, rule count)
- [ ] Corrupted quality-state.json returns defaults (same behavior as hooks)
- [ ] Malformed ticket.md frontmatter returns `{ticket: null}` with warning, not crash
- [ ] Missing git repo returns `{lastCommitHash: null, locSinceCommit: 0}`

**Implementation Status**: ❌ Not Started

**Notes**:

### Tool: `safeword_status`

**Input:** None (reads current project state)

**Output:**

```json
{
  "ticket": "054",
  "ticketTitle": "Declarative rule engine for enforcement policies",
  "phase": "implement",
  "tddStep": "green",
  "gate": null,
  "locSinceCommit": 187,
  "locThreshold": 400,
  "lastCommitHash": "a1b2c3d",
  "plan": null
}
```

### Server implementation

```typescript
// .safeword/mcp/server.ts
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

const server = new McpServer({
  name: 'safeword',
  version: '0.1.0',
});

server.tool(
  'safeword_status',
  'Get current workflow state: ticket, phase, TDD step, gates, LOC',
  {},
  async () => {
    const state = await loadState();
    const ticket = await loadActiveTicket(state);
    return { content: [{ type: 'text', text: JSON.stringify(formatStatus(state, ticket)) }] };
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
```

### Registration

```json
// .mcp.json
{
  "mcpServers": {
    "safeword": {
      "type": "stdio",
      "command": "bun",
      "args": [".safeword/mcp/server.ts"]
    }
  }
}
```

### State loading

The server reads the same files the hooks read:

- `quality-state-{sessionId}.json` — gate, LOC, TDD step, commit hash
- Active ticket's `ticket.md` — phase, type, title (from frontmatter)
- `git rev-parse --short HEAD` — current commit (to detect gate clears)

Cache invalidation: re-read files when a tool is called and the file mtime has changed since last read. Simple, no watchers needed.

---

## Story 2: Gate status tool

**As a** developer using safeword
**I want to** ask the server what gate is blocking me and how to clear it
**So that** I get structured, actionable guidance instead of parsing deny message text

**Acceptance Criteria**:

- [ ] `safeword_gate()` returns: gate type, blocked tools, clear condition, suggested action
- [ ] Returns `{gate: null}` when no gate is active
- [ ] Gate types handled: `loc`, `tdd:red`, `tdd:green`, `tdd:refactor`, `phase:{name}`
- [ ] Suggested action is specific (e.g., "git commit" for LOC gate, "write failing test" for tdd:red)
- [ ] Response matches what PreToolUse hook would deny — no contradictions
- [ ] Unknown gate type in state file returns generic response with raw gate value, not crash

**Implementation Status**: ❌ Not Started

**Notes**:

### Tool: `safeword_gate`

**Input:** None

**Output (gate active):**

```json
{
  "gate": "tdd:green",
  "type": "tdd",
  "step": "green",
  "blockedTools": ["Edit", "Write", "MultiEdit", "NotebookEdit"],
  "clearCondition": "Commit your changes to acknowledge the TDD step transition",
  "suggestedAction": "git add -A && git commit -m 'feat: implement scenario'",
  "context": "You completed the RED step. Make the test pass with minimum code."
}
```

**Output (no gate):**

```json
{
  "gate": null,
  "message": "No active gate. You can edit freely."
}
```

### Gate context map

| Gate           | Clear condition             | Context                                                                  |
| -------------- | --------------------------- | ------------------------------------------------------------------------ |
| `loc`          | Commit (resets LOC counter) | "400+ LOC since last commit. Commit to keep changes atomic."             |
| `tdd:red`      | Commit                      | "REFACTOR complete for previous scenario. Write the next failing test."  |
| `tdd:green`    | Commit                      | "RED step complete. Write minimum code to make the test pass."           |
| `tdd:refactor` | Commit                      | "GREEN step complete. Clean up while keeping tests green."               |
| `phase:{name}` | Commit                      | "Phase transitioned to {name}. Commit to acknowledge before continuing." |

---

## Story 3: Plan submission and verification

**As a** developer using safeword
**I want to** submit a structured plan before starting a BDD workflow and have it validated
**So that** structural problems are caught before the first line of code

**Acceptance Criteria**:

- [ ] `safeword_plan(plan)` accepts a structured plan and validates it
- [ ] Validation checks: all required phases present and in order
- [ ] Validation checks: each scenario includes complete TDD cycle (red, green, refactor)
- [ ] Validation checks: done phase includes required evidence types based on ticket type
- [ ] Validation checks: plan is consistent with ticket type (patch/task don't need full BDD)
- [ ] Validation checks against rules.yaml (ticket 054) if available
- [ ] Valid plan stored to `.safeword-project/tickets/{id}/plan.yaml`
- [ ] Invalid plan returns structured errors with specific fix suggestions
- [ ] Re-submission overwrites previous plan (plan versioning via git history)
- [ ] Nonexistent ticket ID returns error with available ticket list
- [ ] Ticket at `done` phase returns error ("ticket already complete, no plan needed")
- [ ] Empty scenarios array returns validation error (plan must have at least one scenario)

**Implementation Status**: ❌ Not Started

**Notes**:

### Tool: `safeword_plan`

**Input:**

```json
{
  "ticket": "054",
  "scenarios": [
    { "name": "rule format and evaluator core", "tdd": ["red", "green", "refactor"] },
    { "name": "migrate config-guard hook", "tdd": ["red", "green", "refactor"] },
    { "name": "migrate quality hooks", "tdd": ["red", "green", "refactor"] },
    { "name": "user-defined rules", "tdd": ["red", "green", "refactor"] }
  ],
  "evidence": ["tests", "scenarios", "audit"]
}
```

**Output (valid):**

```json
{
  "valid": true,
  "planId": "054-v1",
  "summary": {
    "scenarios": 4,
    "tddCycles": 12,
    "estimatedSteps": 12,
    "evidenceTypes": ["tests", "scenarios", "audit"]
  },
  "warnings": [],
  "storedAt": ".safeword-project/tickets/054-declarative-rule-engine/plan.yaml"
}
```

**Output (invalid):**

```json
{
  "valid": false,
  "errors": [
    {
      "field": "scenarios[2].tdd",
      "message": "Missing 'refactor' step. TDD cycle must be [red, green, refactor].",
      "fix": "Add 'refactor' to scenarios[2].tdd"
    },
    {
      "field": "evidence",
      "message": "Feature tickets require 'audit' in evidence. Found: ['tests', 'scenarios'].",
      "fix": "Add 'audit' to evidence array"
    }
  ]
}
```

### Plan validation rules

| Check                       | Applies to               | What it validates                     |
| --------------------------- | ------------------------ | ------------------------------------- |
| Phases present and ordered  | feature                  | All 6 phases in sequence              |
| Scenarios have complete TDD | feature, task            | Each scenario: [red, green, refactor] |
| Evidence includes tests     | feature, task            | `tests` in evidence array             |
| Evidence includes scenarios | feature                  | `scenarios` in evidence array         |
| Evidence includes audit     | feature                  | `audit` in evidence array             |
| Scenario count matches spec | feature (if spec exists) | Plan scenarios ≥ spec story count     |
| Rules.yaml compliance       | all (if 054 shipped)     | Plan doesn't violate declared rules   |

### Plan file format

```yaml
# .safeword-project/tickets/054-declarative-rule-engine/plan.yaml
version: 1
ticket: '054'
type: feature
created: 2026-03-27T00:36:00Z

scenarios:
  - name: 'rule format and evaluator core'
    tdd: [red, green, refactor]
    status: pending # pending | in_progress | completed
    completedAt: null
  - name: 'migrate config-guard hook'
    tdd: [red, green, refactor]
    status: pending
    completedAt: null

evidence:
  - type: tests
    required: true
    collected: false
  - type: scenarios
    required: true
    collected: false
  - type: audit
    required: true
    collected: false

currentScenario: null
currentStep: null
```

---

## Story 4: Live plan tracking (step + advance + amend)

**As a** developer using safeword
**I want to** query my current step and advance through the plan as I complete work
**So that** the plan stays in sync with actual progress without manual file editing

**Acceptance Criteria**:

Step tool (read-only):

- [ ] `safeword_step()` returns current scenario, TDD step, and what to do next
- [ ] `safeword_step()` returns `{plan: null}` if no plan exists (not an error)
- [ ] Plan progress survives server restart (read from plan.yaml on next call)

Advance tool (state mutation):

- [ ] `safeword_advance(step, scenario)` validates the transition and updates plan progress
- [ ] Invalid advances rejected with explanation (e.g., can't skip GREEN)
- [ ] Advancing last step of last scenario marks plan complete
- [ ] All mutations persist to plan.yaml on disk

Amend tool (structural mutation):

- [ ] `safeword_amend(changes)` adds/removes/reorders scenarios in an approved plan
- [ ] Amendments re-validate the full plan (no partial validation)
- [ ] Cannot amend completed scenarios (returns error with explanation)
- [ ] Cannot amend if no plan exists (returns error suggesting safeword_plan first)

**Implementation Status**: ❌ Not Started

**Notes**:

### Tool: `safeword_step`

**Input:** None

**Output (plan active):**

```json
{
  "planId": "054-v1",
  "scenario": "rule format and evaluator core",
  "scenarioIndex": 0,
  "step": "red",
  "instruction": "Write a failing test for rule YAML parsing and evaluation.",
  "progress": {
    "completed": 0,
    "total": 12,
    "percent": 0
  }
}
```

**Output (no plan):**

```json
{
  "plan": null,
  "message": "No plan for active ticket. Call safeword_plan() to submit one, or proceed without a plan."
}
```

### Tool: `safeword_advance`

**Input:**

```json
{
  "completed": "red",
  "scenario": "rule format and evaluator core"
}
```

**Output (valid):**

```json
{
  "valid": true,
  "advanced": { "from": "red", "to": "green" },
  "scenario": "rule format and evaluator core",
  "next": "Write minimum code to make the test pass.",
  "progress": { "completed": 1, "total": 12, "percent": 8 }
}
```

**Output (invalid):**

```json
{
  "valid": false,
  "reason": "Cannot advance from 'red' to 'refactor'. Next expected step is 'green'.",
  "currentStep": "red",
  "expectedNext": "green"
}
```

### Transition rules

```
red → green (only valid next step)
green → refactor (only valid next step)
refactor → red (next scenario) OR complete (last scenario)
```

No step can be skipped. Advancing the last step of the last scenario marks the plan as complete and transitions to evidence collection.

### Tool: `safeword_amend`

**Input:**

```json
{
  "action": "add",
  "scenario": { "name": "stop hook hybrid migration", "tdd": ["red", "green", "refactor"] },
  "after": "migrate quality hooks"
}
```

**Supported actions:** `add` (insert scenario), `remove` (delete scenario), `reorder` (move scenario). Cannot amend completed scenarios.

---

## Story 5: Resources for passive context

**As a** developer using safeword
**I want to** reference `@safeword:plan` and `@safeword:progress` in conversation
**So that** I can pull plan context without a tool call

**Acceptance Criteria**:

- [ ] `@safeword:plan` returns the current approved plan formatted as readable markdown
- [ ] `@safeword:rules` returns all active enforcement rules (built-in + user) formatted as a table
- [ ] `@safeword:progress` returns a dashboard: scenarios done, current step, gates, LOC budget
- [ ] Resources reflect state as of last tool call (mtime-based cache, not real-time watchers)
- [ ] Missing plan/rules return helpful "not configured" messages (not errors)

**Implementation Status**: ❌ Not Started

**Notes**:

### Resource: `@safeword:plan`

```markdown
## Plan for Ticket 054: Declarative Rule Engine

**Status:** In Progress (3/12 steps, 25%)
**Current:** Scenario 1 "rule format and evaluator core" — REFACTOR

| #   | Scenario                       | RED | GREEN | REFACTOR | Status      |
| --- | ------------------------------ | --- | ----- | -------- | ----------- |
| 1   | Rule format and evaluator core | ✅  | ✅    | 🔄       | in_progress |
| 2   | Migrate config-guard hook      | ⬜  | ⬜    | ⬜       | pending     |
| 3   | Migrate quality hooks          | ⬜  | ⬜    | ⬜       | pending     |
| 4   | User-defined rules             | ⬜  | ⬜    | ⬜       | pending     |

**Evidence:** tests ⬜ | scenarios ⬜ | audit ⬜
```

### Resource: `@safeword:progress`

```markdown
## Safeword Progress

**Ticket:** 054 — Declarative rule engine
**Phase:** implement
**TDD Step:** refactor
**Gate:** none
**LOC:** 187 / 400 (47% of threshold)
**Plan:** 3/12 steps (25%)
**Current:** "rule format and evaluator core" → REFACTOR
```

### Resource: `@safeword:rules`

```markdown
## Active Rules (7 built-in + 2 user)

| Rule                         | Event       | Action | Condition                      |
| ---------------------------- | ----------- | ------ | ------------------------------ |
| block-code-edits-in-planning | PreToolUse  | deny   | phase ∈ planning phases        |
| enforce-active-gate          | PreToolUse  | deny   | gate active + not cleared      |
| config-guard                 | PreToolUse  | ask    | file matches config pattern    |
| loc-gate                     | PostToolUse | gate   | LOC > 400                      |
| tdd-step-change              | PostToolUse | gate   | TDD checkbox changed           |
| phase-transition             | PostToolUse | gate   | ticket phase changed           |
| bypass-warn                  | PostToolUse | warn   | content matches bypass pattern |
| protect-database-migrations  | PreToolUse  | ask    | (user rule)                    |
| require-tests-for-api        | PostToolUse | warn   | (user rule)                    |
```

---

## Summary

**Completed**: 0/5 stories (0%)
**Remaining**: 5/5 stories (100%)

### Phase 1: Workflow State (immediate value, no plan dependency) ❌

- Story 1: MCP server with status tool
- Story 2: Gate status tool

### Phase 2: Plan Verification (requires ticket 054) ❌

- Story 3: Plan submission and verification
- Story 4: Live plan tracking (step + advance + amend)

### Phase 3: Polish ❌

- Story 5: Resources for passive context

**Build order:** Stories 1-2 can ship independently — they're useful today without plan verification. Stories 3-4 are the core of Option C and depend on ticket 054's rule engine. Story 5 is polish that makes the server feel native.

**Next Steps**: Implement Story 1 (status tool) as a standalone proof of concept. If it proves useful in daily workflow, continue to Stories 2-5. If the MCP overhead isn't worth it, the status tool is still valuable on its own.

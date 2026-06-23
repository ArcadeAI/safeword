# Test Definitions: Cold-start executability test for high-blast intake

Scenarios are proved by vitest content/subprocess assertions on the authored
instructions (skill + DISCOVERY Intake Exit rung) — the sibling epic-169 pattern
(TPP6Y2 `readiness-pointer.test.ts`, NWFT20 `intake-brief.test.ts`). No cucumber
`.feature`: the deliverable is prose discipline, not executable runtime behavior.
A scenario is non-vacuous only if its assertion would FAIL when the corresponding
instruction is absent, vague, or wrong in the authored text.

test-definitions.md is the R/G/R ledger.

## Rule: The check is offered only on irreversible work (@NTB1.AC1)

### Scenario: one-way-door brief — check is offered at Intake Exit

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: two-way-door brief — no offer

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: cross-cutting brief — offered (data model, public API, and migration each route to an offer)

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: missing Reversibility field — no offer

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: skip:'d Reversibility field — no offer

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: the Intake Exit text directs reading the recorded field and forbids re-judging reversibility there

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: The offer behaves correctly under YOLO (@NTB1.AC1)

### Scenario: under YOLO — offer auto-accepts and logs the auto-decision

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: under YOLO — auto-appended gaps recorded as defer: (the sole reconciliation, no legitimate-wait branch) so the auto-confirming Intake Exit isn't silently blocked

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: A context-free agent plans the work from spec + repo only (@TB1.AC1)

### Scenario: check spawns an isolation:worktree sub-agent with spec + ticket + repo present

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: the sub-agent is given no conversation/transcript — context-free (asserted positively and via anti-pattern)

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: the skill defines a two-valued verdict with rubric — sufficient = plans end-to-end without guessing; insufficient = names a non-empty gap list

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: the cold agent plans, it does not run a full build (text forbids a full TDD build)

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: The verdict is rendered in plain language (@NTB1.AC2)

### Scenario: verdict presented plain-language with an imperative next action and no builder-facing internal jargon (e.g. no "sub-agent"/"isolation: worktree")

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: Gaps are persisted to Open Questions (@TB1.AC2)

### Scenario: gaps appended to a non-empty Open Questions, preserving existing lines (never overwrites — writes by design, diverging from chat-only)

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: gaps appended to an empty Open Questions section (boundary)

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: The check is advisory, never blocks (@NTB1.AC3)

### Scenario: insufficient verdict does not block — builder decides whether to proceed

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: sub-agent error/timeout — noted one line, proceed, no gaps written, no block, no retry-loop

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: The check is invokable on demand (@TB1.AC3)

### Scenario: builder invokes it explicitly regardless of the reversibility read

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: on-demand runs even when the auto-offer would not fire (e.g., two-way-door brief), distinguishing it from the auto-offer path

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

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

- [x] RED ef826fb
- [x] GREEN ef826fb
- [x] REFACTOR ef826fb

### Scenario: two-way-door brief — no offer

- [x] RED ef826fb
- [x] GREEN ef826fb
- [x] REFACTOR ef826fb

### Scenario: cross-cutting brief — offered (data model, public API, and migration each route to an offer)

- [x] RED ef826fb
- [x] GREEN ef826fb
- [x] REFACTOR ef826fb

### Scenario: missing Reversibility field — no offer

- [x] RED ef826fb
- [x] GREEN ef826fb
- [x] REFACTOR ef826fb

### Scenario: skip:'d Reversibility field — no offer

- [x] RED ef826fb
- [x] GREEN ef826fb
- [x] REFACTOR ef826fb

### Scenario: the Intake Exit text directs reading the recorded field and forbids re-judging reversibility there

- [x] RED ef826fb
- [x] GREEN ef826fb
- [x] REFACTOR ef826fb

## Rule: The offer behaves correctly under YOLO (@NTB1.AC1)

### Scenario: under YOLO — offer auto-accepts and logs the auto-decision

- [x] RED ef826fb
- [x] GREEN ef826fb
- [x] REFACTOR ef826fb

### Scenario: under YOLO — auto-appended gaps recorded as defer: (the sole reconciliation, no legitimate-wait branch) so the auto-confirming Intake Exit isn't silently blocked

- [x] RED ef826fb
- [x] GREEN ef826fb
- [x] REFACTOR ef826fb

## Rule: A context-free agent plans the work from spec + repo only (@TB1.AC1)

### Scenario: check spawns an isolation:worktree sub-agent with spec + ticket + repo present

- [x] RED ef826fb
- [x] GREEN ef826fb
- [x] REFACTOR ef826fb

### Scenario: the sub-agent is given no conversation/transcript — context-free (asserted positively and via anti-pattern)

- [x] RED ef826fb
- [x] GREEN ef826fb
- [x] REFACTOR ef826fb

### Scenario: the skill defines a two-valued verdict with rubric — sufficient = plans end-to-end without guessing; insufficient = names a non-empty gap list

- [x] RED ef826fb
- [x] GREEN ef826fb
- [x] REFACTOR ef826fb

### Scenario: the cold agent plans, it does not run a full build (text forbids a full TDD build)

- [x] RED ef826fb
- [x] GREEN ef826fb
- [x] REFACTOR ef826fb

## Rule: The verdict is rendered in plain language (@NTB1.AC2)

### Scenario: verdict presented plain-language with an imperative next action and no builder-facing internal jargon (e.g. no "sub-agent"/"isolation: worktree")

- [x] RED ef826fb
- [x] GREEN ef826fb
- [x] REFACTOR ef826fb

## Rule: Gaps are persisted to Open Questions (@TB1.AC2)

### Scenario: gaps appended to a non-empty Open Questions, preserving existing lines (never overwrites — writes by design, diverging from chat-only)

- [x] RED ef826fb
- [x] GREEN ef826fb
- [x] REFACTOR ef826fb

### Scenario: gaps appended to an empty Open Questions section (boundary)

- [x] RED ef826fb
- [x] GREEN ef826fb
- [x] REFACTOR ef826fb

## Rule: The check is advisory, never blocks (@NTB1.AC3)

### Scenario: insufficient verdict does not block — builder decides whether to proceed

- [x] RED ef826fb
- [x] GREEN ef826fb
- [x] REFACTOR ef826fb

### Scenario: sub-agent error/timeout — noted one line, proceed, no gaps written, no block, no retry-loop

- [x] RED ef826fb
- [x] GREEN ef826fb
- [x] REFACTOR ef826fb

## Rule: The check is invokable on demand (@TB1.AC3)

### Scenario: builder invokes it explicitly regardless of the reversibility read

- [x] RED ef826fb
- [x] GREEN ef826fb
- [x] REFACTOR ef826fb

### Scenario: on-demand runs even when the auto-offer would not fire (e.g., two-way-door brief), distinguishing it from the auto-offer path

- [x] RED ef826fb
- [x] GREEN ef826fb
- [x] REFACTOR ef826fb

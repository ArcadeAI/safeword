# Test definitions — ticket J7VBGJ

Per-scenario SHA-or-skip annotation on the existing RED/GREEN/REFACTOR checkboxes, plus a feature-level cross-scenario refactor row.

The per-scenario `- [ ] RED / GREEN / REFACTOR` checkboxes below use the legacy bare format on purpose — this ticket implements the new annotated format, so the agent dogfoods it only once the write-time hook lands. After that, transitions to `[x]` carry `<sha>` or `skip: <reason>`.

## Rule: Marking a TDD checkbox requires a SHA or skip reason

### Scenario: Valid SHA annotation passes the write-time hook

Given a `test-definitions.md` with `- [ ] RED`
When the agent edits the file and the line becomes `- [x] RED abc1234`
Then the write-time hook allows the edit

- [x] RED 149fe3e
- [x] GREEN ee1f54c
- [x] REFACTOR skip: no structural improvement needed — gate logic is ~60 LOC across 3 small functions with parallel dispatcher branches, no duplication

### Scenario: Bare checkmark transition is blocked

Given a `test-definitions.md` with `- [ ] GREEN`
When the agent edits the file and the line becomes `- [x] GREEN` (no SHA, no skip)
Then the write-time hook blocks the edit with a message naming the offending line and the required syntax

- [x] RED 149fe3e
- [x] GREEN ee1f54c
- [x] REFACTOR skip: no structural improvement needed — see scenario 1 ledger above

### Scenario: Skip with non-empty reason passes

Given a `test-definitions.md` with `- [ ] REFACTOR`
When the agent edits the file and the line becomes `- [x] REFACTOR skip: trivial — no structural change`
Then the write-time hook allows the edit

- [x] RED 149fe3e
- [x] GREEN ee1f54c
- [x] REFACTOR skip: no structural improvement needed — see scenario 1 ledger above

### Scenario: Skip with empty reason is blocked at write-time

Given a `test-definitions.md` with `- [ ] REFACTOR`
When the agent edits the file and the line becomes `- [x] REFACTOR skip:`
Then the write-time hook blocks the edit, citing the empty-reason rule

- [x] RED 149fe3e
- [x] GREEN ee1f54c
- [x] REFACTOR skip: no structural improvement needed — see scenario 1 ledger above

### Scenario: Skip with whitespace-only reason is blocked at write-time

Given a `test-definitions.md` with `- [ ] REFACTOR`
When the agent edits the file and the line becomes `- [x] REFACTOR skip:` (only spaces after the colon)
Then the write-time hook blocks the edit, citing the empty-reason rule

- [x] RED 149fe3e
- [x] GREEN ee1f54c
- [x] REFACTOR skip: no structural improvement needed — see scenario 1 ledger above

### Scenario: Pre-existing bare `[x]` is silently allowed

Given a `test-definitions.md` already containing `- [x] RED` (no annotation, written before this feature shipped)
When the agent makes an unrelated edit that does not touch this line
Then the write-time hook allows the edit (legacy checkboxes carry no validation cost)

- [x] RED 149fe3e
- [x] GREEN ee1f54c
- [x] REFACTOR skip: no structural improvement needed — see scenario 1 ledger above

## Rule: REFACTOR commits must not touch test files

Scope-reduction note (2026-05-21): originally this rule had 5 scenarios covering RED/GREEN/REFACTOR file-path rules. After re-reading `.safeword-project/learnings/procedural-gates-generalize-beyond-tdd.md` (TDAD finding: rigid procedural rules degrade agent performance), the RED and GREEN rules were dropped — they were not load-bearing because the SHA-distinctness check at done already catches commit bundling. The REFACTOR rule stays because it is the only file-path rule that catches something the SHA mechanism cannot: test-behavior drift during cleanup.

### Scenario: REFACTOR-step commit touching only app code passes

Given the parser-derived current TDD step is REFACTOR
And the staged changes contain only non-test source files
When the agent runs `git commit`
Then the commit-time hook allows the commit

- [x] RED 2939941
- [x] GREEN ba86f2b
- [x] REFACTOR skip: no structural improvement needed — gate is ~40 LOC in a single function with a clear semantics comment

### Scenario: REFACTOR-step commit touching any test file is blocked

Given the parser-derived current TDD step is REFACTOR
And the staged changes include at least one test file
When the agent runs `git commit`
Then the commit-time hook blocks the commit, naming the offending test file and citing the no-behavior-change rule

- [x] RED 2939941
- [x] GREEN ba86f2b
- [x] REFACTOR skip: no structural improvement needed — see scenario 7 ledger above

## Rule: Done gate validates SHAs are distinct and reachable

### Scenario: Scenario with three distinct, HEAD-reachable SHAs passes

Given a scenario whose RED, GREEN, and REFACTOR checkboxes each carry a distinct SHA reachable from HEAD
When the agent invokes the done gate
Then the gate accepts the scenario

- [x] RED a0e1935
- [x] GREEN 1000536
- [x] REFACTOR skip: no structural improvement needed — validateLedger is ~110 LOC across three well-separated helpers (parseLedger, validateScenario, validateCrossScenario)

### Scenario: Scenario with RED and GREEN sharing one SHA fails

Given a scenario whose RED and GREEN checkboxes carry the same SHA
When the agent invokes the done gate
Then the gate fails, naming the scenario and identifying the collision

- [x] RED a0e1935
- [x] GREEN 1000536
- [x] REFACTOR skip: no structural improvement needed — validateLedger is ~110 LOC across three well-separated helpers (parseLedger, validateScenario, validateCrossScenario)

### Scenario: Scenario with a SHA unreachable from HEAD fails

Given a scenario whose REFACTOR checkbox carries a SHA that does not exist in the current branch history
When the agent invokes the done gate
Then the gate fails, naming the scenario and the unreachable SHA

- [x] RED a0e1935
- [x] GREEN 1000536
- [x] REFACTOR skip: no structural improvement needed — validateLedger is ~110 LOC across three well-separated helpers (parseLedger, validateScenario, validateCrossScenario)

### Scenario: Scenario with one real SHA and two skip:reason entries passes

Given a scenario whose RED checkbox carries a real SHA and whose GREEN and REFACTOR checkboxes both carry `skip: <non-empty reason>`
When the agent invokes the done gate
Then the gate accepts the scenario

- [x] RED a0e1935
- [x] GREEN 1000536
- [x] REFACTOR skip: no structural improvement needed — validateLedger is ~110 LOC across three well-separated helpers (parseLedger, validateScenario, validateCrossScenario)

### Scenario: Scenario with three skip: entries fails

Given a scenario whose RED, GREEN, and REFACTOR checkboxes all carry `skip:` entries
When the agent invokes the done gate
Then the gate fails with the message "scenario represents work that produced no commits"

- [x] RED a0e1935
- [x] GREEN 1000536
- [x] REFACTOR skip: no structural improvement needed — validateLedger is ~110 LOC across three well-separated helpers (parseLedger, validateScenario, validateCrossScenario)

## Rule: Feature-level cross-scenario refactor row obeys the same rules

### Scenario: Cross-scenario row with SHA at done passes

Given a `test-definitions.md` whose feature-level row reads `- [x] cross-scenario abc1234` with the SHA reachable from HEAD
When the agent invokes the done gate
Then the gate accepts the feature

- [x] RED a0e1935
- [x] GREEN 1000536
- [x] REFACTOR skip: no structural improvement needed — validateLedger is ~110 LOC across three well-separated helpers (parseLedger, validateScenario, validateCrossScenario)

### Scenario: Cross-scenario row with skip:reason at done passes

Given a `test-definitions.md` whose feature-level row reads `- [x] cross-scenario skip: no shared fixtures emerged`
When the agent invokes the done gate
Then the gate accepts the feature

- [x] RED a0e1935
- [x] GREEN 1000536
- [x] REFACTOR skip: no structural improvement needed — validateLedger is ~110 LOC across three well-separated helpers (parseLedger, validateScenario, validateCrossScenario)

### Scenario: Missing cross-scenario row fails done

Given a `test-definitions.md` with no feature-level cross-scenario row
When the agent invokes the done gate
Then the gate fails with a message naming the missing row and the required syntax

- [x] RED a0e1935
- [x] GREEN 1000536
- [x] REFACTOR skip: no structural improvement needed — validateLedger is ~110 LOC across three well-separated helpers (parseLedger, validateScenario, validateCrossScenario)

### Scenario: Cross-scenario row with empty skip reason fails done

Given a `test-definitions.md` whose feature-level row reads `- [x] cross-scenario skip:`
When the agent invokes the done gate
Then the gate fails, citing the empty-reason rule

- [x] RED a0e1935
- [x] GREEN 1000536
- [x] REFACTOR skip: no structural improvement needed — validateLedger is ~110 LOC across three well-separated helpers (parseLedger, validateScenario, validateCrossScenario)

---

## Feature-level cross-scenario refactor

This row is enforced at the done gate per the rules above. It must be either checked with a SHA or checked with `skip: <non-empty reason>` before this feature's own done gate accepts.

- [x] cross-scenario skip: parse-annotation.ts was designed up front as the shared seam between the three gates; no other cross-cutting code emerged that would benefit from extraction

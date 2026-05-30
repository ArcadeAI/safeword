# Test Definitions: Per-step / per-phase quality reviews (SXSCJQ)

## Rule: Each TDD-step flip surfaces its step review (PostToolUse → additionalContext)

### Scenario: RED flip surfaces the red step review

Given an active feature ticket in the implement phase
When a PostToolUse edit flips `- [ ] RED` to `- [x] RED <sha>` in test-definitions.md
Then the hook emits `getQualityMessage('implement', 'red')` as `hookSpecificOutput.additionalContext`
And it records that the red step was reviewed

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: GREEN flip surfaces the green step review

Given an active feature ticket in the implement phase
When a PostToolUse edit flips `- [ ] GREEN` to `- [x] GREEN <sha>`
Then the hook emits `getQualityMessage('implement', 'green')` as `additionalContext`
And it records that the green step was reviewed

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: REFACTOR flip surfaces the refactor step review

Given an active feature ticket in the implement phase
When a PostToolUse edit flips `- [ ] REFACTOR` to `- [x] REFACTOR <sha>`
Then the hook emits `getQualityMessage('implement', 'refactor')` as `additionalContext`
And it records that the refactor step was reviewed

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A test-definitions edit with no checkbox flip surfaces nothing

Given a test-definitions.md edit that changes prose but flips no `[ ]→[x]`
When the PostToolUse hook runs
Then no review is surfaced (no `additionalContext`, exit clean)

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Multiple flips in one edit review only the most-advanced step

Given a single edit that flips both `[ ] RED` and `[ ] GREEN` to checked
When the PostToolUse hook runs
Then only the green (most-advanced) message is surfaced
And the green step is recorded as reviewed (red is not separately surfaced)

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Three flips across one turn surface three distinct reviews

Given an implement-phase turn that flips RED, then GREEN, then REFACTOR in three separate edits
When each edit triggers its own PostToolUse call
Then three distinct step reviews are surfaced (red, then green, then refactor) — not just the last
And this holds whether or not the turn ever reaches a Stop

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: Each phase transition surfaces its phase review (PostToolUse), no Stop required

### Scenario: A phase-frontmatter change surfaces the entered-phase review

Given a ticket.md edit that changes `phase: define-behavior` to `phase: scenario-gate`
When the PostToolUse hook runs
Then the hook emits `getQualityMessage('scenario-gate')` as `additionalContext`
And it records that the scenario-gate phase was reviewed
And this fires from the edit alone, with no Stop event involved (autonomous-safe)

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A ticket.md edit not touching phase surfaces nothing

Given a ticket.md edit that changes the work log or scope but leaves `phase:` unchanged
When the PostToolUse hook runs
Then no review is surfaced (no `additionalContext`, exit clean)

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: Each boundary is reviewed once across PostToolUse + Stop (dedup)

### Scenario: Stop skips a step already reviewed by PostToolUse

Given PostToolUse recorded the current derived step as reviewed this session
When the Stop hook runs and derives that same step
Then no step review is surfaced at Stop (dedup — the live review already fired)

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Stop backstops a boundary crossed without an edit

Given a phase changed via a non-edit path so the recorded reviewed-phase lags the current phase
When the Stop hook runs
Then the phase review is surfaced via the bypassable `decision:block`
And it records that phase as reviewed

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Stop skips a phase already reviewed by PostToolUse

Given PostToolUse recorded the current phase as reviewed this session
When the Stop hook runs in that same phase
Then no phase review is surfaced at Stop (dedup)

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: Implement reviews no longer gated by LOC

> Rationale: the removed `LOC_REVIEW_THRESHOLD` previously suppressed the
> implement-phase Stop review under 50 LOC. With the throttle gone, the firing
> decision no longer reads `locSinceCommit` / `locAtLastReview`.

### Scenario: A small change at an unreviewed boundary still triggers the review

Given the implement phase with fewer than 50 LOC since the last review and a boundary not yet reviewed
When the Stop hook runs
Then the review is surfaced (no LOC-based suppression)

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

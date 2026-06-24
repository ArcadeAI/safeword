# Test Definitions: LOC Gate Clears Below Threshold (Issue #369)

Feature source: `planning/user-stories/issue-369-loc-gate-clears-below-threshold.md`

## Rule: LOC gate state follows the current measured diff

### Scenario: PostToolUse clears stale LOC gate after cleanup without commit

- [x] RED
- [x] GREEN
- [x] REFACTOR

## Rule: PreToolUse does not hard-block inconsistent below-threshold LOC state

### Scenario: PreToolUse allows gate loc when stored LOC is below threshold

- [x] RED
- [x] GREEN
- [x] REFACTOR

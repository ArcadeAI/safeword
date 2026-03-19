# Test Definitions: [Feature Name] (Issue #[number])

**Guide**: `.safeword/guides/testing-guide.md` - Structure, status tracking, and TDD workflow
**Template**: `.safeword/templates/test-definitions-feature.md`

**Feature**: [Brief description of the feature]

**Related Issue**: #[number]
**Test File**: `[path/to/test.spec.ts]`
**Total Tests**: [N] ([X] passing, [Y] skipped, [Z] not implemented)

---

## Test Suite [N]: [Suite Name]

[Brief description of what this test suite covers]

### Test [N.1]: [Test name] [✅/⏭️/❌]

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

**Status**: [✅ Passing / ⏭️ Skipped / ❌ Not Implemented / 🔴 Failing]
**Description**: [What this test verifies]

**Steps**:

1. [Action 1]
2. [Action 2]
3. [Action 3]

**Expected**:

- [Expected outcome 1]
- [Expected outcome 2]
- [Expected outcome 3]

---

### Test [N.2]: [Test name] [✅/⏭️/❌]

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

**Status**: [✅ Passing / ⏭️ Skipped / ❌ Not Implemented / 🔴 Failing]
**Description**: [What this test verifies]

**Steps**:

1. [Action 1]
2. [Action 2]

**Expected**:

- [Expected outcome 1]
- [Expected outcome 2]

---

## Test Suite [N+1]: [Suite Name]

[Brief description of what this test suite covers]

### Test [N+1.1]: [Test name] [✅/⏭️/❌]

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

**Status**: [✅ Passing / ⏭️ Skipped / ❌ Not Implemented / 🔴 Failing]
**Description**: [What this test verifies]

**Steps**:

1. [Action 1]
2. [Action 2]

**Expected**:

- [Expected outcome 1]

---

## Test Suite [N]: Technical Constraints

_Tests for non-functional requirements from user story Technical Constraints section. Add tests for each applicable category: Performance, Security, Compatibility, Data, Dependencies, Infrastructure. Delete this suite if no constraints apply._

### Test [N.1]: [Constraint name] [✅/⏭️/❌]

**Status**: [✅ Passing / ⏭️ Skipped / ❌ Not Implemented / 🔴 Failing]
**Category**: [Performance / Security / Compatibility / Data / Dependencies / Infrastructure]
**Constraint**: [Copy exact constraint from user story, e.g., "API response < 200ms at P95"]

**Steps**:

1. [Setup test conditions]
2. [Execute operation]
3. [Measure/verify result]

**Expected**:

- [Measurable outcome matching constraint]

---

## Summary

**Total**: [N] tests
**Passing**: [X] tests ([X]%)
**Skipped**: [Y] tests ([Y]%)
**Not Implemented**: [Z] tests ([Z]%)
**Failing**: [F] tests ([F]%)

### Coverage by Feature

| Feature     | Tests   | Status       |
| ----------- | ------- | ------------ |
| [Feature 1] | [X]/[N] | [✅/❌] [X]% |
| [Feature 2] | [X]/[N] | [✅/❌] [X]% |
| [Feature 3] | [X]/[N] | [✅/❌] [X]% |

### Skipped Tests Rationale

1. **Test [N.X]** ([Test name]): [Reason for skipping - e.g., conflicts with design decision, requires manual testing, etc.]
2. **Test [N.Y]** ([Test name]): [Reason for skipping]

---

## Test Execution

```bash
# Run all tests for this feature
[command to run all tests]

# Run specific test
[command to run specific test with --grep flag]
```

---

**Last Updated**: [YYYY-MM-DD]

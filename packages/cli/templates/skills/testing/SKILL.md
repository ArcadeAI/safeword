---
name: testing
description: How to write good tests. Use when writing tests in any context — 'write tests', 'add tests', 'test this', 'need tests for', 'improve coverage'. Explicitly invoked by other skills at specific phases — BDD TDD.md at RED phase, tdd-review at GREEN gate (coverage adequacy), refactor at PROTECT phase (characterization tests), and /debug. Core knowledge for test quality across all workflows.
user-invocable: false
allowed-tools: '*'
---

# Writing Good Tests

Tests prove the system behaves correctly. Every test must verify **observable behavior**, not implementation details.

**Scope preference:** Prefer the highest scope that covers the behavior with acceptable feedback speed.

For patterns, examples, and the full test type decision tree, see `.safeword/guides/testing-guide.md`.

---

## Iron Laws

Non-negotiable at every test level. Violating these produces tests that pass but catch nothing.

### 1. Test Behavior, Not Implementation

```typescript
// WRONG — tests internal state
expect(component.state.count).toBe(1);
expect(mockFn).toHaveBeenCalledWith('internal-detail');

// RIGHT — tests observable behavior
expect(screen.getByText('Count: 1')).toBeVisible();
expect(result).toEqual({ total: 42 });
```

This applies at EVERY level:

- **Unit:** assert on return values, not on which helpers were called
- **Integration:** assert on API responses, not on which service methods fired
- **E2E:** assert on what the user sees, not on DOM structure
- **Eval:** grade the output quality, not the path the LLM took

### 2. Every Test Needs a Meaningful Assertion

If your assertion would pass for ANY input, it asserts nothing.

```typescript
// WRONG — asserts nothing useful
expect(result).toBeTruthy();
expect(result).toBeDefined();

// RIGHT — asserts specific behavior
expect(processData(input)).toEqual({ status: 'ok', count: 3 });
```

### 3. Tests Must Fail First

A new test that passes immediately is testing nothing. For new behavior: RED then GREEN.

### 4. One Test, One Behavior

If a test name has "and" in it, split it.

```typescript
// WRONG
it('validates input and saves to database', ...);

// RIGHT
it('rejects input missing required field', ...);
it('saves valid input to database', ...);
```

### 5. Tests Must Be Independent

No test depends on another test's side effects. Fresh state per test. Run in any order.

---

## Anti-Patterns

| Pattern                     | Problem                                           | Fix                                                                          |
| --------------------------- | ------------------------------------------------- | ---------------------------------------------------------------------------- |
| **Coverage theater**        | High line coverage, tests catch no bugs           | Every test should fail if you break the behavior it guards                   |
| **Mock everything**         | Tests only verify mock wiring, not real behavior  | Use real dependencies where practical; mock only external services           |
| **Duplicate tests**         | 20 tests with same structure, different values    | Use parameterized/table-driven tests: `it.each(...)`                         |
| **Happy-path only**         | Misses edge cases where real bugs live            | Always include: empty input, boundary values, error paths                    |
| **Hardcoded magic values**  | Timestamps, IDs, paths break across environments  | Use builders, relative values, or factories                                  |
| **Snapshot overuse**        | Large snapshots pass review without scrutiny      | Prefer targeted assertions; snapshots only for large stable structures       |
| **Testing private methods** | Couples tests to implementation                   | Test through the public API                                                  |
| **Exact UI text matching**  | Breaks on copy changes                            | Use regex `/submit/i` or data-testid attributes                              |
| **Bug-locking**             | Tests written against buggy code encode the bug   | Write tests BEFORE implementation (TDD), or verify behavior is correct first |
| **Scope defaulting**        | AI defaults to unit tests for everything          | Ask "what's the highest scope with acceptable feedback speed?" first         |
| **Tautological test**       | Assertion mirrors implementation, catches nothing | Assert on behavior independently of the code under test                      |

---

## Quick Reference

| Need                             | Action                                            |
| -------------------------------- | ------------------------------------------------- |
| Full test type selection guide   | `.safeword/guides/testing-guide.md`               |
| Test definition template (BDD)   | `.safeword/templates/test-definitions-feature.md` |
| Test quality review              | `/audit`                                          |
| Feature-level TDD with scenarios | `/bdd`                                            |
| Debugging failing tests          | `/debug`                                          |

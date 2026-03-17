---
name: testing
description: How to write good tests. Use when writing tests in any context — 'write tests', 'add tests', 'test this', 'need tests for', 'improve coverage'. Also consult when writing tests during /bdd or /debug. Core knowledge for test quality across all workflows.
allowed-tools: '*'
---

# Writing Good Tests

Tests catch bugs. Bad tests give false confidence. Know the difference.

**Iron Law:** A TEST THAT CAN'T FAIL IS WORTHLESS

---

## Iron Laws

Non-negotiable. Violating any of these produces tests that pass but catch nothing.

### 1. Test Behavior, Not Implementation

Test what the code DOES, not how it does it. Tests coupled to internals break on every refactor.

```typescript
// WRONG — tests internal state
expect(component.state.count).toBe(1);
expect(mockFn).toHaveBeenCalledWith('internal-detail');

// RIGHT — tests observable behavior
expect(screen.getByText('Count: 1')).toBeVisible();
expect(result).toEqual({ total: 42 });
```

### 2. Every Test Needs a Meaningful Assertion

If your assertion would pass for ANY input, it asserts nothing.

```typescript
// WRONG — asserts nothing useful
expect(() => processData(input)).not.toThrow();
expect(result).toBeTruthy();
expect(result).toBeDefined();

// RIGHT — asserts specific behavior
expect(processData(input)).toEqual({ status: 'ok', count: 3 });
expect(result.errors).toHaveLength(0);
```

### 3. Tests Must Fail First

A new test that passes immediately is testing nothing — or testing something that already works (no value added). For new behavior: RED then GREEN. For existing code: if a characterization test fails, you found a bug.

### 4. One Test, One Behavior

If a test name has "and" in it, split it. Each test verifies ONE observable outcome.

```typescript
// WRONG
it('validates input and saves to database', ...);

// RIGHT
it('rejects input missing required field', ...);
it('saves valid input to database', ...);
```

### 5. Tests Must Be Independent

No test depends on another test's side effects. Fresh state per test. Run in any order.

```typescript
// WRONG — shared mutable state
let user = createUser();
it('test A', () => {
  user.name = 'Alice';
});
it('test B', () => {
  expect(user.name).toBe('Alice');
}); // Depends on A!

// RIGHT
beforeEach(() => {
  user = createUser();
});
```

---

## Anti-Patterns

These are the most common ways AI-generated tests go wrong. Watch for all of them.

| Pattern                     | Problem                                          | Fix                                                                          |
| --------------------------- | ------------------------------------------------ | ---------------------------------------------------------------------------- |
| **Coverage theater**        | High line coverage, tests catch no bugs          | Every test should fail if you break the behavior it guards                   |
| **Mock everything**         | Tests only verify mock wiring, not real behavior | Use real dependencies where practical; mock only external services           |
| **Duplicate tests**         | 20 tests with same structure, different values   | Use parameterized/table-driven tests: `it.each(...)`                         |
| **Happy-path only**         | Misses edge cases where real bugs live           | Always include: empty input, boundary values, error paths                    |
| **Hardcoded magic values**  | Timestamps, IDs, paths break across environments | Use builders, relative values, or factories                                  |
| **Snapshot overuse**        | Large snapshots pass review without scrutiny     | Prefer targeted assertions; snapshots only for large stable structures       |
| **Testing private methods** | Couples tests to implementation                  | Test through the public API                                                  |
| **Exact UI text matching**  | Breaks on copy changes                           | Use regex `/submit/i` or data-testid attributes                              |
| **Bug-locking**             | Tests written against buggy code encode the bug  | Write tests BEFORE implementation (TDD), or verify behavior is correct first |

---

## Choosing the Right Test Type

AI defaults to unit tests for everything. That's wrong. Choose the fastest type that catches the bug.

```text
1. Tests AI-generated content quality?     → LLM Evaluation
2. Requires a real browser?                → E2E test
3. Tests multiple modules/services?        → Integration test
4. Tests a pure function (input → output)? → Unit test
5. None of the above?                      → Re-evaluate what you're testing
```

**Announce your decision:** "Test type: [unit/integration/E2E/LLM eval] because [reason]."

For the full decision tree, bug detection matrix, and edge cases: `.safeword/guides/testing-guide.md`

---

## Writing Approach

### Match Existing Style

Before writing any test, find existing tests near the code under test. Match their imports, describe/it structure, helpers, and patterns. Don't introduce new conventions into an established test suite.

If no existing tests: use AAA pattern (Arrange-Act-Assert).

### Design Before Writing

List planned tests before coding. For each test, name:

- **What behavior** it verifies (not what code it calls)
- **What the key assertion is** (not "it doesn't throw")
- **Why this test matters** (what bug would slip through without it?)

Aim for: happy path + edge cases + error cases + at least one test the implementation could plausibly get wrong.

### One Test at a Time

Write one test → run it → verify it fails (or passes for characterization) → move to next. Never write all tests at once then run them.

---

## Patterns

### Test Data Builders

```typescript
function buildUser(overrides = {}) {
  return { id: 'test-1', name: 'Test User', role: 'member', ...overrides };
}

it('applies VIP discount', () => {
  const user = buildUser({ role: 'vip' });
  expect(calculateDiscount(user)).toBe(0.2);
});
```

### Async Testing — Never Use Arbitrary Timeouts

```typescript
// WRONG
await sleep(3000);
await page.waitForTimeout(500);

// RIGHT — wait for condition
await expect.poll(() => getStatus()).toBe('ready');
await waitFor(() => expect(element).toBeVisible());
```

### Descriptive Test Names

```typescript
// WRONG
it('works correctly');
it('should handle edge case');

// RIGHT
it('returns 401 when API key is missing');
it('preserves user input after validation error');
```

---

## Quick Reference

| Need                             | Action                                            |
| -------------------------------- | ------------------------------------------------- |
| Full test type selection guide   | `.safeword/guides/testing-guide.md`               |
| Test definition template (BDD)   | `.safeword/templates/test-definitions-feature.md` |
| Test quality review              | `/audit`                                          |
| Feature-level TDD with scenarios | `/bdd`                                            |
| Debugging failing tests          | `/debug`                                          |

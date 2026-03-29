---
id: '084'
slug: weak-test-assertions
title: 'Replace weak test assertions with specific value checks'
type: Improvement
status: open
---

# Task: Replace weak test assertions with specific value checks

**Type:** Improvement

**Scope:** Replace `toBeTruthy()`, `toBeDefined()`, and `not.toThrow()` with specific value assertions across 24 test files (63 occurrences). Focus on highest concentration files first.

**Out of Scope:** Adding new test coverage, refactoring test structure, changing test behavior.

**Context:** Flagged in audit. Weak assertions like `expect(existsSync(path)).toBeTruthy()` pass when the value is any truthy value, masking potential type issues. `expect(existsSync(path)).toBe(true)` is more precise and fails more helpfully.

**Priority files (by occurrence count):**

1. `setup-hooks.test.ts` — 14 occurrences
2. `golden-path.test.ts` — 6 occurrences
3. `setup-reconcile.test.ts` — 5 occurrences
4. `setup-cursor.test.ts` — 3 occurrences
5. `setup-git.test.ts` — 4 occurrences

**Pattern:**

```typescript
// Before
expect(existsSync(path)).toBeTruthy();
expect(result).toBeDefined();

// After
expect(existsSync(path)).toBe(true);
expect(result).toEqual(expectedValue); // or specific shape
```

**Done When:**

- [ ] All `toBeTruthy()` on boolean expressions replaced with `toBe(true)`
- [ ] `toBeDefined()` replaced with specific value assertions where possible
- [ ] All tests still pass

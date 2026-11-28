---
name: testing
description: How to write good tests. Use when writing tests, improving test
  coverage, or evaluating test quality. Also invoked by other skills — BDD at
  RED phase, tdd-review at GREEN gate, refactor at PROTECT phase, and debug.
  Core test quality knowledge across all workflows.
user-invocable: false
allowed-tools: '*'
---

# Writing Good Tests

<!-- SAFEWORD:TESTING_CORE_START -->
<!-- source: src/testing/shared-core.ts; sha256: 3ef67a9e573e0f3a94f1348ef859a3a658b567c29785d90efdc436c392deef33 -->

## Essential testing rules

State the test-scope choice and why in one line, unless it's obvious from context.

A suite that fakes _internal_ seams can be fully green while the real wiring is
broken. Name the **process boundary** you mock — the network, filesystem, clock,
or subprocess at the edge of your code — and mock _only_ that. Every entry point
or command that wires modules together gets **≥1 test built from real
collaborators**, faking nothing but that boundary.

If the only way to exercise a code path is through an injected internal value
(`provider: 'none'`, a hand-passed `repoVisibility`) and never through the real
command, that path has **no wiring test** — add one.

Before writing or reviewing tests, identify the distinct behavior partitions and choose a representative for each, including validation failures for individual inputs or input combinations. For bounded inputs, include a value strictly inside the valid range when one exists, boundary values, and out-of-range values, whether accepted or rejected. Check that the resulting tests cover those choices before reporting completion.

<!-- SAFEWORD:TESTING_CORE_END -->

Tests prove the system behaves correctly. Every test — unit, integration, E2E, eval — must verify **observable behavior**, not implementation details.

**Core Principle:** TEST BEHAVIOR, NOT IMPLEMENTATION

---

## Philosophy: Behavior-Biased Testing

**What this means:** At every test level, assert on what the system _does_ (outputs, side effects, user-visible outcomes) — never on _how_ it does it (internal state, mock call counts, private methods).

**Why:** Tests coupled to implementation break on every refactor. Behavioral tests survive refactoring because behavior doesn't change — only the internals do.

**Scope preference:** When multiple test types can verify a behavior, prefer the highest scope that covers the behavior with acceptable feedback speed. Higher scope = more confidence that the real system works.

```text
Prefer (highest confidence):
  E2E        → proves the user can do the thing
  Integration → proves components work together
  Unit        → proves the algorithm is correct
Fallback (lowest scope):
```

**When to drop to a lower scope:**

- Pure function with many edge cases (20+ combinations) → unit test
- Internal service boundary, no UI involved → integration test
- Algorithm with complex logic (parsing, math, state machines) → unit test
- Only one module's contract matters → integration test

**When to stay at higher scope:**

- User-facing feature or workflow → E2E
- Multiple modules must cooperate → integration or E2E
- "If this breaks, users notice immediately" → E2E

Use the decision tree, bug detection matrix, and edge cases in this skill.

---

## Iron Laws

Non-negotiable at every test level. Violating these produces tests that pass but catch nothing.

### 1. Test Behavior, Not Implementation

This applies at EVERY level:

- **Unit:** assert on return values, not on which helpers were called
- **Integration:** assert on API responses, not on which service methods fired
- **E2E:** assert on what the user sees, not on DOM structure
- **Eval:** grade the output quality, not the path the LLM took

### 2. Every Test Needs a Meaningful Assertion

If your assertion would pass for ANY input, it asserts nothing.

### 3. Tests Must Fail First

A new test that passes immediately is testing nothing — or testing something that already works (no value added). For new behavior: RED then GREEN. For existing code: if a characterization test fails, you found a bug.

### 4. One Test, One Behavior

If a test name has "and" in it, split it. Each test verifies ONE observable outcome.

### 5. Tests Must Be Independent

No test depends on another test's side effects. Fresh state per test. Run in any order.

---

## Anti-Patterns

The most common ways AI-generated tests go wrong. Watch for all of them.

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
| **Scope defaulting**        | AI defaults to unit tests for everything         | Ask "what's the highest scope with acceptable feedback speed?" first         |

---

## Behavioral Testing by Type

### Unit Tests — Behavioral

Test the contract (inputs → outputs), not the internals.

### Integration Tests — Behavioral

Test that components produce correct combined outcomes with real dependencies.

### E2E Tests — Behavioral

Test what the user can see and do. E2E tests are naturally behavioral — lean into this.

### LLM Evals — Behavioral

Grade what the output _achieves_, not the path the model took. Use deterministic assertions first, LLM-as-judge second.

Eval-specific principles:

- **Grade outcomes, not paths** — the LLM can take any route to the right answer
- **Binary PASS/FAIL over scales** — "3 vs 4" is meaningless; force clarity
- **One dimension per scorer** — don't bundle factuality + tone + completeness
- **Deterministic checks first** — regex, schema validation, required fields before LLM-as-judge

### Wiring Tests — Mock Only the Process Boundary

Apply [Essential testing rules](SKILL.md#essential-testing-rules) above. For examples, open `.safeword/guides/testing-guide.md` and find its “Optional worked examples” → “Wiring Tests — Mock Only the Process Boundary” section.

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

### Async Testing — Never Use Arbitrary Timeouts

### Descriptive Test Names

---

## Working Around An Upstream Bug? Ship A Tripwire

When you pin a dependency to dodge someone else's bug, the workaround is
temporary by intent and permanent in practice — comments and tickets do not
reach whoever eventually holds the code.

Write a test that asserts the dependency is **still pinned at the last
known-bad version**, with a file header naming what to delete when it fails.
The next upgrade turns CI red in front of the person doing the upgrade.

Assert the pin, never the bug — a test that reproduces the bug goes green when
upstream fixes it, silently, leaving the dead workaround behind.

Warranted when removal depends on someone else's release _and_ the failure
mode is silent. Apply the upstream-workaround tripwire rules in this skill.

---

## Quick Reference

Optional worked examples: read the installed `.safeword/guides/testing-guide.md#optional-worked-examples`.

---
name: tdd-review
description: Quality checkpoint at TDD step boundaries. Reviews test quality
  after RED, implementation correctness after GREEN, and scenario completeness
  after REFACTOR. Use during task-level TDD or feature-level implementation
  when completing a step and wanting a quality check before moving on.
allowed-tools: '*'
---

# TDD Review

Step-aware quality review at TDD phase boundaries. Fires when a sub-checkbox is marked in test-definitions.md during implement phase.

## Detect Step

Read the gate message to determine which TDD step is next:

| Gate triggered | Step just completed           | Review focus              |
| -------------- | ----------------------------- | ------------------------- |
| `tdd:green`    | RED (test written)            | Review test quality       |
| `tdd:refactor` | GREEN (implementation passes) | Review implementation     |
| `tdd:red`      | REFACTOR (cleanup done)       | Review completed scenario |

## GREEN Gate (RED just completed — review test)

Focused review (~1 minute). Check the test that was just written:

- **Atomic?** Tests ONE behavior. Red flag: multiple When/Then pairs.
- **Right assertions?** Meaningful expectations, not `.toBeTruthy()` or `.not.toThrow()`.
- **Behavior, not implementation?** Tests observable outcomes. Red flag: mocking internals, checking call counts.
- **Fails for the right reason?** Missing behavior, not syntax errors.
- **Right test type?** Load the testing skill and consult its scope hierarchy (E2E > Integration > Unit). Was a higher-scope test practical here? Did we drop to unit when integration would catch more?
- **Coverage adequacy?** Consult testing guide's bug detection matrix. Ask: "What could still break that this test wouldn't catch?" Flag gaps — missing edge cases, error paths, or boundary values — as candidates for additional scenarios.

If issues found: fix before implementing. If clean: commit and proceed to implementation.

## REFACTOR Gate (GREEN just completed — review implementation)

Moderate review (~1-2 minutes). Check the implementation:

- **Minimal?** Only code the test requires. No anticipatory design.
- **Correct?** Does it actually satisfy the test's intent, not just make it pass by coincidence?
- **No regressions?** Full test suite still passes.
- **Run /refactor** for structural cleanup.

If issues found: fix before refactoring. If clean: run /refactor, commit, proceed.

## RED Gate (REFACTOR just completed — review completed scenario)

Full review (~2-3 minutes). The entire scenario is done. Review the complete unit:

- **Test + implementation alignment?** Does the test cover the scenario's Given/When/Then?
- **Run /quality-review** for ecosystem verification (versions, deprecated APIs, security).
- **Ready for next scenario?** Any loose ends or technical debt to note?

If issues found: address before starting next scenario. If clean: commit and proceed to next `[ ] RED`.

## Reminders

1. **Depth matches step** — lightweight for GREEN, moderate for REFACTOR, full for RED
2. **Single source of truth** — this skill owns all TDD review content
3. **Commit clears the gate** — review, then commit to proceed
4. **Mark sub-checkbox** — ensure the current step's `[x]` is marked in test-definitions.md

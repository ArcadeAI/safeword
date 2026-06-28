---
name: tdd-review
description: Use when completing a TDD step and wanting a quality check. Reviews test quality after RED, implementation correctness after GREEN, and scenario completeness after REFACTOR.
allowed-tools: '*'
---

# TDD Review

Step-aware quality review at TDD phase boundaries. Run it as an internal self-check after RED, GREEN, and REFACTOR during implement phase.

These per-step reviews are **advisory self-checks** — the only hard gates in the implement phase are the commit ledger (`test-definitions.md` annotations) and the done-gate. Use these reviews to catch problems early; don't treat them as blocking walls.

**Stakes set depth.** Advisory means it won't block you — not that it can be shallow. The done-gate only runs tests, so a bug your eyes miss here ships. Review each step as if no later gate re-reads this code.

**Visibility:** ordinary RED/GREEN/REFACTOR reviews stay quiet. Do not surface a chat-facing review after each checkbox flip unless you found a real blocker, a user/scope decision, or a risky external dependency/API finding. Report the review/refactor work in the implementation-exit summary.

## Detect Step

Key the review off the **last checked** box in the current scenario — that's the step you just completed:

| Last checked (step just done) | Review focus              |
| ----------------------------- | ------------------------- |
| RED (test written)            | Review test quality       |
| GREEN (implementation passes) | Review implementation     |
| REFACTOR (cleanup done)       | Review completed scenario |

Depth scales with the step: lightweight after RED, moderate after GREEN, full after REFACTOR.

## After RED — review the test

Focused review (~1 minute). Check the test that was just written:

- **Atomic?** Tests ONE behavior. Red flag: multiple When/Then pairs.
- **Right assertions?** Meaningful expectations, not `.toBeTruthy()` or `.not.toThrow()`.
- **Behavior, not implementation?** Tests observable outcomes. Red flag: mocking internals, checking call counts.
- **Fails for the right reason?** Missing behavior, not syntax errors.
- **Right test type?** Load the testing skill and consult its scope hierarchy (E2E > Integration > Unit). Was a higher-scope test practical here? Did we drop to unit when integration would catch more?
- **Coverage adequacy?** Consult testing guide's bug detection matrix. Ask: "What could still break that this test wouldn't catch?" Flag gaps — missing edge cases, error paths, or boundary values. **Where a gap goes:** a missing scenario is a scope change, not a mid-implement edit — defer it to a follow-up ticket, or loop back to define-behavior and re-run the scenario-gate. Don't silently append scenarios to a signed-off `test-definitions.md`.

If issues found: fix before implementing. If clean: commit and proceed to implementation.

## After GREEN — review the implementation

Moderate review (~1-2 minutes). Check the implementation:

- **Minimal?** Only code the test requires. No anticipatory design.
- **Correct?** Does it actually satisfy the test's intent, not just make it pass by coincidence?
- **No regressions?** Run the **targeted** suite for the module under test. The full-suite regression check belongs once per scenario, at scenario close (after REFACTOR) — not at every GREEN.
- **Run /refactor** for structural cleanup.

If issues found: fix before refactoring. If clean: run /refactor, commit, proceed.

## After REFACTOR — review the completed scenario

Full review (~2-3 minutes). The entire scenario is done. Review the complete unit:

- **Test + implementation alignment?** Does the test cover the scenario's Given/When/Then? This is a **local** review — no web research needed.
- **Full suite green?** Run the full suite once here to catch cross-module regressions.
- **New external dependency or API in this scenario?** Only then run **/quality-review** for ecosystem verification (versions, deprecated APIs, security) — verify it at the moment you introduce it, before later scenarios build on it. A scenario that adds no new third-party/external surface (internal modules, stdlib, or a second use of an already-reviewed dep don't count) skips this; the whole-ticket pass at implement-exit is the catch-all.
- **Ready for next scenario?** Any loose ends or technical debt to note?

If issues found: address before starting next scenario. If clean: commit and proceed to next `[ ] RED`.

### Concrete example (after RED — reviewing the test)

**Context:** Agent just wrote a failing test for scenario 2 (verbose shows passing files) — RED is the last checked box, so the review focuses on the test.

**Agent review:**

> **Atomic?** Yes — tests one behavior (passing files appear in verbose output).
> **Right assertions?** `expect(output).toContain('src/index.ts: pass')` — asserts on observable output, not internals. Good.
> **Behavior, not implementation?** Yes — checks CLI output string, not internal formatter state.
> **Fails for the right reason?** `Expected string to contain 'src/index.ts: pass'` — verbose output doesn't include passing files yet. Correct failure.
> **Right test type?** Integration — needs real linter execution to produce output. Unit wouldn't cover the formatter→CLI pipeline. Correct scope.
> **Coverage gaps?** Test only checks one file. Could miss edge case where zero files pass. Acceptable for now — boundary cases are in scenario 3.
>
> Clean.
>
> **Next:** implement minimum code in `packages/cli/src/lint.ts` to make `expect(output).toContain('src/index.ts: pass')` pass, then commit.

## Output discipline

Every review ends with a **Next:** line on its own line — imperative, name the file/command/scenario. Don't end with "proceed" or "commit and move on" alone; name what to do.

- After RED, clean → `**Next:** implement minimum code in {file} to make this test pass.`
- After RED, issues → `**Next:** rewrite assertion in {file}:{line} to check observable output, then re-review.`
- After GREEN, clean → `**Next:** run /refactor on {file}, then commit and mark next [ ] RED.`
- After REFACTOR, clean → `**Next:** commit, then start scenario {N} — write the failing test in {file}.`

A review without a Next: line is incomplete.

## Reminders

1. **Depth matches step** — lightweight after RED, moderate after GREEN, full after REFACTOR
2. **Local by default** — per-step reviews need no web research; reserve **/quality-review** for a scenario that introduces a new external dependency/API and for the whole-ticket pass at implement-exit
3. **Single source of truth** — this skill owns all TDD review content
4. **Advisory, not a wall** — these reviews guide; the commit ledger and done-gate are the hard gates. Review internally, then commit to proceed
5. **Mark sub-checkbox** — ensure the current step's `[x]` is marked in test-definitions.md

**Voice:** plainspoken and concise — write to be scanned.

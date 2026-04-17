---
id: '053'
type: task
phase: intake
status: cancelled
created: 2026-03-26T20:56:55Z
last_modified: 2026-03-26T20:56:55Z
---

# Formally verify the phase/gate state machine

**Goal:** Model safeword's phase FSM, TDD cycle, and gate logic in a formal checker (Alloy or TLA+) and exhaustively verify correctness properties.

**Why:** The state machine is the backbone of enforcement. Edge cases (concurrent gate clears, manual checkbox edits, commits during hook execution) are hard to test conventionally but trivial for an exhaustive checker.

## Work Log

- 2026-03-26T20:56:55Z Created: ticket from formal verification research discussion

## Scope

Model the following in a single formal spec:

1. **Phase FSM** — 6 phases (intake, define-behavior, scenario-gate, decomposition, implement, done), valid transitions only
2. **TDD cycle** — red/green/refactor loop within the implement phase
3. **Gate logic** — LOC gate, phase gate, TDD gate; how they fire, how they clear (commit detection)
4. **Blocking rules** — planning phases block code edits, gates block all edits until cleared

## Properties to verify

- No phase can be skipped (every path visits phases in order)
- Gates always block (no action sequence clears a gate without the required evidence)
- TDD cycle is complete (red -> green -> refactor always cycles, never gets stuck)
- No deadlocks (no reachable state where all actions are blocked with no way forward)
- Concurrent gate clears resolve correctly (commit clears LOC gate while phase also transitions)
- Manual checkbox edits to test-definitions.md don't put TDD state in an invalid position

## Key files to model from

- `.safeword/hooks/pre-tool-quality.ts` — phase blocking, gate enforcement
- `.safeword/hooks/post-tool-quality.ts` — LOC counting, phase detection, TDD step detection, gate firing
- `.safeword/hooks/stop-quality.ts` — done gate evidence requirements
- `.safeword-project/quality-state-*.json` — runtime state shape

## Acceptance criteria

- [ ] Formal spec written (Alloy or TLA+)
- [ ] All properties pass exhaustive check
- [ ] Any edge case bugs found are documented and fixed in hook code
- [ ] Spec committed as living documentation (e.g., `.safeword/formal/state-machine.als`)

## Estimated effort

1-2 days

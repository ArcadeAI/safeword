# Dogfooding: Enforcement Redesign Session (April 2026)

Covers: Real hook fire counts, friction analysis, what caught bugs vs what was noise, during a 30+ commit session implementing tickets #113 and #114.

## Hook Fire Counts (Single Session)

| Hook                     | Fires | Value                                                                        |
| ------------------------ | ----- | ---------------------------------------------------------------------------- |
| Stop hook quality review | ~304  | ~5 useful catches out of 304 fires (~97% noise)                              |
| Prompt hook injection    | ~179  | Phase-aware reminder correctly tracked state                                 |
| Pre-tool quality         | ~381  | Artifact prerequisite caught 1 real bug                                      |
| Post-tool quality        | ~221  | State tracking worked correctly throughout                                   |
| Schema.ts warning        | 35    | Stale after first verification — fired 35 more times without new information |

## What Actually Caught Bugs

1. **/verify** caught `yaml` package import — would have broken hooks in user projects (ARCHITECTURE.md documents hooks must be zero-dependency)
2. **Artifact prerequisite gate** caught itself — blocked editing existing test-definitions.md in a completed ticket, revealing the gate should only fire on creation, not edits
3. **Stop hook quality review** caught session_id source issue — prompted investigation that revealed we should read from hook input, not env var
4. **/refactor** found dead identity mapping, nested ternary, duplicated path logic
5. **/audit** confirmed clean architecture — zero circular deps, zero dead code

## What Was Noise

1. **304 quality reviews** for ~5 useful catches = 97% noise. The useful catches could have been caught by running /quality-review manually at key checkpoints instead of on every stop.
2. **35 schema.ts warnings** after the first verification confirmed no test failures. The warning doesn't know we already verified — fires forever.
3. **Prompt hook fires on every turn** even when the agent is doing non-code work (writing tickets, researching, debating). The phase reminder is useful during implementation but noise during design discussion.

## Key Finding: Right Moment > High Frequency

The hooks that added the most value ran ONCE at the right moment:

- /verify once before marking done → caught architecture violation
- /audit once before marking done → confirmed clean
- Artifact prerequisite gate once on file creation → caught bug

The hooks that added the least value ran on EVERY turn:

- Quality review 304 times → 97% noise
- Prompt injection 179 times → correct but mostly ignored during design phases
- Schema warning 35 times → stale after first check

**Implication:** Gate at boundaries (verify before done, audit before done, prerequisite on creation). Don't gate every turn.

## Findings for #115 (Stop Hook Improvements)

1. **Non-done quality review should be phase-boundary only** — fire when phase transitions, not on every stop
2. **Schema.ts warning needs a "verified" flag** — once the user has run /verify after a schema change, stop showing the warning
3. **The quality review prompt itself is better now** ("Review critically" vs old "Double check everything") but the frequency is still too high
4. **The most valuable stop hook behavior is the done gate** — hard block until evidence. This should stay. Everything else could be less frequent.

## Process Observations

1. **We skipped TDD on #114** — implemented hooks, then wrote tests. For hook redesigns where the behavior IS the output format, test-first is possible but awkward. The right call was task-level implementation + integration tests after.
2. **We skipped BDD scenarios for #114** — the spec was already written in the epic. Correct — scenarios add value for user-facing features, not for internal infrastructure refactors with pre-written specs.
3. **Ticket frontmatter inconsistency** — #114 had `phase: implement` but no `status: in_progress`. The /verify skill couldn't find it. Ticket metadata needs to be consistent.
4. **Dogfooding is the best test** — our artifact prerequisite gate immediately found a bug in itself. Ship enforcement to yourself first.

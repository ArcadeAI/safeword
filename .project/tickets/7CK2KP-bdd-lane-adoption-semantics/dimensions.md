# Dimensions: BDD lane adoption semantics (lean slice)

Written retroactively for the spike (ticket work log 2026-07-03T19:35Z); the
lean slice's behavior space is small by design — one pointer key, zero
behavior when unset.

| Dimension               | Partitions                                                       | Covered by                                                                                     |
| ----------------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `bdd.conventions` value | set (non-empty string) / unset / empty or non-string (defensive) | e2e: pointer_prints scenario / no_pointer scenario / `nonEmptyString` guard in reader (unit-level, shared with `paths.*` handling) |
| codify output sink      | stdout (pipeable) / `--out` file                                 | pointer_prints asserts stdout stays clean; pointer goes to stderr in both sinks (same code path) |
| Consumer surface        | codify CLI / installed prose (TDD, SCENARIOS, planning-guide)    | e2e tests / diff review — prose is agent-read, not executable                                   |
| Config file state       | present / missing / unparseable                                  | existing `readSafewordConfig` defensive behavior (returns undefined → key unset)                |

Out of the space deliberately: conventions-doc content and existence (safeword
never reads or validates the doc — pointer-only by the recorded design
decision); structured knobs (stub template, verify command, excluded tags)
deferred pending a second real host.

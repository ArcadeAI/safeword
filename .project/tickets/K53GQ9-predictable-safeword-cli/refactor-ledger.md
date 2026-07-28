# Refactor Ledger — Issues #1572 and #1574

This ledger records every finding from the post-quality-review refactor scouts. Correctness
findings are fixed before structural work; refactors are applied leaf-first and protected by
focused tests.

| ID | Area | Finding | Resolution | Protection / rationale |
| --- | --- | --- | --- | --- |
| C1 | Codex | Finalization and recovery could execute a newly observed plan after consent was granted for an older plan. | Implemented in `2f3e9a5df`. | Added handler-level races that mutate after preflight; execution now rebuilds and compares the accepted plan. |
| C2 | Codex | Hidden `codex reset` bypassed the typed plan and confirmation boundary; hidden `codex diff` bypassed the envelope. | Implemented in `2f3e9a5df`. | Removed both hidden leaves and added CLI rejection regressions. |
| C3 | Remove | Package-manager effects replaced reconciliation file effects, and partial reconciliation reported removals only. | Implemented in `2f3e9a5df`. | Added a partially failed full-remove regression covering both file classes; partial creates/updates now survive. |
| C4 | Registration | Bare-root status has a separate execution path that bypasses the shared exception/progress/options boundary. | Implement. | Route root status through the same executor and add a registration characterization. |
| P1 | Protocol | Retained alias names have unreachable entries in the handler map. | Implement. | Catalog aliases already bind directly to their canonical handler. |
| P2 | Protocol | Alias effect metadata is redundantly overridden instead of inherited from the canonical command. | Implement. | Resolve effects through canonical catalog metadata; keep alias parity tests. |
| P3 | Protocol | Runtime deprecation text hard-codes compatibility versions instead of using catalog metadata. | Implement. | Make the catalog the compatibility source of truth. |
| P4 | Protocol | Generic `cli-protocol/apply.ts` and its self-only test have no production caller. | Implement. | Delete dead module/test; reference scan plus typecheck. |
| P5 | Protocol | Direct `testPlan()` and private parse helpers/process import are used only by their own tests. | Implement. | Delete the obsolete direct facade and self-only tests; retain public handler tests. |
| P6 | Protocol | Reconciliation package selection is needlessly branched. | Implement. | Replace with the single mode-derived source while preserving plan tests. |
| P7 | Protocol | `architectureHandler` is large. | Defer. | Its shell and narrative seams need characterization before decomposition; changing it now would mix discovery with refactoring. |
| P8 | Protocol | `public-handlers.ts` is a broad command router. | Partially implement. | Extract the independently characterized tracker/ticket domain after shared helpers; defer a whole-module split to avoid simultaneous churn. |
| S1 | Setup/remove | `commands/connect.ts` and direct `ticketNew()` wrappers are used only by self-tests. | Implement. | Delete obsolete wrappers/tests; public typed handlers remain covered. |
| S2 | Tracker/ticket | Mutation-journal-to-effects conversion is duplicated. | Implement. | Extract a generic typed utility and cover it directly. |
| S3 | Setup/remove | Snapshot diff logic is duplicated. | Implement. | Extract a pure file snapshot diff utility; leave snapshot acquisition local. |
| S4 | Setup | `CompletedSetupEffects` competes with derived local arrays as an effect source. | Implement incrementally. | Make the journal the source for returned effects without redesigning execution. |
| S5 | Protocol | Replay-command quoting/assembly is duplicated. | Implement. | Extract a shared replay-command builder with quoting characterizations. |
| S6 | Protocol | Tracker and ticket handlers obscure unrelated public command logic. | Implement after S2/S5. | Move only the characterized domain handlers to a focused module. |
| S7 | Tests | Configured-command test setup is repetitive. | Defer. | A fixture abstraction would be test-only churn without a current production simplification. |
| X1 | Codex | Dead migration status/failure reporters and their classifier remain. | Implement. | Delete after hidden bypass removal; reference scan and migration suites. |
| X2 | Codex | The interactive finalization prompt is used only by its own tests. | Implement. | Delete it, its stream imports, and self-only tests; injected confirmation is the production path. |
| X3 | Codex | Lifecycle paths are duplicated across migration, finalization, and authority modules. | Implement. | Centralize them in the migration inventory, preserving schema-as-source-of-truth. |
| X4 | Codex | Legacy command identity is parsed separately for cleanup and viability. | Implement after X3. | Add a characterization matrix, then share one parser. |
| X5 | Codex | Formatting-preserving legacy TOML cleanup occupies roughly 300 lines of the command module. | Implement after X4. | Move as-is to `codex-plugin/legacy-config.ts`; do not redesign parsing. |
| X6 | Codex | Atomic durable writes are duplicated in finalization and profile proof. | Implement. | Extract a writer with mode and pre-rename seam; retain interrupted-write/rollback tests. |
| X7 | Codex | Recovery preview and execution duplicate validated manifest loading. | Implement. | Extract one internal validated recovery loader so preview/apply cannot drift. |
| X8 | Codex | Finalization effect mapping was duplicated by the hidden diff path. | Implemented by deletion in `2f3e9a5df`. | Hidden diff was removed, making its preview facade dead. |
| X9 | Tests | The migration command test file is about 1,400 lines. | Defer. | Split only after consent fixes and production refactors settle; extract the fake runtime fixture first. |
| X10 | Codex | Human/JSON compatibility rendering could be generalized. | Defer. | The remaining renderer supports the compatibility facade and release smoke path; sunset policy must be decided first. |


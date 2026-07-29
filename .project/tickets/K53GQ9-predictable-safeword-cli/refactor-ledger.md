# Refactor Ledger — Issues #1572 and #1574

This ledger records every finding from the post-quality-review refactor scouts. Correctness
findings are fixed before structural work; refactors are applied leaf-first and protected by
focused tests.

| ID | Area | Finding | Resolution | Protection / rationale |
| --- | --- | --- | --- | --- |
| C1 | Codex | Finalization and recovery could execute a newly observed plan after consent was granted for an older plan. | Implemented in `2f3e9a5df`. | Added handler-level races that mutate after preflight; execution now rebuilds and compares the accepted plan. |
| C2 | Codex | Hidden `codex reset` bypassed the typed plan and confirmation boundary; hidden `codex diff` bypassed the envelope. | Implemented in `2f3e9a5df`. | Removed both hidden leaves and added CLI rejection regressions. |
| C3 | Remove | Package-manager effects replaced reconciliation file effects, and partial reconciliation reported removals only. | Implemented in `2f3e9a5df`. | Added a partially failed full-remove regression covering both file classes; partial creates/updates now survive. |
| C4 | Registration | Bare-root status has a separate execution path that bypasses the shared exception/progress/options boundary. | Implemented in `6e0a938bc`. | Root status now uses the same executor, with registration characterization coverage. |
| P1 | Protocol | Retained alias names have unreachable entries in the handler map. | Implemented in `83951137d`. | Catalog aliases bind directly to their canonical handler. |
| P2 | Protocol | Alias effect metadata is redundantly overridden instead of inherited from the canonical command. | Implemented in `83951137d`. | Effects resolve through canonical catalog metadata; alias parity tests remain. |
| P3 | Protocol | Runtime deprecation text hard-codes compatibility versions instead of using catalog metadata. | Implemented in `83951137d`. | The catalog is now the compatibility source of truth. |
| P4 | Protocol | Generic `cli-protocol/apply.ts` and its self-only test have no production caller. | Implemented in `56daea7c1`. | Deleted the dead module/test; protected by reference scan and typecheck. |
| P5 | Protocol | Direct `testPlan()` and private parse helpers/process import are used only by their own tests. | Implemented in `56daea7c1`. | Deleted the obsolete facade/self-tests; public handler tests remain. |
| P6 | Protocol | Reconciliation package selection is needlessly branched. | Implemented in `56daea7c1`. | Replaced with the single mode-derived source while preserving plan tests. |
| P7 | Protocol | `architectureHandler` is large. | Defer. | Its shell and narrative seams need characterization before decomposition; changing it now would mix discovery with refactoring. |
| P8 | Protocol | `public-handlers.ts` is a broad command router. | Partially implemented in `8f1bc2dbb`. | Extracted the independently characterized tracker/ticket domain; a whole-module split is deferred to avoid low-value simultaneous churn. |
| S1 | Setup/remove | `commands/connect.ts` and direct `ticketNew()` wrappers are used only by self-tests. | Implemented in `7f382654d`. | Deleted obsolete wrappers/tests; public typed handlers remain covered. |
| S2 | Tracker/ticket | Mutation-journal-to-effects conversion is duplicated. | Implemented in `0fcfb574c`. | Extracted a generic typed utility with direct coverage. |
| S3 | Setup/remove | Snapshot diff logic is duplicated. | Implemented in `d3121da1d`. | Extracted a pure file snapshot diff utility; snapshot acquisition remains local. |
| S4 | Setup | `CompletedSetupEffects` competes with derived local arrays as an effect source. | Implemented in `7a5b7b2b4`. | The journal is now authoritative for returned effects without redesigning execution. |
| S5 | Protocol | Replay-command quoting/assembly is duplicated. | Implemented in `efa785962`. | Extracted a shared replay-command builder with quoting characterizations. |
| S6 | Protocol | Tracker and ticket handlers obscure unrelated public command logic. | Implemented in `8f1bc2dbb`. | Moved the characterized domain handlers to a focused module. |
| S7 | Tests | Configured-command test setup is repetitive. | Defer. | A fixture abstraction would be test-only churn without a current production simplification. |
| X1 | Codex | Dead migration status/failure reporters and their classifier remain. | Implemented in `901559de8`. | Deleted after hidden bypass removal; protected by reference scan and migration suites. |
| X2 | Codex | The interactive finalization prompt is used only by its own tests. | Implemented in `901559de8`. | Deleted it, its stream imports, and self-only tests; injected confirmation remains the production path. |
| X3 | Codex | Lifecycle paths are duplicated across migration, finalization, and authority modules. | Implemented in `9af8e5b6e`. | Centralized in the migration inventory, preserving schema-as-source-of-truth. |
| X4 | Codex | Legacy command identity is parsed separately for cleanup and viability. | Implemented in `31f1a8038`. | Added a characterization matrix and shared one parser. |
| X5 | Codex | Formatting-preserving legacy TOML cleanup occupies roughly 300 lines of the command module. | Implemented in `79993846c`. | Moved intact to `codex-plugin/legacy-config.ts` without redesigning parsing. |
| X6 | Codex | Atomic durable writes are duplicated in finalization and profile proof. | Implemented in `62c61ce93`. | Extracted a writer with mode and pre-rename seam; interrupted-write/rollback tests remain. |
| X7 | Codex | Recovery preview and execution duplicate validated manifest loading. | Implemented in `f27d41e05`. | One internal validated recovery loader now supplies both preview and apply. |
| X8 | Codex | Finalization effect mapping was duplicated by the hidden diff path. | Implemented by deletion in `2f3e9a5df`. | Hidden diff was removed, making its preview facade dead. |
| X9 | Tests | The migration command test file is about 1,400 lines. | Defer. | Split only after consent fixes and production refactors settle; extract the fake runtime fixture first. |
| X10 | Codex | Human/JSON compatibility rendering could be generalized. | Defer. | The remaining renderer supports the compatibility facade and release smoke path; sunset policy must be decided first. |

## Mandatory audit follow-up

| ID | Finding | Resolution |
| --- | --- | --- |
| A1 | The TypeScript language pack crossed the publishable-preset boundary for one shared lint-script constant. | Kept the deliberately duplicated constant on each side of the enforced package boundary; dependency-cruiser now reports zero violations. |
| A2 | Knip found legacy direct-command implementations and compatibility utilities left unreachable after the typed protocol became authoritative. | Removed the unreachable setup/check/diff/reset/upgrade/sync implementations and their cascading dead helpers; Knip is now silent. |
| A3 | The retired direct `codify()` facade left shared parse helpers coupled to `process.exit`, so typed `codifyResult()` could terminate instead of returning a failed envelope. | Removed the direct facade and made parse failures throw into the typed result boundary; existing CLI bad-input scenarios protect the behavior. |

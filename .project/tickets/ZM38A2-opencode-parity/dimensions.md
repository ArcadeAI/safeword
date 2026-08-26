# Behavioral Dimensions: OpenCode parity

| Dimension | Partitions and boundaries | Rules |
| --- | --- | --- |
| Selection | omitted default; explicit OpenCode; explicit mixed selection; unselected assets present | TBU1.R1, TBU1.R3 |
| Catalogue | every action command; every subagent; canonical skill discovery; user-authored sibling | TBU1.R1, TBU1.R3, SWM1.R2 |
| Guard result | allow; policy deny; dispatcher failure; unknown tool | TBU1.R2, NTB1.R1 |
| Protected tool shape | shell command; edit/write path; patch target; uncovered tool | TBU1.R2, NTB1.R3 |
| Profile ownership | absent; matching; recognized drift; unrecognized collision; user-modified on uninstall | TBU1.R3, NTB1.R2 |
| Activation evidence | current and bound; absent; stale; malformed; mismatched project/plugin/version | NTB1.R1, NTB1.R3 |
| Conformance | pinned pass; failed denial; missing catalogue; untested stable 1.x; V2; Desktop | TBU1.R4, NTB1.R2, NTB1.R3 |
| Lifecycle capability | block; observe; unavailable | NTB1.R1, NTB1.R3, SWM1.R1 |
| Status precedence | collision/drift; missing install; failed/missing conformance; stale activation; advisory only; healthy | NTB1.R1, NTB1.R2, NTB1.R3 |
| Shared ownership | Claude only; OpenCode only; Claude+OpenCode; Codex packaged skills; removing final consumer | TBU1.R3, SWM1.R2 |
| Adapter conformance | all four valid; duplicate ID; undeclared path; overstated block; profile operation without descriptor | SWM1.R1, SWM1.R3 |
| Real-process isolation | temporary HOME/config/project; loopback provider; randomized token/sentinel; side effect absent | TBU1.R4 |

Representative acceptance examples cover each externally meaningful partition.
Malformed-field permutations, platform path tables, and every tool alias belong
in lower-level table-driven contract tests.

# Behavioral dimensions: Deliver local retro batches

| Dimension | Partitions and boundaries | Rule |
| --- | --- | --- |
| Local carrier | Claude Code; OpenAI Codex; Cursor | SWM1.R1 |
| Valid finding cardinality | zero; one; multiple; mixed valid and invalid | SWM1.R1 |
| Whole-request size | below limit; exactly 65,536 bytes; one byte over | SWM1.R1; NTB1.R1 |
| Intake version | released v1 single finding; exact v2 batch; unknown or malformed v2 | SWM1.R2 |
| Raw-body replay | same request id and bytes; new request id and identical bytes in the same scope; same scope and unequal bytes; distinct scope | SWM1.R2 |
| Delivery outcome | accepted; duplicate; conflict; rejected; timeout; connection refusal | NTB1.R1 |
| Consent | opted in; opted out | NTB1.R1 |
| Recovery | public acceptance; public non-attempt; public failure | NTB1.R1 |

Exhaustive malformed-field combinations remain table-driven collector tests;
feature scenarios cover the externally meaningful version, cardinality, size,
replay, consent, and dependency-failure boundaries.

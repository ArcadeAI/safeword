# Behavioral dimensions: Send enriched retros from Claude Cloud

| Dimension | Partitions and boundaries | Rules proved |
| --- | --- | --- |
| Session eligibility | eligible substantial session; ineligible session; opted-out project; repeated completion with local state; same session after workspace reclamation; distinct session in the same workspace | NTB1.R1, SWM1.R2 |
| Public handoff outcome | valid matching durable receipt; non-responsive collector at the new carrier boundary; shared rejection and malformed-receipt matrix inherited from ticket 3F5Z6P | NTB1.R1, NTB1.R2 |
| Carrier authority | installed Claude Cloud carrier; payload claims another harness or host; released local carrier; unsupported Codex or Cursor cloud carrier | SWM1.R1 |
| Finding cardinality | zero valid findings; one finding; multiple ordered findings | SWM1.R2 |
| Batch size | canonical request at or below 65,536 bytes; canonical request above 65,536 bytes | SWM1.R2 |
| Shared delivery contract | new sender emits v2; released sender emits v1; one request identity and receipt per session | SWM1.R2 |
| Recovery coexistence | public receipt accepted; public attempt unavailable; existing private or spool candidate | NTB1.R2 |
| Readiness evidence | injected or local-only proof; real Claude Cloud Stop execution with outbound collector receipt | SWM1.R3 |

The parent feature already exhaustively covers deadline arithmetic, receipt
parsing, raw-body deduplication, collector authorization isolation, and local
project identity. This feature adds only the shared v2 batch contract and the
new cloud carrier boundary with its real wiring.

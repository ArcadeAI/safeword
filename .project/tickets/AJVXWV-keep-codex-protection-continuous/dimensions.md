# Behavior Dimensions: Keep Codex protection continuous

| Dimension | Partitions and boundaries | Rules covered |
| --- | --- | --- |
| Repository protection | no legacy assets; partial legacy residue; complete legacy installation | TBU1.R1, TBU1.R3 |
| Plugin lifecycle | absent; installed restart required; enabled without proof; current proof; stale proof | TBU1.R2, NTB1.R1 |
| Hook authority | legacy authoritative; plugin authoritative; neither complete; both present | TBU1.R3 |
| Invocation mode | interactive; non-interactive without finalization; explicit non-interactive finalization | NTB1.R2, TBU1.R4 |
| Cleanup ownership | known Safe Word hook; known runtime file; custom hook; unrelated skill; bootstrap skill | TBU1.R4, SWM1.R1, SWM1.R2 |
| Failure point | install failure; proof mismatch; config changed; atomic write failure; recovery | TBU1.R1, TBU1.R2, TBU1.R4 |
| Repeat execution | before install; awaiting restart; awaiting trust; compatibility; finalized | TBU1.R2, TBU1.R4 |
| Output surface | concise human status; JSON status; success; needs action; execution error | NTB1.R1, NTB1.R2 |

**Test scope:** CLI integration tests exercise the real command and filesystem
collaborators while mocking only Codex subprocess/profile boundaries. Hook
integration tests execute packaged dispatchers against temporary repositories
and profiles. Unit tests are reserved for proof validation and selective
ownership parsing where boundary combinations need dense coverage.

# Dimensions: Route local retros through the durable server

| Dimension | Partitions and boundaries |
| --- | --- |
| Harness | Claude Code local; OpenAI Codex local; Cursor local; Cursor managed cloud |
| Customer choice | default collection; explicit project opt-out |
| Client transport | accepted; duplicate receipt; lost receipt or timeout; typed terminal rejection; shared 750 ms exhaustion |
| Identity and source | first attempt; retry; repeated same window; later transcript window; conflicting bytes |
| Intake safety | valid `v3`; legacy v1/v2; prohibited content; strict UUIDv4; maximum serialized batch; global intake bound |
| Ownership lifecycle | queued; leased; crash before relay acceptance; relay accepted; retryable; ambiguous; terminal |
| Duplicate authority | complete raw marker match; lone marker; sanitized read; similar body without exact markers; incomplete raw scan |
| Rollout and operations | per-source canary; incomplete harness evidence; truthful Cursor local/cloud detection; normal quota; quota overflow; worker outage |

Representative acceptance scenarios cover each externally meaningful partition. Exact 4 KiB per-finding and 50-finding count rejection boundaries, exhaustive malformed-field and Unicode-boundary cases, rate counters, and lease timing belong in lower-level table-driven tests.

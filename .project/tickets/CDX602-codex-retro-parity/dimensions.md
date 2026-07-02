# Dimensions: Codex retro parity (CDX602)

| Dimension | Partitions / boundaries | Scenarios |
| --- | --- | --- |
| Stop payload viability | readable transcript; unreadable/malformed input | Stop hook runs child with inline digest; Stop fails open |
| Child extractor contract | schema-valid output; non-zero/empty/invalid output; closed stdin | Stop hook runs child with inline digest; Stop fails open |
| Model default | Claude `sonnet`; Codex `gpt-5.5`; config override | Per-agent model defaults |
| Filing outcome | valid findings with leak canary + REST success; auth failure; retryable server error; filing timeout; no findings | adversarial egress/spool/direct filing; Lane-2 nudge; no-op empty output |
| Conversation surface | Stop stdout; UserPromptSubmit additionalContext | invisible Stop; Codex prompt-retro-nudge |
| State mutation on failure | malformed input; missing transcript; child non-zero; child timeout; empty output; invalid schema | fail-open leaves delta state, spool, and filed records untouched |
| Recursion | normal session child env includes `SAFEWORD_RETRO_CHILD=1`; hook invoked under `SAFEWORD_RETRO_CHILD=1` | child spawn guarded; retro child Stop spawns nothing |

No additional open partitions: Codex cloud, alternate Stop output mechanisms, and
replacing the shared core are explicitly out of scope in #602.

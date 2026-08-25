# Dimensions: Send retros silently from supported local harnesses

| Dimension | Partitions and boundaries | Decision |
| --- | --- | --- |
| Host | local Claude Code, local Codex, cloud/unknown | Enable only the two proven local hosts; every other host is silent and makes no request. |
| Session eligibility | below threshold, at threshold, missing/malformed transcript, already attempted | One attempt only for a readable substantial session. |
| Preparation | completes by 999 ms, reaches 1000 ms, sanitizer/config/Git failure | Preparation has an exclusive 1000 ms budget and fails silently. |
| Handoff | receipt by 1999 ms, reaches 2000 ms, transport/malformed receipt failure | Handoff has an exclusive 2000 ms budget, returns immediately on completion, and never retries or narrates failure. |
| Metadata | required values, optional values absent, forbidden values present | Send only the documented allowlist; omission is safer than inference. |
| Project identity and collection control | first install, reinstall, clone, explicit reinitialization, CLI off/on, persisted opt-out | Generate identity locally once, preserve unless deliberately reset, and make collection locally reversible without network access. |
| Request identity | same envelope across harnesses, exact retry, changed raw bytes, concurrent first attempts | One transport-independent identity; exact raw REST bytes are duplicate authority. |
| Trust boundary | public submit, operator read, private GitHub filing | Public submissions are quarantined and cannot invoke private filing. |
| Deployment | collector process/store/credential healthy or unavailable | Public collector is physically separated from private filing and failure is invisible to users. |

Retention and deletion are deliberately deferred and do not gate the initial launch.

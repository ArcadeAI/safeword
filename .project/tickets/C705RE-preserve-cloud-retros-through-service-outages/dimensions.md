# Behavioral dimensions: Hand off cloud retros without interrupting builders

| Dimension | Partitions and boundaries | Rules proved |
| --- | --- | --- |
| Carrier completion | real carrier with reachable intake; unavailable intake; no supported carrier | TBU1.R1, TBU2.R1, NTB1.R1, SWM1.R1 |
| Durable acceptance | first submission; byte-identical retry; client disconnect after commit; relay restart after receipt | TBU1.R1, TBU1.R2 |
| Local identity and provenance | fresh install; copied project config with different remote; `GITHUB_ACTOR`; Git email fallback; missing actor; local and cloud host classes | SWM2.R1 |
| Untrusted-input containment | valid bounded payload; malformed payload; oversized payload; rate limit; conflicting claims | SWM2.R1, SWM2.R2 |
| Privilege separation | public submit; spoofed profile; public read/operate/cross-repository attempt; existing bearer filing and operator actions | SWM2.R2 |
| Activation honesty | endpoint exists but carrier not live; carrier plus durable-receipt proof | SWM1.R1 |

The request ID remains a UUIDv4 generated once by the shared relay client and
is the same across all carriers. Raw REST body evidence remains the sole
authority for duplicate reconciliation after a tracker create; public ingress
never reaches tracker creation and does not change that rule.

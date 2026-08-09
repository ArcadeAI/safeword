# Behavioral dimensions: Hand off cloud retros without interrupting builders

| Dimension | Partitions and boundaries | Rules proved |
| --- | --- | --- |
| Carrier completion | real carrier with reachable intake; unavailable intake; reachable-but-slow intake; no supported carrier; requested-work result preserved | TBU1.R1, TBU2.R1, NTB1.R1, SWM1.R1 |
| Time budgets | injected monotonic clock; profile source exceeds 50 ms; total handoff at or below 500 ms | TBU1.R1, TBU2.R1 |
| Durable acceptance | first submission; byte-identical retry; concurrent duplicate; concurrent distinct keys at final capacity slot; client disconnect after commit; relay restart after receipt | TBU1.R1, TBU1.R2, SWM2.R3 |
| Local identity and provenance | fresh install with network available; copied project config with different remote; `GITHUB_ACTOR`; Git email fallback; missing actor; local and cloud host classes | SWM2.R1 |
| Profile failure and redaction | slow profile source; malformed profile source; no hostname, local path, or credential in the outbound body | TBU2.R1, SWM2.R1 |
| Untrusted-input containment | valid bounded payload; malformed payload; oversized payload; wrong public key; explicit rate limit for fresh key; retained-key dedupe after limit; full queue; conflicting claims | SWM2.R1, SWM2.R2, SWM2.R3 |
| Privilege separation | public submit; spoofed profile; public read/operate/cross-repository attempt; authenticated operator list/inspect; existing bearer filing | SWM2.R2 |
| Operator retention | accepted record; retained duplicate; full queue; operator inspection without tracker filing | SWM2.R2, SWM2.R3 |
| Activation honesty | endpoint exists but carrier not live; carrier plus durable-receipt proof | SWM1.R1 |

The request ID is a UUIDv4 generated once before payload construction, is never
derived from payload content, and is reused for every retry across all carriers.
Raw REST body evidence remains the sole
authority for duplicate reconciliation after a tracker create; public ingress
never reaches tracker creation and does not change that rule.

# Dimensions: autonomy-posture-spine

Systematic coverage for the v1 spine. Partitions drive the scenarios in
`features/autonomy-posture-spine.feature`. Control-ladder tiers (verify /
debate-review / async-audit) are out of scope here — see parent epic 90AZDV.

| Dimension                  | Partitions (equivalence classes + boundaries)                                                                                      | Covered by             |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| Policy source & precedence | project preset set · per-axis override on a preset · personal overrides project · neither (default)                                | DEV1, DEV2             |
| Invalid / malformed policy | invalid selection rejected · malformed project policy → fail-safe Full review · malformed personal override → fall back to project | DEV1.AC5/AC6, DEV2.AC4 |
| Posture resolution         | ask (pause) · autonomous (resolve)                                                                                                 | DEV3.AC1 (both sides)  |
| Autonomous resolution      | sub-agent runs /figure-it-out · full context payload delivered · decision logged                                                   | DEV3.AC1–AC3           |
| Failure mode               | transient error/timeout → retry-once → defer · inconclusive verdict → defer immediately                                            | DEV3.AC4, DEV3.AC5     |
| Always-on guards           | denylist under full autonomy · hard gates under autonomy · done needs human confirm                                                | DEV5.AC1–AC3           |
| Config visibility          | personal override absent from git · preset→posture map inspectable                                                                 | DEV1.AC2, DEV2.AC2     |

Boundary notes:

- **Default (no policy)** is the load-bearing boundary — it must equal today's all-ask behavior (no silent regression).
- **Failure mode** splits on _why_ /figure-it-out failed: a transient fault is retryable (one retry); a genuine inconclusive verdict is not (re-running a real tie won't break it) → defer immediately.
- **External side-effects** is not a posture dimension — the denylist is its floor, covered under always-on guards.

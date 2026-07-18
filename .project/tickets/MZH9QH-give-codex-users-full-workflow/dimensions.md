# Behavior Dimensions: Give Codex users the full Safe Word workflow

| Dimension | Partitions and boundaries | Scenarios covered |
| --- | --- | --- |
| Canonical catalogue | every workflow; supporting phase material; an added workflow; a missing asset | TBU1.R1, SWM1.R1, SWM1.R2 |
| Semantic transformation | explicit metadata, invocation, and reference-path adaptations; unexpected content drift | SWM1.R1 |
| Skill discovery | metadata inventory at or below 8,000 characters; over-budget inventory | SWM1.R1 |
| Repository boundary | fresh setup; migration; accidental project-local workflow output | TBU1.R2, SWM1.R3 |
| Migration state | plugin unavailable; installed but unreviewed; reviewed and explicitly cleaned up; custom hooks | TBU1.R3 |
| Hook trust lifecycle | new hook; reviewed hook; changed hook; bypass attempt | TBU1.R4, SWM1.R4 |
| Distribution | source tree; packed package; isolated profile cache; target project contains a misleading copy | SWM1.R2, SWM1.R3 |
| Runtime command | version-pinned Bunx; npx or a trust-bypass flag | SWM1.R4 |

**Test scope:** Source-to-package contracts cover deterministic generation quickly; a packed-package integration test catches release omissions; an isolated real-Codex test proves cache loading, trust warnings, and the clean-project boundary. The untrusted live path must run without a trust-bypass flag and assert Codex's `/hooks` recovery message. A bypassed smoke may prove package dispatch only; it never counts as proof of hook trust. The isolated test mocks only the package-registry/network boundary.

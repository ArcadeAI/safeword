# Dimensions: add-spike-workflow

| Dimension | Partitions and boundaries |
| --- | --- |
| Eligibility | docs or code can answer → do not spike; user-only knowledge → elicit; multiple researchable choices → figure-it-out; only executable evidence can answer a kill-risk → spike |
| Experiment charter | complete question + hypothesis + kill criterion + proof + budget; any missing field blocks execution |
| Execution shape | one kill-risk slice by default; independent comparison variants may fan out; feature-wide component fan-out is excluded |
| Evidence outcome | VALIDATED; PARTIAL with constraints; INVALIDATED with the wall |
| Code lifecycle | isolated worktree and branch; production implementation starts fresh; spike code never merges |
| Durable output | evidence, shortcuts, decisions, and production consequences feed `impl-plan.md`; significant decisions may feed an ADR |
| Host exposure | Claude Code manual-only skill metadata; Cursor command with no automatic rule; generated Codex plugin manual-only skill metadata |
| BDD placement | after scenario validation; before `plan-implementation`; canonical phase order unchanged |

Coverage boundary: the feature specifies the shipped workflow and parity
contract. It does not implement host-native worktree APIs or add hook-enforced
spike state.

# Dimensions: Per-step / per-phase quality reviews (SXSCJQ)

Derived from ticket scope + done_when, plus domain knowledge about hook
firing (PostToolUse vs Stop) and the autonomous-run gap.

| Dimension        | Partitions                                                             |
| ---------------- | ---------------------------------------------------------------------- |
| Boundary event   | TDD-step flip · phase change · no boundary (ordinary edit)             |
| Step identity    | RED · GREEN · REFACTOR                                                 |
| Trigger path     | PostToolUse (edit-driven, autonomous-safe) · Stop (turn-end backstop)  |
| Dedup state      | boundary not yet reviewed (fire + mark) · already reviewed (skip)      |
| LOC delta (impl) | small <50 · large ≥50 — both must fire (throttle removed)              |
| Surface          | PostToolUse → `additionalContext` · Stop → bypassable `decision:block` |

## Notable partitions from domain knowledge

- **Multiple flips in one edit** (e.g. MultiEdit checking RED+GREEN) — boundary
  partition that isn't obvious from scope. Resolved (figure-it-out): surface the
  most-advanced step only.
- **Boundary via non-edit path** (phase bumped by `safeword check`, not a model
  Edit) — the case the Stop backstop exists for; PostToolUse can't see it.
- **Autonomous run** (Stop never fires) — why PostToolUse must be the primary
  trigger, not Stop.

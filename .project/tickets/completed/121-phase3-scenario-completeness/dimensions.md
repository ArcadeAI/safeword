# Behavioral Dimensions — Ticket 121

Derived from scope, done_when, and domain knowledge of the hook system + BDD skill.

## Dimension Table

| Dimension                           | Partitions                                                                                                                                             |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Skill content (SCENARIOS.md)        | pipeline steps listed, concrete turn example, Phase 4 adversarial pass, two saturation checks named, test-definitions format with blockquote rationale |
| Phase gate (pre-tool hook)          | ticket in `intake` (block), ticket past intake (allow), non-ticket file (bypass)                                                                       |
| Dimension artifact gate             | type=feature + dimensions.md exists (allow), type=feature + dimensions.md missing (block), type=task + no dimensions.md (allow/bypass)                 |
| Scenario format gate (stop-quality) | file has GFM checkboxes all checked (allow), file has content but no GFM checkboxes (block), partially checked (block, progress), empty (allow)        |
| Template parity                     | `.safeword/hooks/*.ts` ↔ `packages/cli/templates/hooks/*.ts` byte-equal                                                                                |

## Partition Rationale

**Skill content** — the pipeline is a prompt-engineering artifact; the "test" is that the file contains the required sections. Domain-knowledge partition (blockquote rationale format) came from scope item 4 — HTML comment variant deferred to #122 so we must confirm plain text is used.

**Phase gate** — two natural partitions (intake / not intake) + a bypass partition (non-ticket files must not trigger the gate, else it would block editing source).

**Dimension artifact gate** — three partitions by `type` field: feature-present, feature-missing, task. The task partition is important because the gate is feature-only per scope; a regression that blocked tasks would break unrelated workflows.

**Scenario format gate** — the "no GFM checkboxes but content present" partition is the new hard-block behavior. Without it, the hook silently passes files using obsolete formats. Empty-file partition exists because the hook must not false-positive before scenarios are written.

**Template parity** — Safeword's invariant: hooks in `.safeword/` run live; `templates/` is what ships via `safeword upgrade`. They must match after any hook change or customers get stale behavior.

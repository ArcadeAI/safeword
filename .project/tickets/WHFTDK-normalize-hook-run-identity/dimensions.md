# Dimensions: Normalize hook run identity

| Dimension | Partitions | Why it matters |
| --- | --- | --- |
| Runtime | Claude, Codex, Cursor, unknown | Field names and lifecycle semantics differ by host runtime. |
| Durable id source | `session_id`, `conversation_id`, runtime env var, absent | State and proof correlation must use a real stable id when one exists and avoid fake ids when absent. |
| Turn id source | none, `turn_id`, `generation_id` | Per-turn metadata can help diagnostics but must not replace durable session correlation. |
| Raw id collision | same id across runtimes, distinct ids | Runtime prefixes prevent unrelated runs from sharing state files. |
| State file generation | legacy Claude filename, runtime-scoped filename | Upgrades must preserve old Claude state while making new writes collision-resistant. |
| Proof writer behavior | identity present, identity absent | Proof logs should be attributable or explicitly skipped/failed, never silently tied to `unknown-session`. |
| Install surface | template, schema registry, dogfood copy | The helper only ships if every managed surface is updated together. |

# Dimensions: Formatter-aware lint hook

Derived from V7GGJZ scope + done_when and the epic's 80/20 (collision is a JS/TS problem).

| Dimension                       | Partitions (equivalence classes + boundaries)                                                                                                                                                                                                                                                         |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Formatter ownership of the repo | (a) alternative formatter present — Biome / dprint / oxfmt / deno; (b) own Prettier config present; (c) greenfield (none). **Boundary:** disabled/backup config (`.prettierrc.bak`) → reads as greenfield. **Boundary:** alternative formatter AND a Prettier config both present → alternative wins. |
| Edited file type                | (a) JS/TS code (`.ts/.tsx/.js`); (b) markup/data Prettier handles (`.json/.css/.yaml/.md`).                                                                                                                                                                                                           |
| Safeword tool in the hook       | (a) Prettier — skipped when an alternative formatter owns the repo; (b) ESLint — still runs on JS/TS (security/complexity, non-style).                                                                                                                                                                |
| Session-start signal            | (a) alternative-formatter repo → no Prettier nag; (b) greenfield / own-Prettier repo → unchanged.                                                                                                                                                                                                     |

Scenarios are the meaningful cells of the cross-product: the alternative-formatter family is one
`Scenario Outline` (Biome/dprint/oxfmt/deno are an equivalence class), plus the two precedence
boundaries, the ESLint-still-runs guarantee, the own-Prettier and greenfield regression guards, and
the session-nag behavior.

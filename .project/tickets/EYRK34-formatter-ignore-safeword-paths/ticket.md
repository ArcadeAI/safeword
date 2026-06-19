---
id: EYRK34
slug: formatter-ignore-safeword-paths
type: task
phase: done
status: done
parent: 2H2XKH
created: 2026-06-18T17:00:07.149Z
last_modified: 2026-06-19T19:15:00.000Z
scope:
  - Ensure every formatter a customer is likely to run skips safeword-owned paths (`.safeword/`, `.claude/`, `.project/`, `.cursor/`, `.codex/`, `.agents/`) so safeword's own files never churn in the customer's diffs/CI.
  - Additively wire ignores per tool: `.prettierignore` (additive append), biome `includes`/`!` excludes (already done — verify oxfmt parity), ruff `extend-exclude`, rustfmt `ignore`, dprint `excludes`, and oxfmt's ignore mechanism.
  - Honor `.editorconfig` rather than override it (prettier already does; confirm safeword doesn't write conflicting style).
  - Drive the owned-path list from the existing `SAFEWORD_PATHS` / `owned-paths.ts` source of truth — no parallel hardcoded list.
out_of_scope:
  - Runtime hook behavior (V7GGJZ) and install inertness (9C2CFX).
  - Languages where safeword has no owned files in scope (gofmt has nothing to ignore — `.safeword/` holds no `.go`).
  - Inventing ignore files for tools the customer doesn't use (only touch a tool's ignore config if that tool is present — additive, skipIfMissing).
done_when:
  - In a repo using prettier, running the customer's `prettier .` does not touch any file under safeword-owned paths.
  - Same verified for biome, ruff, rustfmt, dprint where present (each additively excludes safeword paths only when that tool's config exists).
  - Owned-path list is sourced from `SAFEWORD_PATHS`; adding a new owned dir updates all ignores without per-tool edits.
  - Full suite + lint green; hook template mirror synced if touched.
---

# Self-contained: customer formatters ignore safeword-owned paths

**Goal:** When a customer runs their own formatter, it skips every safeword-owned directory — so
safeword's hooks/configs/tickets never show up as churn in the customer's diffs or CI.

**Why:** The inverse of the collision problem: even with a formatter-aware hook, safeword's own
files (`.safeword/`, `.project/`, etc.) shouldn't get reformatted by the customer's prettier/biome/
ruff and pollute their working tree. Safeword already excludes `.safeword/` from biome and eslint;
this extends that coverage additively to the formatters customers actually use, from one source of truth.

**Parent:** [2H2XKH](../2H2XKH-formatter-coexistence/ticket.md)

## Work Log

- 2026-06-18T17:03:00.000Z Started: Created under epic 2H2XKH. Existing coverage: biome excludes
  (`BIOME_JSON_MERGE`), eslint ignores (`getIgnores`). Gaps: `.prettierignore` additive append, ruff
  `extend-exclude`, rustfmt `ignore`, dprint `excludes`, oxfmt. Source owned paths from `SAFEWORD_PATHS`.
- 2026-06-19T17:30:00.000Z Understanding + first slice (e6056209): user confirmed `.project/` wholesale
  exclude. Added the single source `SAFEWORD_IGNORE_DIRS` (owned-paths.ts) + a drift-guard test
  (covers every schema-managed dot-dir). Wired **Biome** (`BIOME_JSON_MERGE`) from it — now excludes
  all owned dirs, not just `.safeword`. Marker-match is substring (`content.includes`), so the
  **prettier** `.prettierignore` change needs a fresh marker for existing installs to re-apply (careful
  migration; touches `stale-config-scan.ts`). Remaining: prettier, ruff `extend-exclude`, rustfmt
  `ignore`, dprint, oxfmt — all additive `skipIfMissing`, same `SAFEWORD_IGNORE_DIRS` source.
- 2026-06-19T18:10:00.000Z Prettier (351fa545): `MANAGED_PRETTIER_PATHS` now derives from
  `SAFEWORD_IGNORE_DIRS` — adds `.codex/` + wholesale `.project/`/`.safeword-project/` (drops the
  per-file INDEX lines). Marker gains an `(owned dirs)` suffix so existing installs re-apply on upgrade;
  stable header substring kept so `stale-config-scan` needs no change. Tests: fresh-install + upgrade
  migration. dprint (39792ff8): `DPRINT_JSON_MERGE` adds `<dir>/**` excludes across dprint.json/.dprint.json(c).
- 2026-06-19T18:10:00.000Z Scope decision (done_when reconciliation): **ruff/rustfmt need no exclude** —
  they only process `.py`/`.rs`, and safeword's owned dirs contain neither, so the customer's ruff/rustfmt
  already never touch safeword paths (done_when satisfied by file-type; their configs are TOML, no
  JSON-merge path). **oxfmt deferred**: its exclude is per-override `excludeFiles` (not a clean top-level
  list) and it has a near-zero install base (beta Feb 2026) — tracked as a follow-up. Shipped coverage:
  Biome, Prettier, dprint (the formatters that actually format safeword's file types), all from one
  `SAFEWORD_IGNORE_DIRS` source with a drift guard.
- 2026-06-19T18:35:00.000Z oxfmt (dd603cbb): user chose to wire it before close. Re-checked oxc docs —
  oxfmt DOES have a clean top-level `ignorePatterns` field (my deferral was based on incomplete info), so
  it's the same shape as dprint. Factored `dirGlobExcludeMerge(field)` and use it for both
  (`DPRINT`=excludes, `OXFMT`=ignorePatterns); registered `.oxfmtrc.json(c)`. Module configs
  (`oxfmt.config.*`) aren't merged, like `prettier.config.*`. All formatter coverage now complete:
  Biome / Prettier / dprint / oxfmt wired; ruff/rustfmt no-churn by file-type.
- 2026-06-19T19:15:00.000Z Done: full suite green (3080 pass / 3 skip, 207 files), lint + tsc clean.
  Customer formatters (Biome/Prettier/dprint/oxfmt) skip every safeword-owned dir from one
  `SAFEWORD_IGNORE_DIRS` source with a drift guard. Status → done. Closes the last child of epic 2H2XKH.

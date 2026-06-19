---
id: EYRK34
slug: formatter-ignore-safeword-paths
type: task
phase: intake
status: in_progress
parent: 2H2XKH
created: 2026-06-18T17:00:07.149Z
last_modified: 2026-06-18T17:03:00.000Z
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

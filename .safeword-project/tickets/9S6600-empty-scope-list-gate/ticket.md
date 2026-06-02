---
id: 9S6600
slug: empty-scope-list-gate
type: patch
phase: implement
status: in_progress
epic: bdd-chain-hardening
parent: EECVXB
created: 2026-06-02T04:58:17.705Z
last_modified: 2026-06-02T04:58:17.705Z
---

# Reject empty scope/out_of_scope/done_when lists in intake-exit gate

**Goal:** Close the gate hole where an empty `scope:` (or `out_of_scope:`/`done_when:`) block sequence passes the intake-exit check.

**Why:** P1 — the required-fields check at [pre-tool-quality.ts:229-240](packages/cli/templates/hooks/pre-tool-quality.ts) uses `!value || value === 'null'`. The hook's `parseFrontmatter` returns `[]` for an empty block sequence, and `![]` is `false` (empty arrays are truthy in JS), so an empty `scope:` list reads as "present" and the gate passes. Tests only exercise scalar values, so the path is unguarded.

**Scope:** In the `missing` filter, also treat an empty array (and an array of only empty strings) as missing. One-line-ish change in [pre-tool-quality.ts](packages/cli/templates/hooks/pre-tool-quality.ts) + sync to `.safeword/hooks/`. Add a fixture to `tests/integration/quality-gates.test.ts` (the "9.x" block) with an empty `scope:` list asserting deny.

**Out of scope:** changing the frontmatter parser itself; the scalar-only CLI ticket-sync parser (unrelated — it never reads scope fields).

**Done when:** a ticket with an empty `scope:` block sequence is denied at test-definitions.md creation; a populated list still passes; a test pins both.

## Work Log

- 2026-06-02T04:58:17.705Z Started: Created ticket 9S6600
- 2026-06-02T05:35Z RED: added quality-gates test 9.2b — empty-list scope fields (with dimensions.md present) must be denied as missing. Fails on current gate (`![]` is false → passes).
- 2026-06-02T05:38Z GREEN: gate's `missing` filter now treats undefined/`'null'`, empty arrays, and all-blank arrays/strings as missing (pre-tool-quality.ts). Synced template → `.safeword/hooks/` (identical). 71/71 quality-gates tests pass (incl. 9.2/9.3/9.4 regression). Done-when met.

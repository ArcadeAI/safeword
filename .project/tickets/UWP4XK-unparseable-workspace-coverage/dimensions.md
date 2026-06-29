# Behavioral dimensions — UWP4XK (present-but-unparseable workspace managers)

Behavior: `discoverWorkspaces(dir) → { patterns, unreadable[] }`, and how the
`unreadable[]` set is surfaced (root-index advisory, `architecture`/`--check`
warning) and folded into the root fingerprint. The input space is "for each
manager at the root, is it absent, parseable, or present-but-unparseable, and do
any OTHER managers still yield packages."

| # | Dimension | Partitions | Covered by |
| - | --------- | ---------- | ---------- |
| D1 | **Per-manager detection outcome** | (a) absent; (b) parsed; (c) present-but-unparseable | U1–U5 (one per manager × each outcome) |
| D2 | **Which manager is unparseable** | (a) go.work; (b) Cargo `[workspace]`; (c) uv `[tool.uv.workspace]`; (d) pnpm flow-style; (e) package.json malformed shape | U1/AC1, U2/AC2(Cargo), U3, U4, U5 |
| D3 | **Co-present readable manager** | (a) none (only the unreadable one) → no root index, warning-only surface; (b) ≥1 other readable → root index lists readable packages + carries the advisory | AC1–AC3 + U6 (b); AC4 (a: warning-only) |
| D4 | **Absent vs present-but-empty boundary** | (a) manifest absent → absent; (b) workspace table/field absent → absent; (c) table/field present but unparseable → unreadable; (d) explicitly-empty (e.g. `workspaces: []`) → absent | U7 (Cargo no-table absent), U8 (empty array absent) |
| D5 | **Fingerprint freshness** | (a) unreadable set empty → fingerprint unchanged vs today (no churn); (b) unreadable appears/disappears → fingerprint moves | U9 |
| D6 | **Surface non-blocking** | (a) `architecture` exit unchanged; (b) `--check` exit unchanged (advisory ≠ stale) | AC4 (command warns, exit 0) |

## Load-bearing partitions (where this change actually bites)

- **D1(c) for every manager (D2 a–e)** — the bug: a present-but-unparseable
  manifest must become an `unreadable` signal, not `undefined`. New behavior.
- **D3(b)** — the readable side is never blinded: a malformed go.work next to a
  working manager still lists the working packages AND names go.work. This is the
  coverage-honesty property (the union from #554 must survive one bad manager).
- **D4(b) vs D4(c)** — the boundary that must NOT over-fire: a `Cargo.toml` with no
  `[workspace]` (single crate) stays absent; only a present table with unparseable
  members is unreadable. Guards against advisory false alarms.
- **D5(a)** — no churn: a repo with zero unreadable configs keeps its fingerprint.

## Out-of-partition (not exercised; noted)

Nested/recursive workspaces (a member that is itself a workspace root) — out of
scope; current behavior (treat as one leaf, or not discovered) is unchanged.
Repairing the unparseable manifest — never attempted.

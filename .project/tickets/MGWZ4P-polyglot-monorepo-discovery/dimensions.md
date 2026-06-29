# Behavioral dimensions — MGWZ4P (workspace-manager union in discovery)

The behavior is `discoverLeafDirectories(projectDirectory) → leaf dirs`. The input
space is "which workspace managers are present at the repo root, and how their
declared dirs relate." Dimensions and the partitions that change the outcome:

| # | Dimension | Partitions | Covered by |
| - | --------- | ---------- | ---------- |
| D1 | **Managers present** | (a) none; (b) single JS (package.json or pnpm); (c) single non-JS (go.work / Cargo / uv); (d) JS + one non-JS; (e) multiple non-JS; (f) JS + multiple non-JS | U5/AC (a,b,c no-regression); U1/AC1 (d); U2/AC2 (e); union-flat (f) |
| D2 | **JS-vs-JS conflict** (package.json `workspaces` + pnpm-workspace.yaml) | (a) package.json only; (b) pnpm only; (c) BOTH, different dirs → package.json wins (precedence, NOT union) | U3/existing precedence test |
| D3 | **Declared-dir overlap across managers** | (a) disjoint (different ecosystems, the common case); (b) one dir matched by two managers (maturin: pyproject + Cargo) → dedupe to one | U4 (dedupe); U1/U2 (disjoint) |
| D4 | **Discovered dir has a recognized manifest** | (a) has manifest → kept; (b) glob matches a dir with no recognized manifest → skipped (unchanged existing guard) | existing `hasRecognizedManifest` tests (no change) |

## Load-bearing partitions (where this change actually bites)

- **D1(d), D1(e), D1(f)** — the bug: today only the FIRST manager's packages are
  discovered; the rest are silently dropped. These are the new GREEN behavior.
- **D2(c)** — the boundary that must NOT change: two JS managers are alternatives,
  not additions, so package.json still wins and pnpm's dirs are not unioned in.
  The union is *cross-ecosystem only*.
- **D3(b)** — dedupe: a single dir legitimately matched by two managers is listed
  once (the existing `Set` already guarantees this; assert it explicitly).

## Out-of-partition (not exercised; noted)

Nested/recursive workspaces (a member that is itself a workspace root) — out of
scope per the ticket; current behavior (treat as one leaf) is unchanged.

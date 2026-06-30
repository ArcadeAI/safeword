# Spec: Surface a present-but-unparseable workspace manager (UWP4XK)

## Jobs To Be Done

### UWP4XK.J1 — A polyglot map that admits what it could not read

**Persona:** Technical Builder (TB)

When safeword discovers my monorepo and one workspace manager's root manifest is
present but unparseable (a malformed `go.work`, an unreadable Cargo `[workspace]
members`, a flow-style `pnpm-workspace.yaml`), I want the generated map to **say
so out loud** instead of silently listing zero packages for it, so I can trust
"the map is complete" or see exactly which config to fix. (The NTB can't audit
the diff to notice the Go services are missing — silence reads as "complete.")

#### UWP4XK.J1.AC1 — Present-but-unparseable is surfaced, not dropped

A root manifest that declares a workspace whose member list can't be parsed is
named as unreadable (manager + config file) wherever the architecture surface is
shown — it never contributes zero packages with no marker.

#### UWP4XK.J1.AC2 — Absent stays silent

A manager that is genuinely absent (no `go.work`; a `Cargo.toml`/`pyproject.toml`
with no workspace table; a single-crate/single-package repo) produces no
unreadable signal — only *present-but-unparseable* is surfaced, so the advisory
is never a false alarm.

#### UWP4XK.J1.AC3 — The readable side is never blinded

When other managers are readable, their packages are still discovered and listed;
the unreadable manager is surfaced *alongside* them (an advisory in the rendered
root index), not in place of them. One unreadable config never drops a readable
manager's packages.

#### UWP4XK.J1.AC4 — Advisory, never blocking

The surface is advisory: `safeword architecture` and `architecture --check` print
a warning but their exit codes are unchanged; the root index renders the advisory
but no command fails. The human doc / the build is never blocked on it.

#### UWP4XK.J1.AC5 — The advisory stays fresh

The root-index advisory re-renders when an unreadable config appears or is fixed
(the unreadable set is part of the root fingerprint). A repo with no unreadable
config keeps its existing fingerprint — no churn.

## Problem

`discoverLeafDirectories` unions managers (#554), but each detector returns
`string[] | undefined` where `undefined` means BOTH "absent" and
"present-but-unparseable." The unparseable case is filtered out at discovery,
before the per-package "not introspected" marker (ZRW21K) can fire — a manager
that discovered nothing has nothing to mark. So the set vanishes silently.

## Design

Replace each detector's `string[] | undefined` with a discriminated
`WorkspaceDetection`:

- `{ status: 'absent' }` — no workspace declared (no signal).
- `{ status: 'parsed'; patterns: string[] }` — globs/dirs to expand (today's path).
- `{ status: 'unreadable'; manager; config }` — a workspace is declared but its
  member list can't be parsed.

What counts as *declared but unreadable* per manager — the member-list declaration
is PRESENT but can't be parsed (a *missing* declaration is absent, never a false
alarm):

- **go.work**: a `use` directive present but zero member dirs parse (malformed/junk
  `use`). No `use` directive at all ⇒ absent (a `go work init` file with no modules).
- **Cargo `[workspace]`**: `[workspace]` + a `members` key present but unparseable.
  No `[workspace]` ⇒ absent (single crate); `[workspace]` with no `members` key ⇒
  absent (a valid root-package workspace that auto-discovers members from path deps /
  `default-members` — out of scope like nested workspaces, verified against the Cargo
  reference).
- **uv**: `[tool.uv.workspace]` table present but `members` unparseable (no table ⇒
  absent). uv *requires* `members`, so a table with no usable members is genuinely
  malformed → unreadable.
- **pnpm**: a `packages:` key present but no glob parses (flow-style, empty block).
  No `packages:` key ⇒ absent (a catalog-only/settings-only file is valid and declares
  no members — verified against the pnpm reference).
- **package.json**: a `workspaces` field present but not a usable array /
  `{packages: [...]}` (malformed shape) ⇒ unreadable; an explicitly empty array
  ⇒ absent (deliberate). JS precedence (package.json wins over pnpm) is preserved:
  package.json present — parsed OR unreadable — wins; only an absent package.json
  falls through to pnpm.

`discoverWorkspaces(dir)` returns `{ patterns, unreadable[] }`. `discoverLeafDirectories`
becomes a thin wrapper over `.patterns` (unchanged behavior + signature).
`extractMonorepoModel` gains `unreadableWorkspaces[]`; `monorepoFingerprint`
includes it only when non-empty. The root index renders a `## Coverage gaps`
advisory; `architecture`/`--check` print a non-blocking warning.

## Out of scope

Nested/recursive workspaces; new manifest formats; per-leaf extraction; any
blocking gate; repairing the unparseable manifest.

# Impl Plan: Monorepo coverage honesty (ZRW21K)

**Status:** planned

## Approach

Two small, independent changes on the existing monorepo machinery; reuse
everything downstream of discovery and rendering.

Build order (each builds on the previous green):

1. **`detectPnpmWorkspaces(cwd): string[] | undefined`** — a minimal,
   dependency-free reader of `pnpm-workspace.yaml`: find the `packages:` block,
   collect the indented `- "<glob>"` entries (strip quotes; ignore `!`-exclusions
   and anything it can't parse → return `undefined`). _Unit_
   (`architecture-monorepo.test.ts`). Covers the parse + the graceful-fallback edge.
2. **Wire pnpm into discovery** — `discoverLeafDirectories` uses
   `detectWorkspaces(cwd) ?? detectPnpmWorkspaces(cwd)`. The `??` gives the
   required precedence for free (package.json `workspaces` wins; pnpm is the
   fallback), and leaves `detectWorkspaces` — shared with `sync-config` —
   untouched, so no sync-config behavior changes. _Integration_ (CLI over a pnpm
   fixture). Covers TB1.AC1, the precedence, and the npm/single-repo regression.
3. **Un-introspected marker** — `PackageNode` gains `introspected: boolean`
   (`extractSkeleton(dir).nodes.length > 0`), set in `extractMonorepoModel`;
   `renderPackageSection` emits `> ⚠ not introspected — no recognized source
layout` for an un-introspected package instead of the `PURPOSE_PLACEHOLDER`
   purpose line. _Unit_ (model + render) + _integration_. Covers TB2.AC1/AC2.
4. **Black-box BDD steps** + dogfood: `steps/monorepo-coverage-honesty.steps.ts`
   builds pnpm / npm / mixed fixtures and drives the real CLI; confirm this repo
   (npm workspaces, both packages have `src/`) is unaffected and `--check` stays
   green.

Test-layer rationale: the YAML parse is pure → unit; discovery + render are a
process-boundary contract (which docs appear, what the root index says) → CLI
integration; the `.feature` lane is the end-to-end acceptance proof.

## Decisions

| Decision              | Choice                                                                             | Alternatives considered              | Rejected because                                                                                                               |
| --------------------- | ---------------------------------------------------------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| pnpm parse            | Minimal hand-parse of the `packages:` block list                                   | Add a YAML dependency                | Overkill for one simple file; breaks the zero-dependency posture                                                               |
| Where pnpm plugs in   | `discoverLeafDirectories` via `detectWorkspaces(cwd) ?? detectPnpmWorkspaces(cwd)` | Extend the shared `detectWorkspaces` | That function feeds `sync-config` too; scoping pnpm to the architecture feature avoids an unintended depcruise behavior change |
| Precedence            | `??` short-circuit — package.json wins                                             | Merge both lists                     | pnpm ignores package.json `workspaces`; a repo with both is a real config, package.json is authoritative                       |
| Un-introspected mark  | A distinct `> ⚠ not introspected` blockquote, never the prose placeholder          | Reuse `PURPOSE_PLACEHOLDER`          | That is the exact "silently shallow" bug the ticket fixes                                                                      |
| Flow-style / `!` YAML | Out of scope → parser returns `undefined` (graceful single-repo fallback)          | Full YAML support                    | Block-list covers the common case; degradation is safe, not wrong (proven by a scenario)                                       |

## Arch alignment

Honors `ARCHITECTURE.md`:

- **Deterministic, LLM-free engine** — both changes are pure parse/derive; no new
  source of truth, no LLM, no fingerprint-input change.
- **Never silently wrong** (the state-doc contract) — the un-introspected marker
  is the direct expression of "incomplete, but visibly so."

## Known deviations

- pnpm discovery lives beside `detectWorkspaces` rather than inside it — a
  deliberate scope guard so `sync-config` is untouched. If a later ticket wants
  pnpm-aware depcruise config, unify them then (and reconcile the precedence).

## Assessment triggers

- **WBM8JE** (per-language extractors) lands — it will want pnpm + go.work +
  Cargo discovery in one place; revisit whether `detectPnpmWorkspaces` should
  merge into a single multi-manifest discovery function.
- pnpm adds/repractices its workspace file format — revisit the hand-parser.

# Impl Plan: Go language pack (ZD70P1)

**Status:** implemented

_Reconciled against what shipped: all six Decisions held as written (no
mid-build reversals); Arch alignment holds (pure derive/parse, honest "not
introspected" for flat Go, JS byte-identical); the one addition beyond the
original plan — the `manifest-block.ts` / `manifest-dependencies.ts` extraction —
is recorded under Known deviations (an `/audit`-driven, behavior-preserving
dedup)._

## Approach

Outside-in TDD over three production seams + a black-box step file. The extractor
is convention-driven (it enumerates directories), not language-parsing, so each
axis is a small extension point. Build order — keystone first so single-repo Go
turns green immediately, then discovery wires the monorepo, then fingerprint closes
drift:

1. **Extraction (keystone)** — `architecture-skeleton.ts`: `src/` stays
   authoritative (TS byte-identical); when it yields nothing and a `go.mod` is
   present, enumerate the recognized Go layout dirs (`cmd`/`internal`/`pkg`) as
   modules. Flat Go → empty skeleton. _Unit_ (`architecture-skeleton.test.ts`).
   Fixes single-repo Go AND monorepo Go leaves at once, and feeds the fingerprint's
   `moduleNames` for free.
2. **Discovery** — `architecture-monorepo.ts`: `detectGoWork` (dependency-free
   `use` parse) appended to the `??` source chain; keep-predicate generalized to
   "has package.json OR go.mod"; Go package name from the `go.mod` `module`
   directive. _Unit_ (`architecture-monorepo.test.ts`).
3. **Fingerprint** — `architecture-fingerprint.ts`: union the `go.mod` `require`
   module paths (keys, not versions) into the dependency set. _Unit_
   (`architecture-fingerprint.test.ts`).
4. **Black-box BDD + dogfood** — `steps/architecture-go-language-pack.steps.ts`
   over real fixtures; the dependency-drift AC is proven via `architecture --check`
   reporting stale. Shared fixture helpers extracted to
   `steps/support/architecture-fixtures.ts` (imported by the ZRW21K lane too).

Test-layer rationale: parse/extract/fingerprint are pure → unit; which docs appear
and what `--check` reports are a process-boundary contract → the `.feature` lane.

## Decisions

| Decision         | Choice                                                                | Alternatives considered                | Rejected because                                                                        |
| ---------------- | --------------------------------------------------------------------- | -------------------------------------- | --------------------------------------------------------------------------------------- |
| Go extraction    | Directory-convention enumeration of `cmd`/`internal`/`pkg`            | Parse Go source / use the Go toolchain | Conventions are deterministic and dependency-free; matches the pnpm/go.work hand-parses |
| src vs Go layout | `src/` wins; Go layout read only when no `src/` and a `go.mod` exists | Merge both                             | Keeps every TS/JS doc byte-identical — zero regression surface                          |
| Discovery wiring | `detectGoWork` appended to `??` chain after JS/pnpm                   | Fold into shared `detectWorkspaces`    | That feeds `sync-config`; scoping go.work to the architecture feature avoids drift      |
| Leaf predicate   | keep a dir with package.json **OR** go.mod                            | package.json only                      | Go leaves have no package.json — they'd be silently dropped                             |
| Drift coverage   | Black-box scenario via `architecture --check` + a unit pin            | Unit test only                         | Scenario-gate review: the fingerprint IS observable (frontmatter + `--check`)           |
| Go identity      | `go.mod` `module` directive, fallback basename                        | Always basename                        | The module path is the canonical identity, mirroring package.json `name`                |

## Arch alignment

Honors `ARCHITECTURE.md` and the state-doc contract:

- **Deterministic, LLM-free engine** — extraction/discovery/fingerprint are pure
  derive/parse; no new source of truth, no LLM.
- **Never silently wrong** — a flat Go package stays the honest ZRW21K "not
  introspected" marker; the omission is visible, not faked.
- **Polyglot promise** — Go plugs into the same heal-target + fingerprint machinery
  as JS, the seam WBM8JE's Rust/Python slices reuse.

## Known deviations

- go.work discovery lives beside `detectWorkspaces` (via the `??` chain), not
  inside it — a deliberate scope guard so `sync-config` is untouched, mirroring how
  ZRW21K scoped pnpm.
- During verify, `/audit` jscpd flagged the new block parsers + the duplicated
  `DEPENDENCY_SECTIONS` loop; extracted `manifest-block.ts` and
  `manifest-dependencies.ts` (behavior-preserving) to hold the 0-clone bar.

## Assessment triggers

- **WBM8JE Rust/Python slices** land — they will want Cargo `[workspace]` /
  `go.work` / pnpm discovery in one place; revisit whether `detectGoWork` /
  `detectPnpmWorkspaces` should merge into a single multi-manifest discovery.
- Inter-package Go edges become needed — that requires a `go.mod` module-path →
  workspace-directory map; its own slice (out of scope here).
- Go changes its layout conventions or `go.work`/`go.mod` grammar — revisit the
  hand-parsers and the `cmd`/`internal`/`pkg` recognized set.

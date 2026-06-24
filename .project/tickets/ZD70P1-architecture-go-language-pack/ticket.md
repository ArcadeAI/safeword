---
id: ZD70P1
slug: architecture-go-language-pack
type: feature
phase: scenario-gate
status: in_progress
created: 2026-06-24T02:21:10.704Z
last_modified: 2026-06-24T02:25:00.000Z
scope:
  - Go module extraction — extractSkeleton recognizes a Go layout (top-level `cmd/`, `internal/`, `pkg/` directories as modules) when a directory has a `go.mod` and no `src/` tree; fixes BOTH single-repo Go (one architecture doc) and monorepo Go leaves (introspected + leaf doc) with one change
  - go.work discovery — detectGoWork reads the `use (...)` block (and single-line `use ./x`) as a workspace source, after the JS sources (package.json workspaces ?? pnpm-workspace.yaml ?? go.work); dependency-free parse mirroring detectPnpmWorkspaces
  - Generalized leaf predicate — discoverLeafDirectories keeps a discovered directory that has a recognized manifest (`package.json` OR `go.mod`), so Go leaves are not filtered out
  - Go fingerprint input — the shape-fingerprint's dependency set includes the `go.mod` `require` module paths (keys, not versions), so Go dependency drift moves the leaf/single-repo fingerprint
  - Go package identity — a Go leaf's name comes from the `go.mod` `module` directive (fallback: directory basename), mirroring how a JS leaf uses its package.json `name`
  - Tests (unit + black-box BDD over real Go fixtures: single-repo Go, go.work monorepo, mixed JS+Go monorepo) and a no-regression guarantee for JS/TS repos
out_of_scope:
  - Inter-package Go dependency EDGES in the root index (mapping a `go.mod` require module path back to a workspace directory) — defer to a follow-up slice; Go leaves render with no edges in this slice
  - Flat single-package Go (only `*.go` files at the package root, no cmd/internal/pkg) — stays "not introspected" (honest marker, ZRW21K), a noted limitation
  - Mixed ROOT polyglot where both `go.work` and `package.json` workspaces sit at the repo root — JS wins the `??` chain; Go-rooted and JS-rooted repos are each handled, the both-at-root case is a noted limitation
  - `go.mod` `replace` directives, build tags, and nested/sub-modules — out
  - Rust and Python language packs — separate WBM8JE slices
  - Changing the JS/TS discovery, extraction, or fingerprint behavior in any observable way (pure addition; regression-guarded)
done_when:
  - A single-repo Go project (go.mod + cmd/internal/pkg, no src/) produces an architecture doc listing those modules — today it produces nothing
  - A go.work monorepo produces a root index + a colocated leaf doc per Go package that has a cmd/internal/pkg layout — same shape an npm/pnpm monorepo gets
  - A Go dependency added to or removed from a package's `go.mod` require block moves that package's shape-fingerprint (drift is caught)
  - A mixed JS+Go monorepo introspects both the JS and the Go packages; the JS packages are byte-identical to today
  - JS/TS single-repo and monorepo behavior is unchanged (no regression); `safeword architecture --check` still passes on this repo
  - All scenarios in features/architecture-go-language-pack.feature pass via the BDD lane; full suite green
---

# Go language pack — architecture discovery, extraction, fingerprint

**Goal:** Teach the generated architecture doc to introspect **Go** projects —
single-repo and go.work monorepo — so a Go package gets real structural extraction
(its `cmd`/`internal`/`pkg` modules) and Go dependency-drift detection, instead of
the "not introspected" marker ZRW21K honestly shows today.

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.

## Parent epic

First slice of **WBM8JE** (per-language architecture extractors / "language packs",
itself out-of-scope of epic **QD5DTT**). WBM8JE was deliberately deferred behind
ZRW21K (make the omission honest first, fill it later). This slice fills it for Go;
Rust and Python follow as their own slices. The seam proven here — discovery source

- layout-aware `extractSkeleton` + manifest dependency set — is the template the
  other two packs reuse.

## Resolved design (grounded in the actual seams)

The extractor is convention-driven, not language-parsing: `extractSkeleton` already
just enumerates the subdirectories of `src/`. Three extension points, one per axis:

1. **Extraction (keystone)** — `extractSkeleton`: keep `src/` first (TS byte-identical),
   else, when a `go.mod` is present, enumerate top-level `cmd/`/`internal/`/`pkg/`
   as modules. This single change fixes single-repo Go AND monorepo Go leaves, and
   feeds the fingerprint's `moduleNames` for free.
2. **Discovery** — `discoverLeafDirectories`: append `detectGoWork` to the `??`
   source chain and generalize the keep-predicate from "has package.json" to "has
   package.json OR go.mod".
3. **Fingerprint** — `collectShapeInputs`: union the `go.mod` `require` module paths
   into `dependencyNames`, so Go dep drift is a real drift signal.

**Rejected:** a Go-toolchain/AST dependency (overkill — directory conventions are
deterministic and dependency-free, consistent with the pnpm/go.work hand-parses);
inter-package Go edges (a module-path→directory mapping problem, its own slice).

## Open questions

- none — design resolved against the read seams; the edge cases above are explicit
  out-of-scope limitations to note in the doc/markers, not open questions.

## Work Log

- 2026-06-24T02:21:10.704Z Started: Created ticket ZD70P1.
- 2026-06-24T02:25:00Z Intake: sliced WBM8JE → Go pack first (cleanest three-axis
  seam: go.work discovery mirrors pnpm parse, cmd/internal/pkg is convention-deterministic,
  go.mod require is a simple fingerprint source). Read all three seams
  (architecture-skeleton/-monorepo/-fingerprint) to ground scope. Keystone =
  layout-aware extractSkeleton (fixes single-repo + monorepo Go at once). Next:
  define-behavior.

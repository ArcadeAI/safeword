# Spec: Go language pack — architecture discovery, extraction, fingerprint

## Intent

Teach the generated architecture state-doc to introspect Go projects — both a
single-repo Go service and a `go.work` monorepo — so a Go package gets real
structural extraction (its `cmd`/`internal`/`pkg` modules) and Go dependency-drift
detection, rather than the honest-but-empty "not introspected" marker ZRW21K shows
today. First of the WBM8JE "language packs"; proves the per-language seam Rust and
Python reuse.

## Intake Brief

- **Requested by:** Surfaced by the 2026-06-23 `/quality-review` of monorepo
  coverage (the gap WBM8JE was filed to close); built now as the first slice.
- **Cost of inaction:** A Go project (single-repo or monorepo) gets no architecture
  doc, or — in a mixed JS+Go monorepo — its Go packages stay marked "not
  introspected" indefinitely. The feature reads as "JS-only," undercutting the
  polyglot promise the guide makes.
- **Reversibility:** Two-way door. Pure addition behind the existing seam; JS/TS
  behavior is regression-guarded and unchanged. No data-model or public-API change
  — the doc format and fingerprint inputs only gain Go-shaped entries.

## References

- Parent epic **WBM8JE** (per-language extractors); itself out-of-scope of epic
  **QD5DTT** (architecture state docs).
- **ZRW21K** — the "not introspected" marker this slice replaces with real
  extraction for Go; its `pnpm-workspace.yaml` block-parse is the template for
  `detectGoWork`.
- Seams: `architecture-skeleton.ts` (extraction), `architecture-monorepo.ts`
  (discovery), `architecture-fingerprint.ts` (drift).

## Personas

- **Technical Builder (TB)** — here, in its polyglot flavor: a developer running an
  AI coding agent on a repo (or monorepo) that mixes Go with TypeScript, or is pure
  Go. TB is stack-agnostic by definition (personas.md: "ships Next, Django, Gin,
  anything"); they want the architecture doc to describe the Go code, not skip it.

## Vocabulary

- **Go layout** — the convention where a module's code lives under top-level
  `cmd/` (entrypoints), `internal/` (private packages), and `pkg/` (public
  packages). The recognized structural unit for extraction.
- **go.work** — Go's workspace file; its `use` directives list member module
  directories (the Go analogue of `package.json` workspaces).
- **Introspected** — a discovered package with a recognized source layout (so it
  gets a real leaf doc), vs. "not introspected" (listed but explicitly undescribed).

## Jobs To Be Done

### architecture-go-language-pack.TB1 — See my Go service's structure in the doc

**Persona:** Technical Builder (TB)

> When I generate the architecture doc for a Go project, I want its `cmd`/`internal`/`pkg`
> modules listed with the same structure a TypeScript repo gets, so I can review and
> annotate the real shape instead of an empty placeholder.

#### architecture-go-language-pack.TB1.AC1 — A single-repo Go project produces a doc listing its cmd/internal/pkg modules

#### architecture-go-language-pack.TB1.AC2 — A go.work monorepo produces a root index plus a leaf doc per Go package with a recognized layout

### architecture-go-language-pack.TB2 — Catch Go dependency drift, and never lose my JS docs

**Persona:** Technical Builder (TB)

> When a Go package's dependencies change, I want the architecture doc to register
> the drift; and when my repo mixes Go and JS, I want both introspected and my
> existing JS docs untouched, so the doc stays trustworthy across languages.

#### architecture-go-language-pack.TB2.AC1 — Adding/removing a require in a package's go.mod moves that package's shape-fingerprint

#### architecture-go-language-pack.TB2.AC2 — A mixed JS+Go monorepo introspects both, with the JS output byte-identical to today

#### architecture-go-language-pack.TB2.AC3 — A pure JS/TS repo's discovery, extraction, and fingerprint are unchanged (no regression)

## Outcomes

- A Go project — single-repo or `go.work` monorepo — gets a real, structurally
  accurate architecture doc with zero hand-run commands, identical in shape to what
  npm/pnpm projects already get.
- Go dependency drift is a first-class drift signal (fingerprint moves).
- The polyglot promise holds: mixing Go and JS introspects both; the JS half is
  provably unchanged.

## Open Questions

- none — resolved during intake against the read seams. Edge cases (inter-package
  Go edges, flat single-package Go, both-config-at-root polyglot, go.mod replace /
  build tags / sub-modules) are explicit out-of-scope limitations in ticket.md, not
  open questions.

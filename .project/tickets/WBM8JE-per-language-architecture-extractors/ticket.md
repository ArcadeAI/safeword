---
id: WBM8JE
slug: per-language-architecture-extractors
type: feature
phase: intake
status: backlog
created: 2026-06-23T15:07:27.802Z
last_modified: 2026-06-23T15:08:00.000Z
---

# Per-language architecture extractors (Go / Rust / Python) — the epic's "language packs"

**Goal:** Extend the generated architecture doc beyond the TypeScript/`src/`
assumption so non-JS packages in a monorepo (and non-JS single repos) get real
structural extraction and drift detection — not just a placeholder listing.

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.

## Status: BACKLOG — the deferred "language packs" (epic QD5DTT out-of-scope)

Surfaced by the 2026-06-23 `/quality-review` of monorepo coverage. The shipped
extractor is TypeScript-shaped on three axes; each needs a per-language strategy:

- **Workspace discovery** — beyond `package.json workspaces` + `pnpm-workspace.yaml`
  (the latter handled in ZRW21K): `go.work`, `Cargo.toml [workspace] members`,
  Python (uv/poetry workspaces or multi-`pyproject.toml`).
- **Module extraction** — beyond `<pkg>/src/*`: Go (`cmd/`, `internal/`, `pkg/`),
  flat-layout Python packages, etc. (Rust already uses `src/`.)
- **Shape-fingerprint inputs** — beyond `package.json` deps + dependency-cruiser
  config: `go.mod`, `Cargo.toml`, `pyproject.toml`/`requirements.txt` dependency
  sets, so structural drift in those packages is actually caught.

## Why it's deferred

Genuinely additive and large (three languages × three axes), and the safe
degradation today (a non-introspectable package is marked, not silently wrong —
delivered by ZRW21K) removes the urgency. The epic deliberately scoped this out
("ship the TS extractor first"). Best done one language pack at a time, each its
own slice, reusing the heal-target + fingerprint machinery.

## Depends on / relates to

- **ZRW21K** (monorepo-coverage-honesty) — adds pnpm discovery + the
  "un-introspected package" marker. ZRW21K makes the omission honest; WBM8JE
  removes the omission.
- Mirrors safeword's existing per-language pack structure (`packs/golang`,
  `packs/python`, `packs/rust`, `packs/sql`) — the extractor should plug into the
  same pack seam.

## Work Log

- 2026-06-23T15:08:00Z Created from the monorepo-coverage /quality-review; deferred
  to backlog behind ZRW21K (honest-omission first, fill-the-omission later).

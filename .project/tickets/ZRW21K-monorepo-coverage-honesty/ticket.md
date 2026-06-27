---
id: ZRW21K
slug: monorepo-coverage-honesty
type: feature
phase: done
status: done
created: 2026-06-23T15:07:27.754Z
last_modified: 2026-06-23T16:19:00.000Z
scope:
  - pnpm-workspace.yaml discovery — detectWorkspaces also reads a pnpm-workspace.yaml `packages:` list when package.json has no `workspaces` field (so pnpm monorepos get the root index + leaf docs)
  - Un-introspected-package marker — a discovered package whose skeleton is empty (no recognized `src/` modules → noop leaf, no leaf doc) is marked in the root index ("not introspected — no recognized source layout") instead of rendering a bare placeholder that reads as authoritative-complete
  - Tests (unit + black-box BDD over real pnpm + mixed-layout fixtures) and dogfood verification
out_of_scope:
  - Per-language extractors / discovery for Go, Rust, Python (go.work, Cargo [workspace], pyproject) → deferred ticket WBM8JE
  - Listing workspace dirs that have no package.json (a per-language discovery concern → WBM8JE)
  - pnpm-workspace.yaml flow-style (`packages: ["a","b"]`) if it complicates the parser — block-list form covers the overwhelming common case; note any limitation
  - Changing the shape-fingerprint inputs (still package.json-based; non-JS dep drift is WBM8JE)
done_when:
  - A pnpm monorepo (pnpm-workspace.yaml, no package.json workspaces) produces a root index + a colocated leaf doc per package with a src/ tree — same as an npm/yarn/bun monorepo today
  - A monorepo package with no recognized source layout (empty skeleton) is listed in the root index with an explicit "not introspected" marker, never as a silently-complete placeholder
  - Single-repo and npm/yarn/bun-workspace behavior is unchanged (no regression); `architecture --check` still passes on this repo
  - All scenarios in features/monorepo-coverage-honesty.feature pass via the BDD lane; full suite green
---

# Monorepo coverage honesty — pnpm discovery + un-introspected-package marker

**Goal:** Close the two coverage gaps the 2026-06-23 `/quality-review` found in
the merged monorepo support: pnpm monorepos get **no docs at all**, and a
non-introspectable package is listed in the root index as a bare placeholder that
can read as "described" when safeword is actually blind to it.

**Why:** safeword's promise is "never silently wrong." Today a **pnpm** monorepo
(one of the three major JS package managers — pnpm requires `pnpm-workspace.yaml`
and does **not** read `package.json`'s `workspaces` field) gets a silent `noop`,
indistinguishable from "feature broken." And a JS-rooted polyglot monorepo's root
index lists a package with no recognized source layout using the same placeholder
prose as a real-but-undescribed module — silently shallow.

## Resolved design (from the /quality-review /figure-it-out)

1. **pnpm discovery** — extend `detectWorkspaces` (the single workspace-truth
   source, already used by sync-config) to fall back to `pnpm-workspace.yaml` when
   `package.json.workspaces` is absent. Minimal hand-parse of the `packages:`
   block list (no new YAML dependency — keeps the zero-dep posture); fall back to
   no-workspaces on anything it can't parse. Reuses ALL existing leaf/fingerprint
   machinery unchanged.
2. **Un-introspected marker** — in the monorepo model, a package whose
   `extractSkeleton` yields zero modules is flagged; `renderRootIndex` emits an
   explicit "⚠ not introspected — no recognized source layout" line for it instead
   of the placeholder purpose. Honest: it's listed (the package set is real) but
   visibly not described, upholding "incomplete, never silently wrong."

**Rejected:** a new YAML dependency (overkill for one simple file); dropping the
`package.json` requirement to list non-JS dirs (that's per-language discovery →
WBM8JE).

## Open questions

- none — design resolved in the review; flow-style pnpm YAML is an explicit
  out-of-scope limitation to note if it complicates the parser.

## Work Log

- 2026-06-23T15:07:27Z Created from the monorepo-coverage /quality-review.
- 2026-06-23T15:12:00Z Intake: scope = pnpm-workspace.yaml discovery + the
  un-introspected-package marker (per-language extractors split to WBM8JE).
  Design resolved in the review's /figure-it-out. Next: BDD define-behavior.
- 2026-06-23T15:15:00Z Complete: define-behavior — spec.md (TB1 + TB2, 4 ACs),
  dimensions, 5 scenarios across 2 rules. Advancing to scenario-gate for
  independent /review-spec.
- 2026-06-23T15:25:00Z Complete: scenario-gate — independent /review-spec BLOCKED
  the first cut (the not-introspected marker wasn't proven distinct from the
  PURPOSE_PLACEHOLDER — the ticket's whole point). Reworked to 7 scenarios:
  marker asserted + placeholder excluded, mixed-layout contrast, precedence
  (both config files), graceful flow-style fallback, content-level single-repo
  regression. Re-review PASS-WITH-NITS (nits = a tag-misread + degradation
  strength, non-blocking). Stamp recorded; impl-plan written (detectPnpmWorkspaces
  - `??` precedence + introspected flag). Advancing to implement.
- 2026-06-23T16:19:00Z Complete: implement + verify + done. All 7 scenarios R/G/R
  (15702b4). detectPnpmWorkspaces + collectPnpmGlobs (dependency-free block-list
  parse), `??` precedence, introspected flag → root-index marker + fingerprint.
  /verify: full suite green (3350 pass, fresh build), 7 BDD scenarios, build +
  lint clean. /audit passed (0 cycles/violations, 0 clones, no dead code).
  Investigated a lone full-suite failure → stale `dist/` (cold-start-check guide
  from #348 not in the old build); clean rebuild → green, unrelated to ZRW21K.
  Dogfood root index re-rendered + --check green. verify.md written. Closing.

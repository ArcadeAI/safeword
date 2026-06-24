# Spec: Monorepo coverage honesty (pnpm discovery + un-introspected marker)

**Scope of this spec:** two coverage gaps in the merged monorepo support — pnpm
discovery and the un-introspected-package marker. No per-language extractors
(Go/Rust/Python → WBM8JE); no fingerprint-input changes.

## Intent

The merged architecture-doc feature discovers monorepo packages only from a root
`package.json` `workspaces` field. **pnpm** — one of the three major JS package
managers — does not use that field; it requires `pnpm-workspace.yaml`. So a pnpm
monorepo gets a silent `noop` (no docs at all), indistinguishable from "the
feature is broken." Separately, when the root index lists a package that has no
recognized source layout, it renders the same placeholder prose a real-but-
undescribed module would — so a reader can mistake "safeword can't see this
package" for "this package has no described architecture." Both undercut the
core promise: the doc may be incomplete, but it must never be _silently_ wrong.

## References

- 2026-06-23 `/quality-review` of monorepo coverage (the gap analysis + probe)
- XG9SFP (Slice 3) — `detectWorkspaces`, `discoverLeafDirectories`,
  `extractMonorepoModel`, `renderRootIndex` (the machinery this extends)
- WBM8JE — the deferred per-language extractors; ZRW21K makes the omission
  honest, WBM8JE removes it
- Verified: pnpm requires `pnpm-workspace.yaml` and ignores `package.json`
  `workspaces` (pnpm.io/workspaces)

## Personas

- **Technical Builder (TB)** — runs an AI agent on a real monorepo; harmed when
  their pnpm monorepo is silently skipped, or when the root index reads as a
  complete map while quietly omitting packages safeword can't introspect.

## Vocabulary

- **Workspace discovery** — finding a monorepo's member packages. Today: root
  `package.json` `workspaces`. This ticket adds `pnpm-workspace.yaml`.
- **Un-introspected package** — a discovered package whose skeleton is empty (no
  recognized `src/` modules), so it gets no leaf doc. The root index must mark it.

## Jobs To Be Done

### monorepo-coverage-honesty.TB1 — Get architecture docs in a pnpm monorepo

**Persona:** Technical Builder (TB)

> When I run safeword in my pnpm monorepo, I want the same architecture docs an
> npm/yarn monorepo gets — a root index plus a doc per package — so my project
> isn't silently skipped just because pnpm stores its workspace list in a
> different file.

#### monorepo-coverage-honesty.TB1.AC1 — A pnpm monorepo is discovered and documented

A monorepo configured with `pnpm-workspace.yaml` (and no `package.json`
`workspaces` field) produces the derived root index plus a colocated leaf doc per
package with a `src/` tree — identical to an npm/yarn/bun monorepo.

#### monorepo-coverage-honesty.TB1.AC2 — Existing discovery is unchanged

A single repo (no workspace config) and an npm/yarn/bun-`workspaces` monorepo
behave exactly as before — no regression from the pnpm fallback.

### monorepo-coverage-honesty.TB2 — Trust the root index to be honest about what it omits

**Persona:** Technical Builder (TB)

> When the root index lists a package safeword couldn't introspect, I want it
> clearly marked as not-described, so I never mistake an empty placeholder
> listing for a complete one.

#### monorepo-coverage-honesty.TB2.AC1 — An un-introspected package is visibly marked

A discovered package with no recognized source layout (empty skeleton, no leaf
doc) is listed in the root index with an explicit "not introspected" marker —
never the same placeholder prose used for a described module.

#### monorepo-coverage-honesty.TB2.AC2 — An introspected package is not marked

A package that does have a `src/` tree (and gets a leaf doc) is listed normally,
with no "not introspected" marker.

## Outcomes

- A pnpm monorepo yields the same root index + leaf docs as an npm monorepo.
- The root index marks every package safeword can't introspect, so it can never
  read as a complete map while silently omitting a package.
- Single-repo and npm/yarn/bun-workspace behavior is byte-unchanged.

## Open Questions

- none — pnpm requires `pnpm-workspace.yaml` (verified); block-list parse covers
  the common case, with flow-style YAML an explicit out-of-scope limitation.

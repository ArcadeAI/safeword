---
id: 073
slug: deploy-withastro-action
type: task
status: done
phase: done
created: 2026-03-29T14:39:00Z
last_modified: 2026-03-29T14:42:00Z
---

# Task: Replace manual deploy steps with withastro/action

**Type:** Improvement

**Scope:** Replace the 3 manual build steps (bun install, bun build, upload-pages-artifact) in `deploy-website.yml` with the official `withastro/action@v6`. Drops the pinned Bun version, adds automatic caching, and follows Astro's maintained deployment path.

**Out of Scope:** Changing hosting provider, adding preview deployments, SSR, or CI for the CLI package.

**Done When:**

- [x] `deploy-website.yml` uses `withastro/action@v6` with `path: packages/website` and `package-manager: bun`
- [x] Manual `setup-bun`, `bun install`, `bun run build`, and `upload-pages-artifact` steps removed
- [x] Site deploys successfully to GitHub Pages
- [x] `workflow_dispatch` manual trigger still works

**Tests:**

- [x] Push a docs change to main and verify deploy succeeds
- [x] Trigger manual `workflow_dispatch` and verify deploy succeeds

## Research

- `withastro/action@v6.0.0` (2026-03-19): composite action handling install, build, upload in one step
- `path` option for monorepo support — set to `packages/website`
- **Monorepo lockfile caveat:** the action only looks for lockfiles inside the `path` directory (`find . -maxdepth 1`). This project's `bun.lock` is at the repo root, not in `packages/website/`. Must pass `package-manager: bun` explicitly to skip lockfile detection.
- `bun install` runs inside `packages/website/` — Bun's workspace resolution should find the root lockfile, but verify this works in CI
- ~~`deploy-pages@v4` is latest~~ — v5 released 2026-03-25, Dependabot PR #47 is open. Merge #47 before starting this ticket (blocked on CI going green — tickets 076 + 077)

## Work Log

- 2026-03-29 Created. Current workflow works but manually reimplements what the official action provides.
- 2026-03-29 Research: found monorepo lockfile detection issue — action looks in `path` dir only, not repo root. Fix: `package-manager: bun` explicit param. Also updated from v5 to v6 (released 2026-03-19).
- 2026-03-29 Done. Commit 435f11b. Deploy verified via workflow_dispatch — success in 43s. deploy-pages bumped to v5.

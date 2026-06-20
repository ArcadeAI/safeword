---
id: 1QNPCF
slug: custom-projectroot-wiring
type: task
phase: intake
status: in_progress
created: 2026-06-20T15:28:05.112Z
last_modified: 2026-06-20T15:28:05.112Z
---

# Custom paths.projectRoot: wire formatter ignores + auto-upgrade staging

**Goal:** Make the namespace-root contribution to formatter ignore-lists and the auto-upgrade owned-paths prefixes follow the _resolved_ `paths.projectRoot`, not just the static `.project/`/`.safeword-project/`.

**Why:** A custom `projectRoot` (e.g. `team-ns`) is invisible to `SAFEWORD_IGNORE_DIRS` and `generateOwnedPathsModule`, so its scaffolded files aren't auto-staged on upgrade (breaks the clean-tree gate — functional) and its markdown gets reformatted by prettier/dprint (cosmetic churn). Issue #273.

## Decision (figure-it-out)

Option A: replace static `SAFEWORD_IGNORE_DIRS` with a resolved-root-aware `safewordIgnoreDirs(ctx)` applied at the ctx-bearing seams. jsonMerge `merge`/`unmerge` and generators already receive `ctx`; jsonMerges re-apply every upgrade (no marker-skip). Guard `projectRoot:'.'` (must add no repo-root dir, else formatters skip the whole repo).

- **Slice 1 (this pass):** `safewordIgnoreDirs(ctx)` → owned-paths generator (Facet 2) + Biome/dprint/oxfmt merges (Facet 1, the formatters that touch markdown).
- **Slice 2 (deferred):** `.prettierignore` textPatch — needs the textPatch system extended to pass ctx + content factory; only helps fresh installs (marker-skip). Lower value, higher plumbing.

## Work Log

- 2026-06-20T15:28:05.112Z Started: Created ticket 1QNPCF
- 2026-06-20T15:28Z Revalidated #273: confirmed SAFEWORD_IGNORE_DIRS feeds Biome(:141)/dprint+oxfmt(:199)/eslint and MANAGED_PRETTIER_PATHS; generateOwnedPathsModule(:84) hardcodes .project/+.safeword-project/. Verified merge/unmerge + generators receive ctx; textPatch does not.
- 2026-06-20T15:28Z figure-it-out → Option A, sliced (owned-paths + jsonMerge formatters now; prettier deferred).
- 2026-06-20T15:42Z Slice 1 GREEN (commit 5df2830): safewordIgnoreDirectories(label) + resolvedNamespaceDirectory(ctx) in owned-paths.ts; wired owned-paths generator + Biome/dprint/oxfmt merges (merge+unmerge). Guards projectRoot:'.'. 101 targeted tests pass, lint+typecheck clean. On branch claude/issue-273-projectroot-wiring (kept off the #272 PR #276 branch). NOT pushed yet.
- TODO slice 2: .prettierignore ctx-awareness (textPatch system needs ctx + content factory). Knip ignore (files.ts:86) + eslint also static but near-moot (non-JS/markdown). Full suite + push pending.

---
id: EXP1PE
slug: prettierignore-ctx-rerender
type: task
phase: done
status: done
created: 2026-06-20T22:30:00.000Z
last_modified: 2026-06-21T00:44:00.000Z
---

# ctx-aware + re-rendered .prettierignore for a custom projectRoot (#293)

**Goal:** Make `.prettierignore` exclude a custom `paths.projectRoot` (the last formatter #273 left uncovered).

**Why:** Prettier reads only the root `.prettierignore`/`.gitignore` (verified) and the custom root's markdown is tracked, so the root `.prettierignore` is the only lever. Its text-patch was static/ctx-blind and append-once.

## Approach (figure-it-out → Option A)

- Generalize the text-patch engine: `TextPatchDefinition.content` may be `(ctx) => string`, resolved at plan time (`resolveTextPatch`) so executors still see a string.
- Add opt-in `rerender`: when the marker is present but the resolved block has drifted, replace the managed block in place (`stripRerenderBlock` consumes only safeword's own lines, derived from the fresh content, so customer lines after the block are preserved). No-op when current → default installs never churn.
- `.prettierignore` patch → `content: ctx => …managedPrettierPaths(ctx)`, `rerender: true`. Default/legacy output byte-identical.

## Work Log

- 2026-06-20T22:30Z Revalidated engine (append-once, marker-skip; content string-only; no ctx in executeTextPatch). Verified prettier ignore behavior vs docs.
- 2026-06-20T22:50Z Implemented ctx-factory + rerender; 6 prettier tests (fresh custom, in-place re-render w/ customer-after preserved + one block, default no-churn, projectRoot '.'); typecheck + lint clean; 102 reconcile+schema tests green. Branch claude/issue-293-prettierignore-rerender off main.

---
id: GA7T6M
slug: generated-doc-merge-union
type: task
phase: verify
status: todo
created: 2026-06-30T14:55:00.000Z
last_modified: 2026-06-30T14:55:00.000Z
---

# Auto-resolve merge conflicts on generated docs via `.gitattributes merge=union`

**Goal (GitHub #566):** safeword's committed, deterministically-regenerated
artifacts — the architecture docs (`architecture.generated.md`) and the ticket
index (`tickets/INDEX.md`, `tickets/INDEX-completed.md`) — conflict on the
`fingerprint:` line and reconcile/stale markers every time the default branch is
merged into a branch that touched architecture or tickets. The conflicts add no
value (the files are reproducible from source). Ship a safeword-managed
`.gitattributes` marking these paths `merge=union` so a local `git merge`/`rebase`/
`pull` auto-resolves them; safeword's existing heal + `architecture --check` then
reconcile the union result to the correct content.

**Decision (from `/figure-it-out`, 2026-06-30):** `merge=union` is a built-in git
driver — **attribute-only, no `git config`** — so it deploys via a committed
`.gitattributes` and works on any clone/CI. Rejected: gitignoring the artifacts
(breaks `architecture --check`'s committed baseline and loses human prose in leaf
docs); a custom merge driver (needs per-clone `git config`, fragile in consumer
repos); dropping the fingerprint (doesn't fix body conflicts). GitHub does not
honor `.gitattributes` merge drivers server-side, but the issue's repro is the
**local** merge of the default branch into a feature branch — exactly what union
fixes. `linguist-generated=true` is added as a bonus (collapses diffs, marks the
files generated on GitHub).

## Scope

- A safeword-managed block in `.gitattributes` (append, marker-delimited, ctx-
  resolved namespace root, `rerender` on upgrade) deployed by `safeword setup`,
  mirroring the existing `.prettierignore` managed-block pattern:
  - `**/architecture.generated.md merge=union linguist-generated=true`
  - `<root>/tickets/INDEX.md merge=union linguist-generated=true`
  - `<root>/tickets/INDEX-completed.md merge=union linguist-generated=true`
- Dogfood: add the rendered block to this repo's `.gitattributes`.
- Tests: setup writes/append-merges the block; idempotent on re-run; ctx-resolved
  path for a custom `paths.projectRoot`; the #566 repro now auto-resolves.

## Out of scope

- GitHub server-side PR-merge conflicts (git limitation; not the reported repro).
- Changing whether the docs are committed, or the `--check`/heal pipeline.
- Carving leaf docs out of the glob — accepted trade-off below.

## Accepted trade-off

`**/architecture.generated.md` includes the prose-bearing leaf/single-repo docs,
not just the fully-derived root index. A union that duplicates a leaf section where
two branches edited the **same** human prose resolves last-write-wins (one
paragraph kept; both retained in git history; heal keeps the survivor valid). This
is rare, recoverable, and no worse than a human picking a side in a conflict — so
the simpler one-glob form is preferred over per-package excludes. The frequent,
zero-risk wins (root index + ticket index) are fully covered.

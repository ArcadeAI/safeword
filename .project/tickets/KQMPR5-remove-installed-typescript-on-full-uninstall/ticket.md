---
id: KQMPR5
slug: remove-installed-typescript-on-full-uninstall
type: patch
phase: verify
status: in_progress
parent: 4ZRS4P
external_prs:
  - https://github.com/ArcadeAI/safeword/pull/7662
scope:
  - When install adds the TypeScript toolchain, it records that Safeword owns typescript in .safeword/config.json
  - "`uninstall --full` removes typescript only when that ownership record exists"
  - TypeScript detection counts only the project's own node_modules, never Bun's global install cache
out_of_scope:
  - Ownership records for any other Safeword package (full uninstall keeps its current remove-what-is-listed behavior)
done_when:
  - "`uninstall --full` after an install that added typescript removes it (integration test with real installs)"
  - "`uninstall --full` after an install into a project that already declared typescript keeps it (test)"
  - A second identical install still reports no change
  - Under the Bun runtime, a project with no typescript in its node_modules is detected as lacking typescript (test)
created: 2026-11-17T15:46:13.697Z
last_modified: 2026-11-17T15:46:13.697Z
---

# Remove the TypeScript Safeword installed on full uninstall

**Goal:** safeword uninstall --full removes the typescript that install added, and never a typescript the project already had

**Why:** PR 7662's advisory review found full uninstall keeps the typescript install adds, so --full leaves Safeword tooling behind

## Work Log

<!-- Progress history, not part of the accepted contract: record scope and decisions above. -->

- 2026-11-17T15:46:13.697Z Started: Created ticket KQMPR5
- 2026-11-17T16:59:33.892Z Phase: intake → implement
- 2026-11-17T17:00:25.324Z Phase: implement → verify

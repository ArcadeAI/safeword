---
id: D16BY4
slug: keep-safeword-files-out-of-project-checks
type: patch
phase: done
status: done
parent: 4ZRS4P
external_prs:
  - https://github.com/ArcadeAI/safeword/pull/7662
scope:
  - The cucumber step-file lint override also covers a lane relocated with paths.steps in .safeword/config.json
  - A regression test proves tsc on a fresh install never compiles vendored .safeword files (TypeScript's ** skips dot folders, so the scaffolded tsconfig needs no change)
out_of_scope:
  - Changing the scaffolded tsconfig include or exclude lists
done_when:
  - A step module in a relocated paths.steps folder is allowed its import-time cucumber calls (test with the preset loaded in that project)
  - tsc --listFilesOnly on a fresh Cursor install lists the scaffolded steps and no .safeword file (integration test with real installs)
created: 2026-11-19T08:21:09.046Z
last_modified: 2026-11-19T08:21:09.046Z
---

# Keep Safeword's own files out of the project's type and step checks

**Goal:** tsc never type-checks vendored .safeword files, and relocated BDD step folders get the cucumber step-file lint override

**Why:** Bugbot on PR 7662: the scaffolded tsconfig includes .safeword hook sources, and the cucumber override only matches the default step folders

## Work Log

<!-- Progress history, not part of the accepted contract: record scope and decisions above. -->

- 2026-11-19T08:21:09.046Z Started: Created ticket D16BY4
- 2026-11-19T08:27:20.341Z Phase: intake → implement
- 2026-11-19T08:27:20.414Z Phase: intake → implement
- 2026-11-19T09:40:32.211Z Phase: implement → verify
- 2026-11-19T09:40:32.277Z Phase: implement → verify
- 2026-11-19T15:29:37.780Z Phase: verify → done
- 2026-11-19T15:29:37.857Z Phase: verify → done

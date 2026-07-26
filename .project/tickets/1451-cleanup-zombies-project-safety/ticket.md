---
id: "1451"
slug: cleanup-zombies-project-safety
type: task
phase: done
status: done
created: 2026-07-25
last_modified: 2026-07-26
external_issue: https://github.com/ArcadeAI/safeword/issues/1451
---

# Task: Keep zombie cleanup inside the current project

**Type:** Bug

**Scope:** Restrict processes found through auto-detected dev and test ports to
the current project before previewing or killing them.

**Out of Scope:** Changing framework detection, port conventions, pattern-based
cleanup, or the explicit consent flow.

**Done When:**

- [x] A process from another project is omitted from the cleanup preview when it
      owns this project's auto-detected port.
- [x] A process owned by the current project remains eligible for cleanup by its
      auto-detected port.
- [x] Port ownership checks deny by default when project ownership cannot be
      established.

**Tests:**

- [x] Integration: an unrelated project's process on an auto-detected port is
      excluded from the preview.
- [x] Integration: the current project's process on an auto-detected port is
      included in the preview.
- [x] Integration: kill mode passes a verified current-project port owner, but
      never an unrelated owner, to `kill`.
- [x] Integration: newline-containing paths cannot be truncated into false
      ownership.
- [x] Integration: descendants of the project root remain eligible.
- [x] Integration: kill mode revalidates ownership immediately before signaling.
- [x] Integration: multiple verified PIDs are signaled individually rather than
      after a batched ownership check.

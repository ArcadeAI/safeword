---
id: "1451"
slug: cleanup-zombies-project-safety
type: task
phase: done
status: done
created: 2026-07-25
last_modified: 2026-07-27
external_issue: https://github.com/ArcadeAI/safeword/issues/1451
---

# Task: Keep zombie cleanup inside the current project

**Type:** Bug

**Scope:** Restrict processes found through auto-detected ports or command
patterns to the current project before previewing or killing them. Report
unverified detected-port owners and failed signals accurately. Pattern matches
whose working directory is outside the project remain silently ineligible so
broad built-in patterns do not produce machine-wide skip noise.

**Out of Scope:** Changing framework detection, port conventions, or the
explicit consent flow.

**Done When:**

- [x] A process from another project is omitted from the cleanup preview when it
      owns this project's auto-detected port.
- [x] A process owned by the current project remains eligible for cleanup by its
      auto-detected port.
- [x] Port ownership checks deny by default when project ownership cannot be
      established.
- [x] Pattern ownership uses the same working-directory boundary as port
      ownership.
- [x] The summary distinguishes a clean project from detected-port candidates
      that were skipped or eligible candidates that could not be killed.

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
- [x] Integration: a foreign pattern match is excluded even when its argv names
      the current project.
- [x] Integration: project paths are not interpolated into `pgrep` regular
      expressions.
- [x] Integration: failed signals are not counted as successful kills.

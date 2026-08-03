---
id: F7BH4J
slug: keep-unconfigured-repositories-clean
type: task
phase: verify
status: in_progress
created: 2026-07-27T23:23:33.173Z
last_modified: 2026-07-27T23:55:37Z
---

# Keep unconfigured repositories clean for Codex users

**Goal:** Prevent profile-scoped Codex plugin hooks from creating project state until Safeword setup explicitly enrolls the repository.

**Why:** A globally installed plugin currently creates a partial .project namespace after ordinary tool use, surprising users and dirtying repositories that never opted into Safeword.

## User Story

As a Codex user with the profile-scoped Safeword plugin installed, I want
repositories to remain unchanged until I explicitly run Safeword setup, so
opening or working in an unrelated repository does not silently enroll it.

## Scope

Gate Codex plugin hook state writes on the existing project-enrollment marker,
while preserving packaged skills, session context, and enrolled-project hook
behavior.

## Out of Scope

- Moving enrolled-project transient state out of the resolved namespace root.
- Changing Claude Code or Cursor hook behavior.
- Automatically running `safeword setup` from a plugin hook or skill.
- Changing profile plugin installation or trust behavior.

## Done When

- An ordinary Codex post-tool event leaves an unconfigured committed repository
  byte-for-byte unchanged.
- The same event writes quality state after `safeword setup` has enrolled the
  repository.
- Legacy and custom namespace roots still receive state after enrollment.
- Session-start packaged instructions remain available before enrollment.

## Tests

- Integration: unconfigured committed repository gets no `.project/` after a
  Codex `PostToolUse` Bash event.
- Integration: enrolled default-root repository receives its quality-state
  file.
- Integration: enrolled legacy-root and custom-root repositories receive state
  at their resolved namespace roots.
- Integration: unconfigured SessionStart still returns packaged instructions
  without creating repository files.

## Work Log

- 2026-07-27T23:23:33.173Z Started: Created ticket F7BH4J
- 2026-07-27T23:23:48Z Intake: Defined explicit-enrollment user story,
  boundaries, outcomes, and integration proof before implementation.
- 2026-07-27T23:29:51Z RED: Unconfigured PostToolUse created `.project/`, and
  direct Codex proof caches returned success while creating the same namespace.
- 2026-07-27T23:31:58Z GREEN: Added the shared setup marker predicate, gated
  project-scoped Codex lifecycle handlers, and preserved enrolled default,
  legacy, and custom-root state.
- 2026-07-27T23:36:52Z REFACTOR: Extracted enrolled PreToolUse dispatch,
  documented the architecture decision and user flow, and passed focused hook,
  compatibility, schema, release, typecheck, lint, formatting, and diff-hygiene
  verification.
- 2026-07-27T23:55:37Z Verify: Full suite reached 5,563 passing tests and found
  one legacy Codex bridge fixture missing the enrollment marker. Updated that
  fixture; its full file plus the enrollment suites now pass 66/66. Full run
  otherwise passed 373/374 files with 5 skips.

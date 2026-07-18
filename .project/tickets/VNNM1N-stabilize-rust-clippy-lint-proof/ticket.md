---
id: VNNM1N
slug: stabilize-rust-clippy-lint-proof
type: task
phase: done
status: done
subtype: bug-investigated
created: 2026-07-14T05:12:57.171Z
last_modified: 2026-07-15T02:16:39.000Z
---

# Stabilize Rust lint-hook proof

**Goal:** Make the Rust lint-hook integration test prove package-targeted Clippy execution without relying on version-specific autofix output.

**Why:** Current Clippy versions no longer rewrite the fixture as the test expects.

## Work Log

- 2026-07-14T05:12:57.171Z Started: Created ticket VNNM1N
- 2026-07-14T05:15:00.000-04:00 Root cause: Scenario 10 infers package-targeted Clippy execution from the `single_char_pattern` autofix. Clippy 0.1.89 leaves the fixture unchanged, so the assertion is version-dependent. A fake `cargo` boundary then showed the hook was not invoking Cargo: `realpathSync(file)` yields `/private/var/...` while `CLAUDE_PROJECT_DIR` remains `/var/...`, causing package detection to stop before `Cargo.toml`. Normalize the configured project root and assert `clippy -p core` directly.

## Root Cause

The test asserts a version-specific source rewrite rather than the hook's
observable subprocess contract. Current Clippy does not apply that rewrite.
Separately, the hook compares a physical edited-file path with a logical project
path and therefore skips Cargo on macOS temporary directories.

Ruled out: Clippy absence (`cargo clippy --version` succeeds); a broken fake
Cargo boundary (the invocation log appears once both paths are normalized).

## Work Log

- 2026-07-14T05:25:00.000-04:00 Implemented: normalize the installed lint hook's project root with `realpathSync`, matching normalized edited-file paths. Scenario 10 now replaces a Clippy-version-sensitive source rewrite with an observable fake-Cargo boundary assertion for `clippy -p core --fix --allow-dirty --allow-staged`.
- 2026-07-14T05:26:00.000-04:00 Verify: targeted scenario passes; combined Rust golden-path and cleanup-zombies regression files pass 70/70; lint and TypeScript typecheck pass. Advanced to verify.
- 2026-07-14T05:54:00.000-04:00 Verify: full CLI suite passes (354 files, 5,211 tests; 5 skipped).
- 2026-07-15T02:16:00.000Z Done: closed with FAJV19 in PR #1053 as required supporting cleanup. CI full suite green on node 22.22.3 + node 24 at head 58f80d79; lint and typecheck clean. Scope expansion accepted by project owner 2026-07-14.

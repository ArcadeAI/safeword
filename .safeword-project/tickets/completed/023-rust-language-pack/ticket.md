---
id: 023
type: feature
phase: done
status: complete
created: 2026-01-18T15:14:00Z
last_modified: 2026-01-19T08:30:00Z
---

# Enable Rust developers to use safeword's quality workflow

**Goal:** Add Rust language support so Rust projects get automatic linting and formatting with strict defaults.

**Why:** Rust is a major systems programming language. Supporting it expands safeword's audience and validates the language pack architecture with a third compiled language (after Go).

## Scope

**In scope:**

- Detect Rust projects via `Cargo.toml`
- Generate strict Clippy configuration (`clippy.toml` + `Cargo.toml` lints)
- Generate rustfmt configuration (`rustfmt.toml`)
- Merge `[lints.clippy]` section into Cargo.toml (workspace-aware)
- Wire lint hook to run `cargo clippy -p <pkg> --fix` and `rustfmt <file>`
- Cargo workspace support (`[workspace.lints]` + member inheritance)
- Golden path tests for pure Rust projects
- Workspace tests (multi-crate projects)
- Mixed project tests (TypeScript + Rust)
- Add language upgrade tests

**Out of scope:**

- Architecture/layer enforcement (Rust doesn't have standard import enforcement like depguard)
- Auto-installing tools (Rust tools come with `rustup`)

## Acceptance Criteria

- [x] `safeword setup` creates `.safeword/clippy.toml` and `.safeword/rustfmt.toml`
- [x] `safeword setup` creates project-level `clippy.toml` and `rustfmt.toml` (if none exist)
- [x] `safeword setup` merges `[lints.clippy]` into Cargo.toml (or `[workspace.lints.clippy]` for workspaces)
- [x] Lint hook runs `rustfmt <file>` (file-level formatting)
- [x] Lint hook runs `cargo clippy -p <pkg> --fix` (package-level linting)
- [x] Workspace member crates get `lints.workspace = true` added
- [x] Pure Rust projects work without `package.json`
- [x] Rust workspaces work correctly (virtual and root-package)
- [x] Mixed TypeScript + Rust projects work correctly
- [x] All existing tests pass

## Related Files

- ./spec.md (detailed implementation spec)

## Work Log

**Purpose:** Track what you've tried so you don't repeat dead ends or lose context.

**CRITICAL: Re-read this ticket before each significant action to stay on track.**

---

- 2026-01-19T08:30:00Z Phase 6 Complete: All scenarios implemented
  - Implemented Scenarios 10, 14, 15 (clippy package targeting in lint hook)
  - Added `detectRustPackage()` function to setup.ts (unit tests) and lint hook template (inlined)
  - Lint hook now runs `cargo clippy -p <package> --fix --allow-dirty --allow-staged` when package detected
  - Virtual workspace root files (no [package]) skip clippy, only run rustfmt
  - All 1091 tests pass (2 new E2E tests for package targeting)
  - All 18 scenarios complete, ticket ready for done phase
- 2026-01-19T07:15:00Z Phase 6 Progress: Workspace support complete
  - Implemented Scenarios 2, 3, 6 (workspace setup, virtual workspace, skip explicit lints)
  - Added `parseWorkspaceMembers()` to extract member paths from Cargo.toml
  - Added `addWorkspaceLints()` to inject `[lints]\nworkspace = true` into member crates
  - Member crates with existing `[lints]` sections are preserved (user wins)
  - All 27 Rust E2E tests pass, 75+ integration tests pass
  - Remaining deferred: clippy package targeting in lint hook (Scenarios 10, 14, 15)
- 2026-01-19T06:30:00Z Phase 6 Progress: Core implementation complete
  - Implemented Scenarios 1, 4, 7, 9, 12, 13 (single-crate, preservation, mixed, lint hook, pure rust, detection)
  - Added rustPack to registry with detect/setup functions
  - Updated project-detector.ts with rust detection and existing config detection
  - Updated schema.ts with rustOwnedFiles and rustManagedFiles
  - Updated lint hook for .rs files (rustfmt only - clippy package targeting deferred)
  - Deferred: Workspace scenarios (2, 3, 5, 6) - requires member iteration and lints.workspace = true injection
- 2026-01-19T05:04:00Z Complete: Phase 5 - Decomposed into 10 tasks
- 2026-01-19T04:58:00Z Complete: Phase 4 - All 15 scenarios validated (Atomic, Observable, Deterministic)
- 2026-01-19T03:45:00Z Complete: Phase 3 - 15 scenarios defined in test-definitions.md
- 2026-01-19T03:42:00Z Complete: Phase 0-2 - Context established (goal, scope, discovery in spec)
- 2026-01-19T03:05:00Z Second spec review - completeness fixes
  - Added `detectExistingTooling()` integration (was missing from project-detector section)
  - Added `schema.ts` integration snippet showing import and spread patterns
  - Added unit tests for Cargo.toml merge logic (`mergeCargoLints`, `detectWorkspaceType`, etc.)
  - Verified Cargo.toml lint syntax against official docs (both forms valid)
- 2026-01-19T02:45:00Z Spec critique and fixes
  - Added `CLIPPY_CONF_DIR` env var to lint hook (clippy has no --config flag)
  - Fixed duplicate if/else branches in lint hook code
  - Documented intentional threshold strictness vs Clippy defaults (10 vs 25, 5 vs 7)
  - Clarified owned vs managed file purpose (table explaining hooks vs humans/IDEs)
  - Added full `detectLanguages()` implementation to project-detector section
  - Updated Design Decision 2 with CLIPPY_CONF_DIR research findings
- 2026-01-19T02:35:00Z Quality review: Fixed rustfmt.toml to use stable-only options
  - 5 options were UNSTABLE (fail silently on stable Rust)
  - Known idempotency bug with `imports_granularity` + `group_imports`
  - Major frameworks (Axum, Tokio) use no rustfmt.toml at all
  - Decision: Use stable options only, our value-add is strict clippy
- 2026-01-18T19:25:00Z Discovery review: Added edge cases, merge rules, deferred items
  - Merge precedence: user settings always win
  - Virtual workspace detection: `[workspace]` without `[package]`
  - Member handling: skip if explicit `[lints]` exists
  - Deferred: edition auto-detection, MSRV, clippy deduplication
- 2026-01-18T15:30:00Z Research complete: Resolved all design questions, updated spec
  - **Cargo.toml merge:** REQUIRED - clippy.toml can only set thresholds, not lint levels
  - **Hook behavior:** Hybrid approach - package-level clippy + file-level rustfmt
  - **Workspaces:** Include from start (user decision)
- 2026-01-18T15:25:00Z Research: Clippy has NO file-level targeting, must use `-p <pkg>` for workspaces
- 2026-01-18T15:20:00Z Research: `[lints.clippy]` in Cargo.toml vs `clippy.toml` serve different purposes
- 2026-01-18T15:14:00Z Started: Created ticket and spec based on LANGUAGE_PACK_SPEC.md and GOLANG_PACK_SPEC.md

---

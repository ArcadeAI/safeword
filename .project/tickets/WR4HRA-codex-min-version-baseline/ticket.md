---
id: WR4HRA
slug: codex-min-version-baseline
type: task
phase: done
status: done
epic: codex-changelog-alignment
relates_to: QM5G9M
---

# Pin minimum codex CLI version that supports required hooks

**Goal:** Record the minimum `codex` CLI version safeword requires, and warn below it at setup.

**Findings (researched 2026-05-31, github.com/openai/codex/releases):**

- Latest stable **0.135.0 (May 28 2026)**; latest overall 0.136.0-alpha.x (May 31).
- **0.133.0 (May 21 2026)** is the earliest release whose notes explicitly reference the hook surface safeword leans on — "Support compact SessionStart hooks", "Wire MITM hooks into runtime enforcement", plus the lifecycle-observation enrichment (subagent start/stop, tool execution, turn metadata).
- Basic `PreToolUse` may predate 0.133.0; the releases page only enumerated back to ~0.133. **Open:** scan 0.125–0.132 notes to find the true floor for `PreToolUse` deny + `UserPromptSubmit` block (the events the gates actually need).

**Revalidated findings (2026-06-13):**

- Latest stable is **0.139.0 (2026-06-09)**; latest prerelease observed is **0.140.0-alpha.18 (2026-06-13)**.
- Older release notes show hook-related work before 0.133.0, including plugin hooks/trust and `PreToolUse` adjacent changes, but the release notes below 0.133.0 do not clearly prove the full set safeword needs (`PreToolUse` deny + `UserPromptSubmit` block + runtime enforcement + current trust behavior).
- The `rust-v0.132.0` release notes only surface a generic async extension lifecycle-hooks entry for this search, while `rust-v0.133.0` includes "Wire MITM hooks into runtime enforcement" and the lifecycle events safeword depends on. That keeps `0.133.0` as the confirmed safe floor.
- Current docs include features that require newer releases for other managed config surfaces (`allowed_permission_profiles` requires 0.138.0+), but that does not appear required for the core safeword hook baseline.

## Decision

`codex-version` baseline = **0.133.0**.

Setup warns, but does not block, when an installed `codex --version` is below `0.133.0`. Missing or unparsable Codex stays silent because safeword installs multi-agent assets and should not nag non-Codex users.

When the upstream monitor snapshot store from `99XBFG` exists, fold this baseline into its `codex-version` snapshot.

## Done when

- [x] Floor confirmed against `rust-v0.132.0` and `rust-v0.133.0` release notes.
- [x] `codex-version` baseline recorded as `0.133.0`.
- [x] Setup warns below `0.133.0`.

## Source

github.com/openai/codex/releases (+ releases.atom feed and release API)

## Feature File Coverage

Source feature: `packages/cli/features/codex-min-version-baseline.feature`.

The feature covers setup's user-visible warning when the installed Codex CLI is below the `0.133.0` hook baseline.

## Revalidation + /figure-it-out (2026-06-13)

**Frame:** Decide whether to lower, keep, or raise safeword's minimum Codex CLI version.

**Research domains checked:** Official Codex changelog, `openai/codex` release notes, hook runtime enforcement history, managed config version notes, and setup-warning ergonomics.

**Options:**

1. Lower below 0.133.0 based on older hook-related release-note mentions.
2. Keep 0.133.0 as the minimum and recommend latest stable.
3. Raise to 0.139.0 to match current stable.

**Recommend:** Keep option 2. `0.133.0` remains the earliest release with clear runtime-enforcement and lifecycle-extension evidence, while forcing `0.139.0` would unnecessarily exclude users until the spike proves a concrete need. Setup warns below `0.133.0` and recommends upgrading before trusting safeword's Codex gates.

## Work Log

- 2026-05-31 Created (changelog gap noted).
- 2026-05-31 Read releases page. Provisional floor 0.133.0; basic-hooks floor still to confirm in 0.125–0.132.
- 2026-06-13T14:37:31Z Revalidated and ran /figure-it-out. Current stable is 0.139.0; prerelease 0.140.0-alpha.17 exists. Keep provisional floor at 0.133.0; older release notes mention hooks but do not prove the complete gate surface.
- 2026-06-14T00:00:00Z Implemented: added `packages/cli/features/codex-min-version-baseline.feature`, setup warning for installed Codex versions below `0.133.0`, and focused Vitest/Cucumber coverage. Phase -> implement pending final verify.
- 2026-06-14T00:04:25Z Complete: focused Vitest, Codex Cucumber smoke, Gherkin lint, targeted ESLint, typecheck, and targeted format checks passed. Added `verify.md`. Phase -> done.

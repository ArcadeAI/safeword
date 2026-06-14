---
id: WR4HRA
slug: codex-min-version-baseline
type: task
phase: intake
status: in_progress
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

- Latest stable is **0.139.0 (2026-06-09)**; latest prerelease observed is **0.140.0-alpha.17 (2026-06-13)**.
- Older release notes show hook-related work before 0.133.0, including plugin hooks/trust and `PreToolUse` adjacent changes, but the release notes below 0.133.0 do not clearly prove the full set safeword needs (`PreToolUse` deny + `UserPromptSubmit` block + runtime enforcement + current trust behavior).
- Current docs include features that require newer releases for other managed config surfaces (`allowed_permission_profiles` requires 0.138.0+), but that does not appear required for the core safeword hook baseline.

## Decision (provisional)

Floor = **0.133.0** until proven a lower version has the needed events. Conservative but safe.

## Done when

- Floor confirmed (scan older release notes for `PreToolUse`/`UserPromptSubmit`); recorded as a `codex-version` baseline (folds into monitor snapshot, ticket 99XBFG); setup warns below it.

## Source

github.com/openai/codex/releases (+ releases.atom feed)

## Revalidation + /figure-it-out (2026-06-13)

**Frame:** Decide whether to lower, keep, or raise safeword's minimum Codex CLI version.

**Research domains checked:** Official Codex changelog, `openai/codex` release notes, hook runtime enforcement history, managed config version notes, and setup-warning ergonomics.

**Options:**

1. Lower below 0.133.0 based on older hook-related release-note mentions.
2. Keep 0.133.0 as the minimum and recommend latest stable.
3. Raise to 0.139.0 to match current stable.

**Recommend:** Keep option 2. `0.133.0` remains the earliest release with clear runtime-enforcement and lifecycle-extension evidence, while forcing `0.139.0` would unnecessarily exclude users until the spike proves a concrete need. Setup should warn below `0.133.0` and recommend upgrading to the latest stable (`0.139.0` as of 2026-06-13).

**Next:** After `N12G95`, run the same hook fixture against `0.132.0` and `0.133.0`; only lower the floor if the real gate works on `0.132.0`.

## Work Log

- 2026-05-31 Created (changelog gap noted).
- 2026-05-31 Read releases page. Provisional floor 0.133.0; basic-hooks floor still to confirm in 0.125–0.132.
- 2026-06-13T14:37:31Z Revalidated and ran /figure-it-out. Current stable is 0.139.0; prerelease 0.140.0-alpha.17 exists. Keep provisional floor at 0.133.0; older release notes mention hooks but do not prove the complete gate surface.

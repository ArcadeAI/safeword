---
id: NP0D72
slug: patch-transitive-nanoid-advisory
type: patch
phase: intake
status: in_progress
created: 2026-08-13T18:13:52.875Z
last_modified: 2026-08-13T18:20:00.000Z
external_issue: https://github.com/ArcadeAI/safeword/issues/2808
---

# Keep Safeword's repository dependency tree free of the Nano ID vulnerability

**Goal:** Resolve GHSA-2v37-7h3g-55p8 in Safeword's development dependency tree without broad dependency churn.

**Why:** The canonical dependency audit fails because nanoid 3.3.17 is vulnerable and 3.3.18 is the first patched 3.x release.

## Work Log

- 2026-08-13T18:13:52.875Z Started: Created ticket NP0D72
- 2026-08-13T18:20:00.000Z Found: Full verification on PR #2779 passed tests, Gherkin, builds, and typechecks, then failed the dependency lane because GHSA-2v37-7h3g-55p8 was updated to require nanoid 3.3.18 for the 3.x line. GitHub issue #2808 was filed before this local ticket was adopted as the work anchor.
- 2026-08-13T18:25:00.000Z Implemented: Raised the existing root nanoid override from 3.3.17 to the first patched 3.x release, regenerated bun.lock, and added a standalone high-severity CI dependency-audit job with RED/GREEN workflow-contract and resolution-tripwire tests. The audit is also a production deployment dependency, so a failed audit cannot be bypassed by the relay deploy job.
- 2026-08-13T18:45:00.000Z Reviewed: The final quality pass strengthened the proof to cover every Nano ID resolution, the exact non-optional audit command, and the production deployment dependency. The independent audit lane skips lifecycle scripts, while the environment-protected manual relay workflow remains the documented break-glass path. The exact global 3.x override is intentional while the sole consumer requires `^3.3.16`; if a future consumer requires another major, replace it with a scoped override rather than forcing that consumer onto 3.x.
- 2026-08-13T18:55:00.000Z Clarified: Nano ID is not a runtime dependency of the published CLI and `tsup` does not bundle node modules, so this advisory affected the repository's development/build dependency tree rather than downstream CLI installations. Updated the issue and ticket scope accordingly. The audit contract now also rejects job-level bypasses, CI defaults to read-only contents permissions, and relay change detection uses `bash` pipefail semantics with a bounded timeout.
- 2026-08-13T19:05:00.000Z Hardened: Removed the redundant dependency installation from the audit lane because `bun audit` consumes the committed lockfile directly. Automatic relay delivery now waits for the CLI contract as well as every existing required gate, and relay input detection captures `git diff` before scanning so pipefail cannot turn an early match into a SIGPIPE failure.
- 2026-08-13T19:10:00.000Z Guarded: The workflow contract now rejects a conditional audit step, and the lockfile tripwire proves every package declaring Nano ID still requests the compatible 3.x line. A future consumer requesting another major will therefore fail loudly instead of being silently forced down to the global 3.x override.

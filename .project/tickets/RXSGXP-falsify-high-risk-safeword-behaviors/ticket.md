---
id: RXSGXP
slug: falsify-high-risk-safeword-behaviors
type: task
phase: intake
status: in_progress
parent: AK0QJR
depends_on: [BX1T7H]
relates_to: [BFCWDB, ZA0JQR, 1698]
external_issue: https://github.com/ArcadeAI/safeword/issues/2340
created: 2026-08-10T07:58:18.073Z
last_modified: 2026-08-10T08:00:27Z
---

# Prove high-risk acceptance tests detect real regressions

**Goal:** Maintain curated defects for migration, deletion, concurrency, release, and host-boundary behavior that the mapped acceptance scenarios must detect.

**Why:** Targeted, understandable falsification gives strong evidence on Safe Word's riskiest surfaces without the ambiguity and runtime of universal mutation generation.

## Scope

- Curate one understandable defect at a time against the acceptance scenario that must catch it.
- Prioritize removal of obsolete pre-plugin files, automatic install for the next developer, packed-string marketplace sources, prerelease tags, concurrent lost updates, project/app-level installation, and simulated-versus-live host behavior.
- Record the defect, expected scenario failure, actual failure, runtime, and cleanup result.
- Keep defects deterministic, reviewable, and isolated from production code after the trial.

## Out of Scope

- Random or exhaustive mutation generation.
- Replacing ordinary acceptance and integration tests.
- Claiming a simulated host trial proves live-host behavior.

## Done When

- Each prioritized boundary has at least one mapped defect or a recorded reason it cannot yet be falsified.
- The mapped acceptance scenario fails before the defect is removed and passes afterward.
- Trials leave the worktree clean and cannot leak mutated artifacts into a release.
- Results distinguish simulated, local-live, and external-host evidence.

## Work Log

- 2026-08-10T07:58:18.073Z Started: Created ticket RXSGXP
- 2026-08-10T08:00:27Z Planned: Targeted the session's highest-risk migration, host, release, and concurrency boundaries.

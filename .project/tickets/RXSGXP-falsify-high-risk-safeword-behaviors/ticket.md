---
id: RXSGXP
slug: falsify-high-risk-safeword-behaviors
type: task
phase: intake
status: in_progress
parent: AK0QJR
depends_on: [BX1T7H, SH5GSP]
relates_to: [BFCWDB, ZA0JQR, 1698, SH5GSP]
external_issue: https://github.com/ArcadeAI/safeword/issues/2340
created: 2026-08-10T07:58:18.073Z
last_modified: 2026-08-10T11:46:37Z
---

# Prove high-risk acceptance tests detect real regressions

**Goal:** Maintain curated defects for migration, deletion, concurrency, release, and host-boundary behavior that the mapped acceptance scenarios must detect.

**Why:** Targeted, understandable falsification gives strong evidence on Safe Word's riskiest surfaces without the ambiguity and runtime of universal mutation generation.

## Scope

- Curate one understandable defect at a time against the acceptance scenario that must catch it.
- Prioritize removal of obsolete pre-plugin files, automatic install for the next developer, packed-string marketplace sources, prerelease tags, concurrent lost updates, project/app-level installation, and simulated-versus-live host behavior.
- Preserve the product-inspiration regressions as explicit defect cases: unrelated or decoy evidence satisfying decision/reference linkage; Bash mutations bypassing protections enforced for structured Edit/Write operations; and shell source/destination ambiguity across `cp -t`, target-directory syntax, and compound commands.
- Preserve the #2328 / 0.74.7 regressions as explicit defect cases: reviewer argv duplication/reordering/alternate-model injection; fresh `dist/cli.js` with missing, stale, or wrong-HEAD chunks; contaminated `HOME`, `CLAUDE_CONFIG_DIR`, `PATH`, or unrelated installed agents; success-looking content inside a typed failure envelope; Claude root-directory versus root-symlink versus nested `.in_use`; direct CLI spawning outside the approved fixture runner; and Claude-only setup widened to an unscoped cross-agent install.
- Record the defect, expected scenario failure, actual failure, runtime, and cleanup result.
- Keep defects deterministic, reviewable, and isolated from production code after the trial.

## Out of Scope

- Random or exhaustive mutation generation.
- Replacing ordinary acceptance and integration tests.
- Claiming a simulated host trial proves live-host behavior.

## Done When

- Each prioritized boundary has at least one mapped defect or a recorded reason it cannot yet be falsified.
- Decision/reference linkage rejects unrelated, duplicate, ambiguous, and decoy evidence instead of accepting mere record presence.
- Protected invariants hold across structured Edit/Write and equivalent supported Bash mutation paths.
- Shell falsification distinguishes source from destination for `cp -t`, target-directory syntax, and compound commands without false-positive protection failures.
- Reviewer collaborators accept only the exact documented ordered argv vector, including command position, prompt cardinality, and model selection.
- Build evidence covers every dynamic chunk reachable from the CLI entrypoint and matches embedded sources to the current source tree, not only the `dist/cli.js` mtime.
- Host scenarios remain deterministic under seeded user state and unrelated installed-agent contamination.
- Success content cannot satisfy a scenario until exit status, `ok`, state, and errors prove the full typed success tuple.
- Claude lease metadata distinguishes an allowed root `.in_use/<pid>` directory from rejected root symlinks and untrusted nested `.in_use` content.
- Direct process spawning and unscoped cross-agent setup fail at the fixture/scope boundary rather than depending on the runner's installed state.
- The mapped acceptance scenario fails before the defect is removed and passes afterward.
- Trials leave the worktree clean and cannot leak mutated artifacts into a release.
- Results distinguish simulated, local-live, and external-host evidence.

## Work Log

- 2026-08-10T07:58:18.073Z Started: Created ticket RXSGXP
- 2026-08-10T08:00:27Z Planned: Targeted the session's highest-risk migration, host, release, and concurrency boundaries.
- 2026-08-10T09:40:00Z Refined: Promoted the #2334 product-inspiration comment into explicit falsification scope and completion criteria for decision/reference linkage, mutation-mechanism parity, and shell source/destination semantics.
- 2026-08-10T11:46:37Z Refined: Added all seven #2328 / 0.74.7 curated defects, their required evidence record, and the SH5GSP detector dependency for fixture-runner bypass falsification.

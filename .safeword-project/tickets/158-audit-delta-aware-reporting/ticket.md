---
id: 158
type: task
phase: intake
status: in_progress
created: 2026-05-18T05:41:00Z
last_modified: 2026-05-18T05:41:00Z
scope: |
  Add delta-aware reporting to /audit so pre-existing rot doesn't drown out
  newly-introduced rot. Approach: record a baseline of audit findings to
  `.safeword/.audit-baseline.json` (or `.safeword-project/.audit-baseline.json`
  — decide during implementation). Subsequent /audit runs report deltas:
  NEW warnings (added since baseline), RESOLVED warnings (fixed since baseline),
  and PRE-EXISTING warnings (collapsed/summarized).
  Behavior must be opt-in or have a sane default that doesn't hide cumulative
  debt entirely — possibly: full report by default, `--since-baseline` flag for
  delta-only view, automatic baseline refresh on major version bumps.
out_of_scope: |
  - Storing audit history beyond current/baseline (no log)
  - Cross-project shared baseline
  - Automated "stale baseline" warnings beyond a simple age hint
done_when: |
  - Baseline file format documented in schema/comments
  - /audit reports deltas when baseline exists
  - Baseline refresh mechanism documented (manual or auto-on-major)
  - On a clean project, baseline + run reports no deltas
  - On a project with new warnings, those new warnings are surfaced first
---

# /audit: delta-aware reporting (new vs pre-existing)

**Goal:** Filter audit noise so the user sees what _this PR_ introduced, not 84 pre-existing clones every run.

**Why:** /audit's current output mixes new issues with longstanding ones. 84 jscpd clones every run is signal the first time, noise the 50th time. A baseline-relative view prioritizes actionable findings without removing visibility into cumulative debt.

## Work Log

- 2026-05-18T05:41:00Z Started: ticket created from 152 audit-skill improvement debate

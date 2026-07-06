---
id: PNZM3B
slug: retro-process-surface
type: feature
phase: intake
status: in_progress
scope:
  - resolveSurface accepts a virtual `process/<slug>` namespace — strict slug validation (lowercase alphanumerics + hyphens, bounded length), additive to the existing path allowlist
  - prepareEncounters reports drop counts per egress wall (off-schema vs unresolvable surface); the retro summary line shows them only when non-zero
  - extraction prompt + Codex schema description offer `process/<area>` for friction with no single-file surface
  - process-surfaced drafts carry a `process` label at draft time
out_of_scope:
  - loosening the file-path allowlist or any sanitization pass
  - any new free-text field in the finding schema
  - reconciling process surfaces (G19QG7 skips them by rule)
  - retroactively re-filing findings dropped by past sessions
done_when:
  - a finding surfaced as a valid process/<slug> files end to end; anything outside the slug shape is still dropped
  - a run that dropped findings says how many at which wall; a clean run's summary is unchanged
  - egress tests prove no string outside the path allowlist or slug namespace reaches an issue body via the surface field
created: 2026-07-05T23:05:32.494Z
last_modified: 2026-07-05T23:05:32.494Z
---

# Retro accepts process-level friction surfaces and reports egress drops

**Goal:** Let retro file process-level friction under a leak-proof `process/<slug>` surface and report every egress drop, so silence means clean instead of secretly lossy.

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.

## Work Log

- 2026-07-05T23:05:32.494Z Started: Created ticket PNZM3B
- 2026-07-06T00:56:00Z JTBD + Rules gates confirmed by user (process label: yes); engineering scope drafted, pending scope gate

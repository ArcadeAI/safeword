---
id: C4N0P8
slug: tune-agent-config-audit-signal
type: task
phase: intake
status: in_progress
created: 2026-06-15T13:52:20.293Z
last_modified: 2026-06-15T13:52:44Z
---

# Tune agent config audit signal

**Goal:** Make agent-config audit warnings reflect actionable config risks instead of broad structural/staleness noise.

**Why:** The current audit flags many generated or intentionally compact Cursor/Claude files for missing WHAT/WHY/HOW sections and age, which makes real dead references harder to notice.

**Scope:** Decide which agent-config files should be exempt, refreshed, or checked differently; keep dead-reference detection strict.

**Out of Scope:** Rewriting all agent instructions for style alone.

**Done When:**

- [ ] Agent-config audit distinguishes generated/templated mirrors from hand-authored project policy.
- [ ] Staleness warnings have a meaningful threshold or exemption for stable generated files.
- [ ] Dead-reference errors remain visible and fail loudly.

## Work Log

- 2026-06-15T13:52:20.293Z Started: Created ticket C4N0P8
- 2026-06-15T13:52:44Z Intake: Audit found 19 config files without explicit WHAT/WHY/HOW structure and 6 stale-by-git-age files, including generated Cursor rules and template AGENTS content.

---
id: E32M4P
slug: phase-work-log-stamp
type: feature
phase: implement
phase_anchors:
  - define-behavior: d605a63
  - scenario-gate: d605a63
  - implement: 4124ab2
status: in_progress
external_issue: https://github.com/ArcadeAI/safeword/issues/772
scope:
  - lib work-log stamp helpers (pure transition detection from Edit payloads + append)
  - post-tool-work-log.ts PostToolUse observer on EDIT_TOOLS, ticket.md only
  - Claude settings PostToolUse wiring + schema/parity registration
  - bdd DISCOVERY/SCENARIOS/TDD/VERIFY work-log template steps trimmed to pointers
out_of_scope:
  - Codex/Cursor adapter forwarding (follow-up ticket; those surfaces keep manual entries)
  - stamping full-file Write rewrites (no prior content at PostToolUse; documented limit)
  - rewriting or validating agent-authored narrative entries
  - phase_anchors / provenance changes (PreToolUse side untouched)
done_when:
  - an Edit that changes ticket.md phase lands exactly one real-timestamp Phase line in the work log
  - non-transition edits and non-ticket files get no stamp; frontmatter/body preserved
  - bdd phase files carry no fabricated-timestamp transition template
created: 2026-07-06T01:53:02.408Z
last_modified: 2026-07-06T01:53:02.408Z
---

# Auto-stamp ticket work-log entries on phase transitions

**Goal:** A PostToolUse hook appends a real-timestamp work-log line to ticket.md whenever a phase transition lands, replacing the fabricated {timestamp} template entries the bdd skill files prescribe

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.

## Work Log

- 2026-07-06T01:53:02.408Z Started: Created ticket E32M4P

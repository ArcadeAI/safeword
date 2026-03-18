---
id: 035
type: task
phase: intake
status: pending
parent: 031
created: 2026-03-18T15:28:00Z
last_modified: 2026-03-18T15:28:00Z
---

# Deduplicate overlapping content across SAFEWORD.md, AGENTS.md, and CLAUDE.md

**Goal:** Eliminate content duplication between the three context files to reduce token waste and prevent drift.

**Why:** SAFEWORD.md, AGENTS.md, and CLAUDE.md have overlapping sections: commit frequency, TodoWrite rules, learnings location, and code philosophy all appear in multiple places. This wastes context tokens and creates drift risk when one is updated but not the other. SAFEWORD.md should be the single source; AGENTS.md should contain only the cross-agent pointer.

## Acceptance Criteria

- [ ] AGENTS.md contains only cross-agent content (no duplication with SAFEWORD.md)
- [ ] CLAUDE.md is a thin pointer to SAFEWORD.md
- [ ] No behavioral change — all rules still apply
- [ ] Templates updated, dogfooded install updated

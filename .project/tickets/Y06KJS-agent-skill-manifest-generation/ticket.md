---
id: Y06KJS
slug: agent-skill-manifest-generation
type: task
phase: intake
status: in_progress
parent: S3T6JA
epic: agent-surface-refactor
depends_on:
  - 2YZDKQ
scope:
  - Create one neutral skill manifest that expands to Claude and Codex schema-owned skill entries.
  - Preserve installed `.claude/skills/*` and `.agents/skills/*` output paths.
  - Include explicit per-surface include/skip rationale for any skill that does not ship everywhere.
  - Add or update tests that prove generated entries match the existing template coverage.
out_of_scope:
  - Generating Cursor commands or rules; child F1HTQ4 owns wrapper generation.
  - Removing dogfood-installed skill files.
done_when:
  - Adding or removing a shared skill requires one manifest change, not separate Claude and Codex schema edits.
  - Existing setup/upgrade output remains equivalent.
  - The manifest handles `versioning` according to the 2YZDKQ ownership decision.
created: 2026-06-14T01:39:19.374Z
last_modified: 2026-06-14T02:05:00Z
---

# Reduce duplicated skill registration for maintainers

**Goal:** Make Claude and Codex skill registration derive from one shared manifest.

**Why:** `packages/cli/src/schema.ts` already generates Codex skill entries from `CODEX_SKILL_TEMPLATE_FILES`, while Claude skill entries are still hand-listed. That split makes parity updates easy to miss.

## Figure-it-out pass

**Frame:** Decide whether duplicated Claude/Codex skill schema entries should be hand-maintained, generated from the existing Codex list, or generated from a new shared manifest.

**Research domains:** Claude skill discovery and command creation; Codex skill/package discovery; safeword schema ownership; dogfood install parity.

**Options considered:** Keep both lists manual; use the current Codex list as the source; create a neutral manifest that expands to Claude and Codex targets.

**Recommend:** Create a neutral manifest because both platforms consume directory-backed skill files, but neither platform should be the conceptual owner of the other. The existing Codex generated map proves the expansion approach works.

**Next:** Implement manifest expansion in `packages/cli/src/schema.ts` and add schema/template parity tests.

## Notes

- Current evidence: Claude Code docs say project skills live under `.claude/skills/<skill-name>/SKILL.md`; Codex docs describe skills as a reusable customization layer alongside AGENTS/config/hooks.
- Keep dogfooding explicit: tracked `.claude/skills` and `.agents/skills` files remain install output, even if their schema registration is generated.
- Quality-review guardrail: do not start implementation until 2YZDKQ records whether `versioning` is dogfood-only, shipped, or stale.

## Work Log

- 2026-06-14T02:05:00Z Reviewed: Added dependency on 2YZDKQ and per-surface include/skip rationale requirement.
- 2026-06-14T01:46:00Z Scoped: Figure-it-out selected neutral manifest generation.
- 2026-06-14T01:39:19.374Z Started: Created ticket Y06KJS.

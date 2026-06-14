---
id: 2YZDKQ
slug: versioning-skill-surface-decision
type: task
phase: intake
status: in_progress
parent: S3T6JA
epic: agent-surface-refactor
scope:
  - Determine whether `.claude/skills/versioning/SKILL.md` is intentional dogfood-only content, missing template content, or stale.
  - Record the ownership decision before broader skill manifest generation.
  - If the skill should be shipped, create or update follow-up implementation scope.
out_of_scope:
  - Automatically promoting the skill to Codex or Cursor without an ownership decision.
  - Refactoring unrelated skills.
done_when:
  - The ticket records one clear decision: Claude-only, ship across surfaces, or remove as stale.
  - The decision includes the evidence used: skill content, current version workflow, and parity expectation.
  - Y06KJS can proceed without accidentally changing versioning skill behavior.
created: 2026-06-14T01:39:41.655Z
last_modified: 2026-06-14T02:05:00Z
---

# Clarify versioning skill ownership

**Goal:** Decide what owns the dogfood-only `versioning` skill before manifest generation treats it as drift.

**Why:** The read-only pass found `.claude/skills/versioning/SKILL.md` with no matching `packages/cli/templates/skills/versioning` or `.agents/skills/versioning` file. That may be intentional, but the rationale is not visible.

## Figure-it-out pass

**Frame:** Decide whether `.claude/skills/versioning` is intentional Claude-only content, missing from templates, or obsolete.

**Research domains:** Claude skill discovery; Codex/Cursor parity promises; safeword version workflow; dogfood-only config policy.

**Options considered:** Record Claude-only rationale; promote to templates and Codex/Cursor surfaces; remove as stale dogfood.

**Recommend:** Decide before refactoring. Changing this file as part of shared manifest work would silently make a product-surface decision.

**Next:** Read the versioning skill, compare it to released safeword version workflow, and record the ownership call.

## Notes

- If Claude-only, document that in the epic or a nearby parity rationale so future drift checks do not flag it as missing.
- If shipped, child Y06KJS should include it in the shared skill manifest after this ticket closes.
- Quality-review guardrail: this is a decision ticket, not an implementation ticket, unless the decision is explicitly to remove stale dogfood content.

## Work Log

- 2026-06-14T02:05:00Z Reviewed: Added evidence requirement for the ownership decision.
- 2026-06-14T01:46:00Z Scoped: Figure-it-out selected decision-first handling.
- 2026-06-14T01:39:41.655Z Started: Created ticket 2YZDKQ.

---
id: 0W7VM2
slug: remove-dead-dogfood-hook-for-maintainers
type: patch
phase: intake
status: in_progress
created: 2026-06-14T11:51:36.330Z
last_modified: 2026-06-14T12:00:00.000Z
scope:
  - Delete `.project/hooks/post-tool-guide-check.ts` if a fresh reference search still shows it is unwired.
  - Verify no schema, hook config, template, or dogfood settings file references the hook.
  - Re-run dependency-cruiser or the focused audit command enough to confirm the orphan warning is gone.
out_of_scope:
  - Adding a replacement guide-compliance hook.
  - Changing shipped customer hooks under `.safeword/hooks/` or `packages/cli/templates/hooks/`.
  - Cleaning unrelated depcruise orphan warnings such as Cucumber runner entrypoints.
done_when:
  - `.project/hooks/post-tool-guide-check.ts` is gone.
  - `rg "post-tool-guide-check|Guide compliance check"` returns no live references.
  - `bunx depcruise --output-type err --config .dependency-cruiser.cjs .` no longer reports this file as an orphan.
---

# Remove dead dogfood hook for maintainers

**Goal:** Remove an unwired safeword-repo-only hook so architecture audit output stops reporting a real dead file.

**Why:** Unlike the Cucumber runner warnings, this file has no discovered entrypoint and no references in current hook configs or schema. Keeping it makes audit output less trustworthy.

## Work Log

- 2026-06-14T11:51:36.330Z Started: Created ticket 0W7VM2
- 2026-06-14T12:00:00.000Z Intake: Force-ranked as P2 because it is a real dead-file finding with tiny blast radius. Keep the fix narrow: delete the dogfood-only orphan, do not redesign guide enforcement.
- 2026-06-14T11:59:14Z Revalidated: `post-tool-guide-check.ts` was introduced in commit `4be85cff` as a distributed `.safeword/hooks/` PostToolUse reminder for edits under `packages/cli/templates/`, then moved in `ea019c0b` to `.safeword-project/hooks/` with the explicit rationale "safeword-specific, not distributed" and removed from schema/config.
- 2026-06-14T11:59:14Z Found: Current `.claude/settings.json`, `.cursor/hooks.json`, schema, templates, and Codex config do not reference the hook. `depcruise --output-type err --config .dependency-cruiser.cjs .` reports `.project/hooks/post-tool-guide-check.ts` as an orphan warning.
- 2026-06-14T11:59:14Z Figure-it-out: Prefer deletion over rewiring. The original purpose is now covered by explicit guide-routing in `AGENTS.md` and `.safeword/SAFEWORD.md`, plus project authoring guides; if we later want hard enforcement, build a new hook from current Claude hook output semantics instead of reviving this stale reminder script.
- 2026-06-14T12:08:24Z Implemented: Deleted `.project/hooks/post-tool-guide-check.ts`.
- 2026-06-14T12:08:24Z Verified: `rg "post-tool-guide-check|Guide compliance check"` returns no references. `depcruise --output-type err --config .dependency-cruiser.cjs .` no longer reports this file; only the two pre-existing cucumber entrypoint orphan warnings remain.

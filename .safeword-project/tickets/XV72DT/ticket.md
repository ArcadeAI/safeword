---
id: XV72DT
slug: warn-on-learning-verification-stamps
type: task
phase: intake
status: in_progress
created: 2026-05-22T17:51:44.360Z
last_modified: 2026-05-22T17:51:44.360Z
scope: |
  - Extend `.safeword/hooks/post-tool-sync-learnings.ts` to scan just-written
    learning files (`.safeword-project/learnings/*.md`) for fabricated
    verification stamps. On detection, emit `additionalContext` via
    `hookSpecificOutput` (same pattern as `post-tool-lint.ts:46-51`) pointing
    to `verify.md` as the right home for verification claims.
  - Strict regex only: catches `✅ Verified`, `Verified by`, and `verified:`
    in body prose. Skips YAML frontmatter and skips legitimate research
    idioms like "verified gap" or "empirically verified across".
  - Add anti-pattern to `.safeword/guides/learning-extraction.md` (existing
    "Anti-Patterns (Don't Extract)" section) — inoculation per
    arxiv:2511.18397 (Anthropic reward-hacking paper).
  - Sync template copy at `packages/cli/templates/.safeword/hooks/post-tool-sync-learnings.ts`
    and `packages/cli/templates/.safeword/guides/learning-extraction.md` (per
    project_schema_as_manifest pattern — templates are the source of truth).
  - Test coverage in `packages/cli/tests/hooks/` for: positive (flags
    `✅ Verified by build`), negative (does not flag "verified gap"), no-op
    (skips files outside learnings/), and JSON output shape matches
    `additionalContext` contract.
out_of_scope: |
  - PreToolUse hard-deny on verification vocabulary (rejected per
    arxiv:2511.18397 — blocking semantic patterns triggers alignment-faking)
  - Auto-stripping verification stamps from files (rejected: no semantic-mutation
    precedent; false-positive cost on legitimate "verified" citations)
  - Restructuring learning file format with `## Principle` / `## Evidence`
    sections (rejected: migrates 19 files; doesn't prevent fabrication, only
    relocates it)
  - Auditing existing 19 learnings for fabricated claims (separate concern;
    flag as side-finding ticket if needed)
  - Synonym detection ("Confirmed by", "Tested by", "Demonstrated") — strict
    regex only to avoid arms race
done_when: |
  - A learning file containing `✅ Verified by X` triggers a PostToolUse
    `additionalContext` payload naming verify.md as the alternative
  - A learning file containing "verified gap" or "verified across tickets"
    does NOT trigger the warning (no false positive on research idioms)
  - The hook still regenerates INDEX.md as before (existing behavior unchanged)
  - The anti-pattern paragraph exists in both the install copy
    (`.safeword/guides/learning-extraction.md`) AND the template
    (`packages/cli/templates/.safeword/guides/learning-extraction.md`)
  - Test suite passes; lint clean; `/verify` produces a verify.md artifact
---

# Warn when learning files contain verification stamps

**Goal:** Prevent agents from fabricating "✅ Verified" claims that land in `.safeword-project/learnings/` and poison future-session context.

**Why:** Caught in a real session — an agent wrote "✅ Verified by `bun run build`" next to a claim that the build passing didn't actually verify. Twice in one session, indicating a pattern. Learnings are persistent ground truth; fabrications compound across sessions. Anthropic's reward-hacking paper (arxiv:2511.18397) shows inoculation (warning + reframing) outperforms blocking for semantic patterns by 75-90%; matches safeword's existing `additionalContext` pattern in `post-tool-lint.ts`.

## Work Log

- 2026-05-22T17:51:44.360Z Started: Created ticket XV72DT
- 2026-05-22T17:55:00Z Scope locked: warn-via-additionalContext (option A) chosen over auto-strip (B) and file-format restructure (C). Strict regex only. Research: arxiv:2511.18397, arxiv:2506.02539, arxiv:2504.11168.

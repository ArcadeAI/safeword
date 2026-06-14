---
id: W0E292
slug: codex-hook-adapter-helpers
type: task
phase: intake
status: in_progress
parent: S3T6JA
epic: agent-surface-refactor
scope:
  - Extract pure helper functions for Codex hook input translation and denial normalization.
  - Keep `packages/cli/templates/hooks/codex/pre-tool-quality.ts` as the executable adapter entrypoint.
  - Add unit coverage for helper behavior without spawning the full hook process.
out_of_scope:
  - Building a generic cross-agent hook adapter framework.
  - Changing Codex hook behavior or deny-mode semantics.
done_when:
  - Existing Codex pre-tool smoke/integration tests still pass.
  - Pure tests cover apply_patch target extraction, direct-tool forwarding, and denial reason parsing.
  - Schema registration covers any new deployed helper file.
created: 2026-06-14T01:39:34.081Z
last_modified: 2026-06-14T02:05:00Z
---

# Make Codex hook adapter behavior easier to test

**Goal:** Extract pure Codex hook adapter logic without changing the deployed adapter behavior.

**Why:** The current executable script mixes stdin parsing, Codex-to-Claude translation, subprocess execution, denial output, and exit handling. Translation and denial parsing are refactorable units with clear tests.

## Figure-it-out pass

**Frame:** Decide whether the Codex adapter should stay as one executable file, extract pure helpers, or become a generic adapter framework.

**Research domains:** Codex hook payloads and exit behavior; existing Claude hook contract; unit-test granularity; template deployment risk.

**Options considered:** Keep one file; extract pure translation/denial helpers; build a generic cross-agent hook adapter framework.

**Recommend:** Extract pure helpers only. Translation and denial parsing are stable enough to test directly; a generic framework would add abstraction before there is a second adapter with the same shape.

**Next:** Move pure functions to a registered helper module and keep the executable wrapper thin.

## Notes

- Preserve `SAFEWORD_CODEX_DENY_MODE=exit-code` behavior exactly.
- If helper imports complicate template deployment, prefer same-directory Codex helper files registered in schema over package-level imports.
- Quality-review guardrail: verify the adapter still runs from installed templates, not just from source tests.

## Work Log

- 2026-06-14T02:05:00Z Reviewed: Added schema-registration and installed-template execution guardrails.
- 2026-06-14T01:46:00Z Scoped: Figure-it-out selected pure helper extraction, not a generic adapter framework.
- 2026-06-14T01:39:34.081Z Started: Created ticket W0E292.

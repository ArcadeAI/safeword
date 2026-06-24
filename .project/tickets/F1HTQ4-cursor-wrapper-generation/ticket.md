---
id: F1HTQ4
slug: cursor-wrapper-generation
type: task
phase: intake
status: in_progress
parent: S3T6JA
epic: agent-surface-refactor
relates_to: VAX3Z2
depends_on:
  - 1833FW
  - Y06KJS
scope:
  - Generate or drift-check `.cursor/commands/*.md` and `.cursor/rules/*.mdc` from shared skill metadata.
  - Preserve the physical Cursor command and rule files.
  - Confirm why Cursor wrapper files remain the install target despite Cursor's current skills/plugin surfaces.
  - Keep wrapper output equivalent unless a child ticket explicitly changes behavior.
out_of_scope:
  - Replacing Cursor commands/rules with a different Cursor surface.
  - Changing skill content itself.
done_when:
  - Cursor wrappers can be refreshed from metadata without hand-editing every file.
  - Tests or snapshots catch wrapper drift.
created: 2026-06-14T01:39:22.192Z
last_modified: 2026-06-14T02:05:00Z
---

# Keep Cursor wrappers aligned from shared metadata

**Goal:** Prevent Cursor command and rule wrappers from drifting away from the skills they point to.

**Why:** The wrappers mostly contain repeated pointers such as `Read and follow the instructions in .claude/skills/...` or `@.claude/skills/...`; manual maintenance is low-signal and drift-prone.

## Figure-it-out pass

**Frame:** Decide whether Cursor wrapper files should stay manual, be generated, or be replaced by direct skills/rules.

**Research domains:** Cursor rules and skills; command file compatibility; safeword install/reconcile behavior; wrapper drift testing.

**Options considered:** Keep manual wrappers; generate wrappers from metadata; delete wrappers and rely on shared skills.

**Recommend:** Generate wrappers from metadata while preserving physical files. Cursor still documents distinct rule and skills surfaces, and safeword already installs wrapper files. Generation reduces maintenance without relying on a new runtime assumption.

**Next:** Add wrapper metadata and a generation/drift test for `.cursor/commands` and `.cursor/rules`.

## Notes

- Child 1833FW should resolve the current `verify` wrapper drift first or at the same time.
- Generation should preserve descriptions/frontmatter, not just the final pointer line.
- Quality-review guardrail: if current Cursor skills/plugins make a wrapper obsolete, record that as a separate product decision rather than folding it into this refactor.

## Work Log

- 2026-06-14T02:05:00Z Reviewed: Added dependencies on 1833FW/Y06KJS and a Cursor-native-surface rationale requirement.
- 2026-06-14T01:46:00Z Scoped: Figure-it-out selected generated wrappers with physical files retained.
- 2026-06-14T01:39:22.192Z Started: Created ticket F1HTQ4.

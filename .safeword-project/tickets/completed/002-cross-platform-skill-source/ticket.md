---
id: 002
type: feature
phase: intake
status: cancelled
created: 2026-01-05T00:44:00Z
last_modified: 2026-01-05T00:44:00Z
github_title: 'Single source of truth for cross-platform skills (Claude + Cursor)'
---

# Single Source of Truth for Cross-Platform Skills

**Goal:** Eliminate manual duplication between Claude skills and Cursor rules.

**Why:** Drift between platforms causes inconsistency; manual sync is error-prone.

## Problem

Claude skills (`.claude/skills/*/SKILL.md`) and Cursor rules (`.cursor/rules/*.mdc`) contain identical body content but different frontmatter formats. Currently maintained via manual duplication, which leads to drift.

**Example:** When updating the BDD skill for Iteration 2, the Cursor rule was initially missed, causing inconsistency.

## Research Findings

### Format Differences

| Platform | Frontmatter Fields                              | File Location                    |
| -------- | ----------------------------------------------- | -------------------------------- |
| Claude   | `name`, `description`, `allowed-tools`, `model` | `.claude/skills/{name}/SKILL.md` |
| Cursor   | `description`, `alwaysApply`, `globs`           | `.cursor/rules/{name}.mdc`       |

### Cursor Format Status

Cursor's format is in flux:

- Docs say use `RULE.md` in folders, but this **doesn't work** ([forum bug report](https://forum.cursor.com/t/project-rules-documented-rule-md-folder-format-not-working-only-undocumented-mdc-format-works/145907))
- Only `.mdc` flat files work (despite being labeled "legacy")
- No timeline for stabilization

## Options Considered

### Option A: Generator Script (Recommended)

Claude SKILL.md as canonical source → script generates Cursor .mdc files.

- **Pros:** Single source of truth, automated parity
- **Cons:** Build step, generated files in git

### Option B: Shared Body + Platform Headers

Separate `content.md` + platform-specific frontmatter files.

- **Pros:** Maximum sharing
- **Cons:** Complex structure, more files

### Option C: Status Quo + Linting

Keep manual duplication, add CI check for body content drift.

- **Pros:** No architectural change
- **Cons:** Still manual sync

### Option D: Wait for Cursor Stability

Delay until Cursor's RULE.md format works.

- **Pros:** Avoid building against shifting target
- **Cons:** No timeline, drift continues

## Recommendation

**Option A** with simple transformation:

1. Read `skills/*/SKILL.md`
2. Strip `name` and `allowed-tools` from frontmatter
3. Add `alwaysApply: false`
4. Write to `cursor/rules/*.mdc`
5. Add header comment: `<!-- AUTO-GENERATED - DO NOT EDIT -->`

Run as pre-publish step or integrate into `sync-config`.

## References

- [Cursor Rules Docs](https://cursor.com/docs/context/rules)
- [Cursor Forum: RULE.md Bug](https://forum.cursor.com/t/project-rules-documented-rule-md-folder-format-not-working-only-undocumented-mdc-format-works/145907)
- [Cursor Forum: Optimal MDC Structure](https://forum.cursor.com/t/optimal-structure-for-mdc-rules-files/52260)

## Work Log

---

- 2026-01-05T00:44:00Z Created: Issue from research on cross-platform skill architecture

---

---
id: 018b
type: feature
phase: intake
status: ready
parent: 018
created: 2026-01-10T20:42:00Z
last_modified: 2026-03-08T05:37:00Z
---

# Skill Sync from Single Source

**User Story:** When I update a Safeword skill, I want to edit one file and have both Claude Code and Cursor get the updated content.

**Goal:** Single source of truth for skill content, with the build/reconcile process generating IDE-specific formats.

**Parent:** [018 - IDE Parity](../018-ide-parity/ticket.md)

## The Problem

Every skill exists in **three places** with no automated sync:

```
packages/cli/templates/skills/{name}/     # Claude template (source of truth)
packages/cli/templates/cursor/rules/*.mdc # Cursor template (separate source!)
.claude/skills/{name}/                    # Deployed copy (matches Claude template)
.cursor/rules/*.mdc                       # Deployed copy (matches Cursor template)
```

Templates → deployed copies are identical (verified). But **Claude templates and Cursor templates have drifted** because they're maintained independently.

### Current Drift (March 2026)

| Skill             | Claude Lines | Cursor Lines | Drift               | Nature                                                                |
| ----------------- | ------------ | ------------ | ------------------- | --------------------------------------------------------------------- |
| BDD core          | 107          | 52           | **High**            | Claude has extra detail (phase update guidance, resume flow)          |
| BDD sub-files (6) | 331          | 289          | **Medium**          | Claude files are content-only; Cursor embeds headers (self-contained) |
| Debugging         | 222          | 209          | **Low**             | Formatting only (`####` vs `**bold**` headers)                        |
| Refactoring       | 232          | 175          | **High**            | Claude has code examples + edge cases + audit reference               |
| Quality Review    | 75           | 157          | **High (reversed)** | Cursor has MORE content (8-step protocol, phase table)                |
| Core              | N/A          | 5            | N/A                 | Cursor-only (delegates to SAFEWORD.md via `alwaysApply: true`)        |

### Structural Differences

**Claude Code skills** (multi-file directories):

```
.claude/skills/bdd/
├── SKILL.md          # Orchestrator (frontmatter: name, description, allowed-tools)
├── DISCOVERY.md      # Phase 0-2 (referenced by hooks at runtime)
├── SCENARIOS.md      # Phase 3-4
├── TDD.md            # Phase 6
├── DECOMPOSITION.md  # Phase 5
├── DONE.md           # Phase 7
└── SPLITTING.md      # Split protocol
```

**Cursor rules** (flat .mdc files):

```
.cursor/rules/
├── bdd-core.mdc           # Orchestrator (frontmatter: description, alwaysApply)
├── bdd-discovery.mdc      # Phase 0-2 (self-contained, selected by description match)
├── bdd-scenarios.mdc      # Phase 3-4
├── bdd-tdd.mdc            # Phase 6
├── bdd-decomposition.mdc  # Phase 5
├── bdd-done.mdc           # Phase 7
└── bdd-splitting.mdc      # Split protocol
```

### Frontmatter Differences

| Field                      | Claude Code | Cursor       | Notes                            |
| -------------------------- | ----------- | ------------ | -------------------------------- |
| `name`                     | Yes         | No           | Claude uses for `/slash-command` |
| `description`              | Yes         | Yes          | Both use for auto-activation     |
| `allowed-tools`            | Yes         | No           | Claude-specific permission       |
| `alwaysApply`              | No          | Yes          | Cursor-specific activation       |
| `globs`                    | No          | Yes (unused) | Cursor file-pattern activation   |
| `disable-model-invocation` | Yes         | No           | Claude-specific                  |
| `user-invocable`           | Yes         | No           | Claude-specific                  |

## Revised Solution

### Why the Original Approach Won't Work

The original ticket proposed `.safeword/skills/*.md` as flat source files with a sync script. Problems:

1. **BDD is multi-file** — 7 Claude files, 7 Cursor files. Can't flatten to one source.
2. **Content differs substantively** — Quality review has MORE in Cursor. Can't just strip frontmatter.
3. **Phase table references differ** — Claude references `DISCOVERY.md` (file), Cursor references `bdd-discovery.mdc` (rule name).
4. **Templates already exist** — `packages/cli/templates/` is the real source of truth, deployed via `schema.ts` + `reconcile.ts`. A third source location adds confusion.

### New Approach: Unified Templates

**Single template tree** in `packages/cli/templates/skills/`, with the build/reconcile process generating Cursor `.mdc` files from Claude skill sources.

```
packages/cli/templates/skills/
├── bdd/
│   ├── SKILL.md          # Source (unified frontmatter)
│   ├── DISCOVERY.md
│   ├── SCENARIOS.md
│   ├── TDD.md
│   ├── DECOMPOSITION.md
│   ├── DONE.md
│   └── SPLITTING.md
├── debug/
│   └── SKILL.md
├── quality-review/
│   └── SKILL.md
└── refactor/
    └── SKILL.md
```

**Eliminate** `packages/cli/templates/cursor/rules/` entirely. Instead, `reconcile.ts` generates `.mdc` from skills:

```typescript
// For each skill:
// 1. Read SKILL.md → extract frontmatter + content
// 2. Write .claude/skills/{name}/SKILL.md (pass through)
// 3. Write .cursor/rules/{name}.mdc (transform frontmatter, adjust content)

// For BDD multi-file:
// 1. Write .claude/skills/bdd/*.md (pass through all files)
// 2. For each sub-file, write .cursor/rules/bdd-{phase}.mdc
//    (add Cursor frontmatter, make self-contained with headers)
```

### Unified Frontmatter

Skills use combined frontmatter. Each IDE takes what it needs:

```yaml
---
name: debug
description: Four-phase debugging framework...
allowed-tools: '*'
alwaysApply: false
---
```

### Content Reconciliation

Before implementing sync, reconcile drift — pick best version per skill:

| Skill          | Canonical Source | Action                                                                                       |
| -------------- | ---------------- | -------------------------------------------------------------------------------------------- |
| BDD core       | Claude           | Cursor is a strict subset. Use Claude version.                                               |
| BDD sub-files  | Claude           | Add phase headers for Cursor output.                                                         |
| Debugging      | Claude           | Merge (formatting diffs only).                                                               |
| Refactoring    | Claude           | Has code examples Cursor lacks. Use Claude.                                                  |
| Quality Review | **Merge both**   | Claude is lean (75L), Cursor is detailed (157L). Merge Cursor's 8-step protocol into Claude. |
| Core           | Skip             | Cursor-only (`alwaysApply: true` → SAFEWORD.md). Claude uses CLAUDE.md chain. Keep separate. |

## Implementation

### Mechanism: `generator` pattern in reconcile.ts

reconcile.ts already supports three content sources in `FileDefinition`:

| Source      | Purpose                | Examples                             |
| ----------- | ---------------------- | ------------------------------------ |
| `template`  | Pure file copy         | Skills, hooks, most files            |
| `content`   | Static string/factory  | Simple configs                       |
| `generator` | Dynamic, context-aware | .prettierrc, eslint.config.mjs, knip |

The `generator` pattern is the right fit. Each Cursor rule becomes a generator entry in schema.ts:

```typescript
{
  path: '.cursor/rules/debug.mdc',
  generator: (ctx) => generateCursorRule('debug', ctx),
}
```

A shared `generateCursorRule()` helper (~30-40 lines) handles the transform:

1. Read the Claude skill template content (already bundled in package)
2. Parse frontmatter, extract `description`
3. Strip Claude-specific fields (`name`, `allowed-tools`, `user-invocable`, `disable-model-invocation`)
4. Add Cursor-specific fields (`alwaysApply`, optionally `globs`)
5. For BDD sub-files, add self-contained phase headers
6. Return formatted `.mdc` content

**Why not a build-time pre-publish script?** That would still produce two copies in the repo (source + generated), creating the same drift risk this ticket solves. A CI check to prevent drift is more infrastructure than a single generator function.

### Steps

1. **Reconcile content** — Merge quality-review skill (take Cursor's 8-step protocol into Claude source)
2. **Add unified frontmatter** — Add `alwaysApply: false` to all Claude skill templates
3. **Create `generateCursorRule()` helper** — Frontmatter transform + optional header insertion
4. **Update schema.ts** — Replace `{ template: 'cursor/rules/*.mdc' }` with `{ generator: generateCursorRule(...) }`
5. **Delete `templates/cursor/rules/`** — No longer needed
6. **Verify** — Run setup, check both IDE outputs match expected
7. **Unit test** — Test `generateCursorRule()` with mock context, verify .mdc output format

## Acceptance Criteria

- [ ] `packages/cli/templates/skills/` is the single source for all skills
- [ ] `packages/cli/templates/cursor/rules/` is deleted
- [ ] `reconcile.ts` generates `.cursor/rules/*.mdc` from skill templates
- [ ] Claude skills work unchanged (pass-through)
- [ ] Cursor rules work unchanged (generated with correct frontmatter)
- [ ] Adding a new skill = 1 source file → both IDE formats generated
- [ ] Quality review content is reconciled (Cursor's 8-step protocol merged)

## Out of Scope

- `safeword-core.mdc` — stays separate (Cursor-only, `alwaysApply: true`)
- Command sync (018c covers this)
- Hook sync (018a covers this)

## Work Log

---

- 2026-03-08T07:16:00Z Research: Confirmed generator pattern in reconcile.ts as implementation mechanism. Updated ticket with detailed approach, helper function spec, and rationale against build-time alternative.
- 2026-03-08T05:37:00Z Research: Full audit of current state. 3 template copies, drift analysis, IDE docs review. Revised approach from sync script to reconcile.ts integration. Reset to intake phase.
- 2026-01-11T01:30:00Z Refactored: Removed vagueness, explicit core skip, tightened criteria
- 2026-01-11T01:28:00Z Clarified: quality-reviewing has bidirectional drift, core uses different mechanism
- 2026-01-10T21:13:00Z Added: Content drift analysis - quality-reviewing and refactoring have high drift
- 2026-01-10T20:42:00Z Created: Skill sync from single source

---

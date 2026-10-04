# Schema Registration Guide

**Every file in `packages/cli/templates/` MUST have a corresponding entry in `packages/cli/src/schema.ts`.**

Without registration, templates are orphaned—they exist but are never installed.

---

## Why This Matters

The schema (`SAFEWORD_SCHEMA`, typed by `SafewordSchema`) is the **single source of truth** for what safeword installs, upgrades, and removes. Its sections:

| Section                                                     | What it controls                                                                                           |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `ownedDirs` / `sharedDirs` / `preservedDirs`                | Directories safeword fully owns, adds to without owning, or creates but never deletes (user/runtime data)  |
| `ownedFiles`                                                | Files safeword overwrites on upgrade (`template`, `content`, or `generator`)                               |
| `managedFiles`                                              | Files created if missing and updated only while they still hold safeword content (e.g. `principles.md`)    |
| `jsonMerges`                                                | Keys merged into user JSON (e.g. `hooks` in `.claude/settings.json`, `.cursor/hooks.json`)                 |
| `textPatches` / `legacyTextPatches`                         | Marker-delimited blocks appended/prepended to user files (e.g. `.gitignore`, husky hooks), or cleanup-only |
| `contracts`                                                 | Files that must contain specific strings (predicate parity, checked by `parity-check.ts`)                  |
| `deprecatedFiles` / `deprecatedDirs` / `deprecatedPackages` | What upgrade deletes or uninstalls                                                                         |
| `codexMigration`                                            | Historical Codex identities retained until explicit finalization                                           |
| `packages`                                                  | npm packages installed (base + conditional)                                                                |

If a template isn't in schema.ts, it doesn't exist to the installer.

---

## Template → Schema Mapping

| Template Location                                            | How it's registered                                                                                                                                                 | Install Location                                                    |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `skills/{name}/SKILL.md` (+ sibling `.md` files)             | `ownedFiles` entry, plus `CURSOR_SHARED_SKILL_FILES` in schema.ts for the Cursor copy                                                                               | `.claude/skills/{name}/…` and `.safeword/skills/{name}/…`           |
| `cursor/rules/{name}.mdc`                                    | **Generated** from `CURSOR_RULE_WRAPPERS` in `src/cursor-wrappers.ts`; registered automatically                                                                     | `.cursor/rules/{name}.mdc`                                          |
| `commands/{name}.md`                                         | Mostly **generated** from `CURSOR_COMMAND_WRAPPERS` (auto-registered); a few hand-authored ones (`explain`, `verify`, `lint`, …) have explicit `ownedFiles` entries | `.cursor/commands/{name}.md` (Cursor only)                          |
| `guides/{name}.md`                                           | `ownedFiles`                                                                                                                                                        | `.safeword/guides/{name}.md`                                        |
| `doc-templates/{name}.md`                                    | `ownedFiles`                                                                                                                                                        | `.safeword/templates/{name}.md`                                     |
| `spec-template.md`, `child-spec-template.md`                 | `ownedFiles`                                                                                                                                                        | `.safeword/templates/{name}.md`                                     |
| `principles-`/`personas-`/`glossary-`/`surfaces-template.md` | `managedFiles` (project-owned once edited)                                                                                                                          | `<namespace-root>/{name}.md`                                        |
| `hooks/{name}.ts`, `hooks/lib/`, `hooks/cursor/`             | `ownedFiles`                                                                                                                                                        | `.safeword/hooks/…`                                                 |
| `hooks/codex/{name}.ts`                                      | Bundled into the Codex plugin runtime (no project install)                                                                                                          | Codex plugin cache                                                  |
| `agents/{name}.md`                                           | `ownedFiles`                                                                                                                                                        | `.claude/agents/` and `.cursor/agents/`                             |
| `scripts/{name}`, `prompts/{name}.md`, `statusline/`         | `ownedFiles`                                                                                                                                                        | `.safeword/scripts/`, `.safeword/prompts/`, `.safeword/statusline/` |

Claude gets no `.claude/commands/` — skills create their own slash commands, and the old `.claude/commands/*.md` paths now live in `deprecatedFiles`.

---

## Adding New Files

### 1. Skills (Claude + Cursor + Codex parity)

```typescript
// In ownedFiles:
'.claude/skills/{name}/SKILL.md': { template: 'skills/{name}/SKILL.md' },

// In CURSOR_SHARED_SKILL_FILES (Cursor reads skills from .safeword/skills/):
'{name}/SKILL.md',
```

Then expose it to Cursor through `src/cursor-wrappers.ts`: a `CURSOR_RULE_WRAPPERS` entry (model-invocable skill) or a `CURSOR_COMMAND_WRAPPERS` entry (action skill), plus its `SKILL_CURSOR_PAIRS` entry. Run `bun run generate:cursor-wrappers` from `packages/cli` — never hand-write the `.mdc` or command wrapper. The Claude and Codex plugins pick the skill up from `templates/skills/` when regenerated (see Generated Surfaces). See `.project/learnings/adding-a-skill-checklist.md`.

### 2. Guides

```typescript
// In ownedFiles:
'.safeword/guides/{name}.md': { template: 'guides/{name}.md' },
```

### 3. Document templates

```typescript
// In ownedFiles:
'.safeword/templates/{name}.md': { template: 'doc-templates/{name}.md' },
```

### 4. Hooks

```typescript
// In ownedFiles:
'.safeword/hooks/{name}.ts': { template: 'hooks/{name}.ts' },
```

Wiring the hook to an event is separate — see the [Hooks Authoring Guide](./hooks-authoring-guide.md).

### 5. Scripts

```typescript
// In ownedFiles:
'.safeword/scripts/{name}.sh': { template: 'scripts/{name}.sh' },
```

---

## Generated Surfaces

A template edit invalidates four generated surfaces: the Cursor wrappers, the Claude historical catalogue, the Claude plugin (`plugin/`), and the Codex plugin (`packages/cli/codex-plugin/`). Regenerate them all in the safe order with:

```bash
bun packages/cli/scripts/check-generated-surfaces.ts --fix # or: bun run fix:generated-surfaces (from packages/cli)
bun packages/cli/scripts/check-generated-surfaces.ts       # verify (pre-commit runs this)
```

Then sync the dogfood copy (`bun run safeword install` from the repo root) and confirm template ↔ dogfood parity with `bun scripts/parity-check.ts`.

---

## Renaming/Removing Files

When renaming or removing templates:

1. Add old path to `deprecatedFiles`:

```typescript
deprecatedFiles: [
  // Renamed from X to Y (vX.X.X)
  '.claude/skills/old-name/SKILL.md',
  '.cursor/rules/safeword-old-name.mdc',
],
```

2. Add old directory to `deprecatedDirs` (if applicable):

```typescript
deprecatedDirs: [
  '.claude/skills/old-name', // Renamed to new-name (vX.X.X)
],
```

3. Add new path to `ownedFiles` (if renamed, not removed), and update any wrapper entries in `src/cursor-wrappers.ts`.

---

## Verification

Run from `packages/cli` (Vitest takes a positional path; `--testPathPattern` is a Jest flag):

```bash
bun run test tests/schema.test.ts # template ↔ schema + Claude/Cursor/Codex parity
bun run test tests/schema.test.ts -t "should have entry for every template"
```

`tests/schema.test.ts` **fails** if any template file lacks a schema entry, a schema entry has no template, or Claude/Cursor/Codex surfaces drift. Parity also only surfaces in cross-cutting suites — run the full `bun run test` before calling a new skill done.

---

## Checklist

Before committing new template files:

- [ ] Template file created in `packages/cli/templates/`
- [ ] Schema entry added to `packages/cli/src/schema.ts`
- [ ] For skills: `CURSOR_SHARED_SKILL_FILES` + Cursor wrapper + `SKILL_CURSOR_PAIRS` entry, then `bun run generate:cursor-wrappers`
- [ ] Generated surfaces current: `bun packages/cli/scripts/check-generated-surfaces.ts`
- [ ] Dogfood copy synced and `bun scripts/parity-check.ts` passes
- [ ] Schema tests pass: `bun run test tests/schema.test.ts`

---

## Common Mistakes

| Mistake                               | Symptom                               | Fix                                                           |
| ------------------------------------- | ------------------------------------- | ------------------------------------------------------------- |
| Template without schema entry         | File not installed                    | Add to `ownedFiles`                                           |
| Hand-edited `.mdc` or command wrapper | Overwritten / drift failure           | Edit `src/cursor-wrappers.ts`, run `generate:cursor-wrappers` |
| Skill without Cursor wrapper          | Parity test fails                     | Add a rule or command wrapper + `SKILL_CURSOR_PAIRS` entry    |
| Plugins not regenerated               | Long, unrelated-looking test failures | `check-generated-surfaces.ts --fix`                           |
| Renamed file without deprecation      | Old file persists after upgrade       | Add to `deprecatedFiles`                                      |
| Renamed directory without cleanup     | Old directory persists                | Add to `deprecatedDirs`                                       |

---

## Related

- `packages/cli/src/schema.ts` - The source of truth
- `packages/cli/src/cursor-wrappers.ts` - Cursor rule/command wrapper metadata
- `packages/cli/tests/schema.test.ts` - Validation tests
- `packages/cli/scripts/check-generated-surfaces.ts` - Generated-surface gate

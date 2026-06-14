# Schema Registration Guide

**Every file in `packages/cli/templates/` MUST have a corresponding entry in `packages/cli/src/schema.ts`.**

Without registration, templates are orphaned—they exist but are never installed.

---

## Why This Matters

The schema is the **single source of truth** for what safeword installs. The CLI reads schema.ts to determine:

- What files to create/update (`ownedFiles`)
- What files to manage (`managedFiles`)
- What files to deprecate (`deprecatedFiles`, `deprecatedDirs`)
- What packages to install (`packages`)

If a template isn't in schema.ts, it doesn't exist to the installer.

---

## Template → Schema Mapping

| Template Location                  | Schema Section | Install Location                                              |
| ---------------------------------- | -------------- | ------------------------------------------------------------- |
| `skills/safeword-{name}/SKILL.md`  | `ownedFiles`   | `.claude/skills/safeword-{name}/SKILL.md`                     |
| `cursor/rules/safeword-{name}.mdc` | `ownedFiles`   | `.cursor/rules/safeword-{name}.mdc`                           |
| `commands/{name}.md`               | `ownedFiles`   | `.claude/commands/{name}.md` AND `.cursor/commands/{name}.md` |
| `guides/{name}.md`                 | `ownedFiles`   | `.safeword/guides/{name}.md`                                  |
| `templates/{name}.md`              | `ownedFiles`   | `.safeword/templates/{name}.md`                               |
| `hooks/{name}.ts`                  | `ownedFiles`   | `.safeword/hooks/{name}.ts`                                   |
| `hooks/lib/{name}.ts`              | `ownedFiles`   | `.safeword/hooks/lib/{name}.ts`                               |
| `hooks/cursor/{name}.ts`           | `ownedFiles`   | `.safeword/hooks/cursor/{name}.ts`                            |
| `scripts/{name}.sh`                | `ownedFiles`   | `.safeword/scripts/{name}.sh`                                 |
| `prompts/{name}.md`                | `ownedFiles`   | `.safeword/prompts/{name}.md`                                 |

---

## Adding New Files

### 1. Skills (Claude + Cursor parity required)

```typescript
// In ownedFiles:
'.claude/skills/safeword-{name}/SKILL.md': {
  template: 'skills/safeword-{name}/SKILL.md',
},
'.cursor/rules/safeword-{name}.mdc': {
  template: 'cursor/rules/safeword-{name}.mdc',
},
```

### 2. Commands (Claude + Cursor parity required)

```typescript
// In ownedFiles:
'.claude/commands/{name}.md': { template: 'commands/{name}.md' },
'.cursor/commands/{name}.md': { template: 'commands/{name}.md' },
```

### 3. Guides

```typescript
// In ownedFiles:
'.safeword/guides/{name}.md': { template: 'guides/{name}.md' },
```

### 4. Hooks

```typescript
// In ownedFiles:
'.safeword/hooks/{name}.ts': { template: 'hooks/{name}.ts' },
```

### 5. Scripts

```typescript
// In ownedFiles:
'.safeword/scripts/{name}.sh': { template: 'scripts/{name}.sh' },
```

---

## Renaming/Removing Files

When renaming or removing templates:

1. Add old path to `deprecatedFiles`:

```typescript
deprecatedFiles: [
  // Renamed from X to Y (vX.X.X)
  '.claude/skills/safeword-old-name/SKILL.md',
  '.cursor/rules/safeword-old-name.mdc',
],
```

2. Add old directory to `deprecatedDirs` (if applicable):

```typescript
deprecatedDirs: [
  '.claude/skills/safeword-old-name', // Renamed to safeword-new-name (vX.X.X)
],
```

3. Add new path to `ownedFiles` (if renamed, not removed)

---

## Verification

### Run schema tests:

```bash
cd packages/cli && bun run test -- --testNamePattern="should have entry for every template"
```

This test **fails** if any template file lacks a schema entry.

### Run parity tests:

```bash
cd packages/cli && bun run test -- --testNamePattern="parity"
```

This test **fails** if Claude and Cursor skills/commands don't match.

### Run all schema tests:

```bash
cd packages/cli && bun run test -- --testPathPattern="schema.test.ts"
```

---

## Checklist

Before committing new template files:

- [ ] Template file created in `packages/cli/templates/`
- [ ] Schema entry added to `packages/cli/src/schema.ts`
- [ ] For skills: Both Claude skill AND Cursor rule created
- [ ] For commands: Both `.claude/commands/` AND `.cursor/commands/` entries added
- [ ] Schema tests pass: `bun run test -- --testNamePattern="should have entry"`
- [ ] Parity tests pass: `bun run test -- --testNamePattern="parity"`

---

## Common Mistakes

| Mistake                           | Symptom                         | Fix                         |
| --------------------------------- | ------------------------------- | --------------------------- |
| Template without schema entry     | File not installed              | Add to `ownedFiles`         |
| Claude skill without Cursor rule  | Parity test fails               | Create matching `.mdc` file |
| Renamed file without deprecation  | Old file persists after upgrade | Add to `deprecatedFiles`    |
| Renamed directory without cleanup | Old directory persists          | Add to `deprecatedDirs`     |

---

## Related

- `packages/cli/src/schema.ts` - The source of truth
- `packages/cli/tests/schema.test.ts` - Validation tests
- `README.md` section "CLI Parity (Claude Code / Cursor)"

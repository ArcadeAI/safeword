---
id: 016b
type: task
phase: implement
status: cancelled
parent: '016'
created: 2026-01-10T18:40:00Z
last_modified: 2026-01-11T03:35:00Z
---

# Format and lint on save for customer projects

**Goal:** Add `.vscode/settings.json` to customer projects via `safeword setup`.

**Why:** Customers should get format-on-save and lint-on-save automatically, matching their detected stack.

**Scope:** Customer projects only. Monorepo is separate ticket (015).

## Implementation Plan

### 1. Add to schema.ts

Add `.vscode/settings.json` as a managed file:

```typescript
// In managedFiles section
'.vscode/settings.json': {
  generator: (ctx) => generateVscodeSettings(ctx),
  condition: () => true, // Always create
},
```

### 2. Create generator function

In `packages/cli/src/templates/vscode.ts`:

```typescript
export function generateVscodeSettings(ctx: ProjectContext): string {
  const settings: Record<string, unknown> = {
    'editor.formatOnSave': true,
    'editor.codeActionsOnSave': {
      'source.fixAll.eslint': 'explicit', // "explicit" = only on manual save (Ctrl+S), not auto-save
      'source.organizeImports': 'explicit',
    },
  };

  // TypeScript/JavaScript - ESLint already covered above

  // Python - add Ruff formatter
  if (ctx.languages?.python) {
    settings['[python]'] = {
      'editor.defaultFormatter': 'charliermarsh.ruff',
      'editor.codeActionsOnSave': {
        'source.fixAll.ruff': 'explicit',
        'source.organizeImports.ruff': 'explicit',
      },
    };
  }

  // Go - add Go formatter and linter
  if (ctx.languages?.golang) {
    settings['[go]'] = {
      'editor.defaultFormatter': 'golang.go',
    };
    settings['go.lintTool'] = 'golangci-lint';
    settings['go.lintOnSave'] = 'workspace';
  }

  return JSON.stringify(settings, null, 2) + '\n';
}
```

### 3. Handle existing formatter

If `ctx.projectType.existingFormatter` is set (Biome, dprint), skip setting `editor.defaultFormatter` for JS/TS files.

## Acceptance Criteria

- [ ] `.vscode/settings.json` added to schema.ts managedFiles
- [ ] Generator function created in templates/vscode.ts
- [ ] TypeScript projects get ESLint fix on save
- [ ] Python projects get Ruff formatter settings
- [ ] Go projects get golangci-lint settings
- [ ] Respects existing formatter (Biome, dprint)
- [ ] Tests added for generator function

## Work Log

---

- 2026-01-11T03:35:00Z Updated: Changed codeActionsOnSave to use "explicit" (VSCode v1.41+ best practice), added source.organizeImports
- 2026-01-10T19:51:00Z Renumbered: 016a → 016b (execution priority - after monorepo validation)
- 2026-01-10T18:40:00Z Created: Split from ticket 015 as customer-facing scope

---

---
id: 015
type: task
phase: done
status: done
parent: '016'
created: 2026-01-10T16:08:00Z
last_modified: 2026-01-11T05:47:00Z
---

# Format and lint on save for safeword contributors

**Goal:** Add `.vscode/settings.json` to the safeword monorepo for developer experience.

**Why:** Safeword developers editing the monorepo should get format-on-save and ESLint auto-fix without manual IDE configuration.

**Scope:** Monorepo only. Customer template is separate ticket (016b).

## Implementation Plan

Create `.vscode/settings.json` with modern syntax (VS Code 1.83+):

```json
{
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit"
  }
}
```

**Design decisions:**

| Setting                   | Value        | Rationale                                                  |
| ------------------------- | ------------ | ---------------------------------------------------------- |
| `editor.formatOnSave`     | `true`       | Triggers user's configured formatter                       |
| `source.fixAll.eslint`    | `"explicit"` | Runs ESLint auto-fix on manual save (Cmd+S), not auto-save |
| `editor.defaultFormatter` | **NOT SET**  | Avoids conflicting with developer's preference             |
| `eslint.useFlatConfig`    | **REMOVED**  | Auto-detected with ESLint 9.x + vscode-eslint 3.0.10+      |

**What this enables:**

- Format-on-save using developer's configured formatter
- ESLint auto-fix on save
- Works with Prettier, Biome, dprint, or no formatter

## Acceptance Criteria

- [x] `.vscode/settings.json` created with minimal settings
- [x] Uses `"explicit"` string (not deprecated `true` boolean)
- [x] No `eslint.useFlatConfig` (auto-detected)
- [x] No `editor.defaultFormatter` (avoids conflicts)

## Work Log

---

- 2026-01-11T05:47:00Z Done: Created .vscode/settings.json with formatOnSave and ESLint auto-fix
- 2026-01-10T18:40:00Z Restructured: Moved audit findings to epic 016, narrowed to monorepo scope, fixed deprecated syntax
- 2026-01-10T16:53:00Z Quality Review: Recommendation to not set defaultFormatter (avoid conflicts)
- 2026-01-10T16:08:00Z Started: Created ticket after linting audit

---

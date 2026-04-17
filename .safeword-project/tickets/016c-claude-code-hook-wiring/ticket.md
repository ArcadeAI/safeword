---
id: 016c
type: task
phase: implement
status: ready
created: 2026-01-10T18:40:00Z
last_modified: 2026-01-10T19:51:00Z
---

# Protect config files from accidental LLM changes

**Goal:** Wire existing but unused hooks in `.claude/settings.json`.

**Why:** Two protective hooks exist in `.safeword/hooks/` but aren't configured in settings.json, providing no protection.

## Hooks to Wire

### 1. `pre-tool-config-guard.ts` (PreToolUse)

**What it does:** Requires approval before modifying ESLint, TypeScript, or CI config files.

**Files protected:**

- `eslint.config.*`, `.eslintrc*`
- `tsconfig*.json`
- `.github/workflows/*`
- `package.json` (scripts section)

**Output:** JSON with `permissionDecision: 'ask'` to trigger approval prompt.

### 2. `post-tool-bypass-warn.ts` (PostToolUse)

**What it does:** Warns when code contains bypass patterns that LLMs shouldn't use.

**Patterns detected:**

- `eslint-disable`
- `@ts-ignore`, `@ts-expect-error`
- `as any`, `as unknown`
- `.skip(`, `.only(`

## Implementation Plan

Add to `.claude/settings.json` hooks configuration:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Write|Edit|MultiEdit|NotebookEdit",
        "hooks": [
          {
            "type": "command",
            "command": "bun \"$CLAUDE_PROJECT_DIR\"/.safeword/hooks/pre-tool-config-guard.ts"
          }
        ]
      }
    ],
    "PostToolUse": [
      // ... existing post-tool-lint.ts entry ...
      {
        "matcher": "Write|Edit|MultiEdit|NotebookEdit",
        "hooks": [
          {
            "type": "command",
            "command": "bun \"$CLAUDE_PROJECT_DIR\"/.safeword/hooks/post-tool-bypass-warn.ts"
          }
        ]
      }
    ]
  }
}
```

## Acceptance Criteria

- [ ] `pre-tool-config-guard.ts` wired to PreToolUse with Write|Edit|MultiEdit matcher
- [ ] `post-tool-bypass-warn.ts` wired to PostToolUse with Write|Edit|MultiEdit matcher
- [ ] Both hooks in SETTINGS_HOOKS constant in `config.ts`
- [ ] Integration test verifies hooks are triggered

## Work Log

---

- 2026-01-10T19:51:00Z Renumbered: 016b → 016c (execution priority - after permissions)
- 2026-01-10T18:40:00Z Created: Split from ticket 015 audit findings

---

# Feature Spec: Quality Bypass Prevention

**Guide**: `.safeword/guides/planning-guide.md`
**Template**: `.safeword/templates/feature-spec-template.md`

**Feature**: Prevent agents from bypassing quality enforcement

**Status**: ✅ Complete (4/4 stories complete)

---

## Problem Statement

Agents (LLMs) bypass quality rules instead of fixing code. Attack vectors:

| Vector          | Example                                    | Danger Level |
| --------------- | ------------------------------------------ | ------------ |
| Config edits    | `"rule": "off"` in eslint.config           | 🔴 High      |
| Inline disables | `// eslint-disable-next-line`              | 🔴 High      |
| Type bypasses   | `as any`, `@ts-ignore`, `@ts-expect-error` | 🔴 High      |
| Test deletion   | Remove failing test files                  | 🔴 High      |
| CI changes      | Skip checks in workflow files              | 🟡 Medium    |
| Script changes  | `"lint": "echo ok"` in package.json        | 🟡 Medium    |

This affects:

- **Our codebase**: Accumulated tech debt from suppressed rules
- **Customers**: If we add overrides to presets/templates, we weaken their defaults

## Scope

### Protected Config Files (PreToolUse - require approval)

| Category   | Files                                                      |
| ---------- | ---------------------------------------------------------- |
| ESLint     | `eslint.config.*`, `.eslintrc.*`, `**/eslint-configs/*.ts` |
| TypeScript | `tsconfig*.json`                                           |
| Vitest     | `vitest.config.*`                                          |
| Prettier   | `.prettierrc*`, `prettier.config.*`                        |
| Presets    | `**/presets/**/*.ts`                                       |
| CI         | `.github/workflows/*.yml`, `.gitlab-ci.yml`                |
| Scripts    | `package.json` (lint/test/build scripts)                   |

### Flagged Patterns (PostToolUse - warn agent)

| Category            | Patterns                                                            |
| ------------------- | ------------------------------------------------------------------- |
| ESLint disables     | `eslint-disable`, `eslint-disable-next-line`, `eslint-disable-line` |
| TypeScript bypasses | `@ts-ignore`, `@ts-expect-error`, `@ts-nocheck`, `as any`           |
| Test skips          | `.skip(`, `.only(`, `it.skip`, `describe.skip`, `test.skip`         |

## Solution

Four-layer defense:

| Layer           | Mechanism            | Purpose                                    |
| --------------- | -------------------- | ------------------------------------------ |
| 1. Instructions | SAFEWORD.md section  | Clear policy agents must follow            |
| 2. Config block | PreToolUse hook      | Intercepts config edits, requires approval |
| 3. Pattern warn | PostToolUse hook     | Immediate feedback on bypass patterns      |
| 4. Review       | Stop hook (existing) | Catches changes that slip through          |

---

## Technical Constraints

### Compatibility

- [ ] Must work with existing safeword hook infrastructure
- [ ] Must not break legitimate config changes (with approval)
- [ ] Hook must be lightweight (runs on every Edit/Write)

### Dependencies

- [ ] Uses existing PreToolUse hook pattern (see Claude Code docs)
- [ ] Integrates with existing stop-quality.ts review flow

---

## Story 1: SAFEWORD.md Policy

**As a** project using safeword
**I want** clear instructions that agents must follow regarding quality configs
**So that** agents understand the expected behavior before they act

**Acceptance Criteria**:

- [x] SAFEWORD.md contains "Quality Config Changes" section
- [x] Section states: fix code, don't weaken configs
- [x] Section defines escalation path: research → present evidence → ask user
- [x] Section lists protected file categories (ESLint, TypeScript, Vitest, Prettier, Presets)

**Implementation Status**: ✅ Complete

**Notes**:

- Keep under 20 lines (avoid bloat per SAFEWORD.md philosophy)
- Use table format for scanability

---

## Story 2: PreToolUse Hook for Config Protection

**As a** project maintainer
**I want** edits to quality configs to require explicit approval
**So that** agents cannot silently weaken enforcement

**Acceptance Criteria**:

- [x] Hook intercepts Edit/Write to protected patterns
- [x] Protected patterns include:
  - ESLint: `eslint.config.*`, `.eslintrc.*`, `**/eslint-configs/*.ts`
  - TypeScript: `tsconfig*.json`
  - Vitest: `vitest.config.*`
  - Prettier: `.prettierrc*`, `prettier.config.*`
  - Presets: `**/presets/**/*.ts`
- [x] Hook outputs `permissionDecision: "ask"` with clear message
- [x] Message states: "Quality config change requires approval"
- [x] Hook registered in safeword's settings template

**Implementation Status**: ✅ Complete
**Implementation**: `.safeword/hooks/pre-tool-config-guard.ts`

**Notes**:

- Use PreToolUse (blocks before write) not PostToolUse (after write)
- Exit code 0 with JSON output for "ask" permission
- Stop hook provides backup enforcement if agent bypasses

---

## Story 3: PostToolUse Hook for Bypass Pattern Detection

**As a** project maintainer
**I want** immediate feedback when bypass patterns are added
**So that** agents are reminded to fix code instead of suppressing errors

**Acceptance Criteria**:

- [x] Hook runs after Edit/Write operations
- [x] Detects bypass patterns: `eslint-disable`, `@ts-ignore`, `@ts-expect-error`, `@ts-nocheck`, `as any`, `it.skip(`, etc.
- [x] Outputs warning message reminding agent of policy
- [x] Hook registered in settings

**Implementation Status**: ✅ Complete
**Implementation**: `.safeword/hooks/post-tool-bypass-warn.ts`

---

## Story 4: Audit Existing Preset Overrides

**As a** safeword maintainer
**I want** all preset rule overrides to have documented justification
**So that** we maintain strict defaults for customers

**Acceptance Criteria**:

- [x] Each disabled rule in `packages/cli/src/presets/` has inline comment explaining:
  - What false positive it causes OR why it's inappropriate for the context
  - Evidence (link to issue, docs, or example code)
- [x] Unjustified overrides are removed (code fixed instead)

**Implementation Status**: ✅ Complete

**Notes**:

All preset overrides now have documented justification:

**vitest.ts:**

- `@typescript-eslint/no-empty-function` - ✅ Documented (mocks/stubs need empty functions)
- `security/detect-non-literal-fs-filename` - ✅ Documented (test fixtures are safe)
- `max-nested-callbacks` - ✅ Documented (false positive with array methods)

**playwright.ts:**

- `@typescript-eslint/no-empty-function` - ✅ Documented (same as vitest)
- `security/detect-non-literal-fs-filename` - ✅ Documented (same as vitest)
- `unicorn/no-null` - ✅ Documented (Playwright API requires null, with link)

**base.ts:**

- `import-x/no-named-as-default` - ✅ Documented (React pattern, with issue link)
- `import-x/no-named-as-default-member` - ✅ Documented (same issue)
- `unicorn/no-process-exit` - ✅ Documented (CLI apps need exit codes)
- `unicorn/prefer-module` - ✅ Documented (CJS still valid)

**recommended-typescript.ts:**

- `@typescript-eslint/consistent-type-definitions` - ✅ Documented (both valid, with docs link)

---

## Summary

**Completed**: 4/4 stories (100%)
**Remaining**: 0/4 stories (0%)

### Phase 1: Core Protection

- Story 1: SAFEWORD.md Policy
- Story 2: PreToolUse Hook (config protection)
- Story 3: PostToolUse Hook (bypass pattern warning)

### Phase 2: Cleanup

- Story 4: Audit Existing Preset Overrides

**Next Steps**:

1. Implement Story 1 (SAFEWORD.md section)
2. Implement Story 2 (PreToolUse hook)
3. Implement Story 3 (PostToolUse hook)
4. Test by attempting to modify a config (should require approval)
5. Audit and document existing preset overrides

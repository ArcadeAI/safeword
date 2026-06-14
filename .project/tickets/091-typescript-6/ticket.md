---
id: 091
type: task
phase: intake
status: backlog
created: 2026-03-29T19:16:00Z
last_modified: 2026-03-29T19:42:00Z
---

# Upgrade TypeScript 5→6

**Goal:** Upgrade TypeScript from v5.9.3 to v6.0.2.

**Why:** Major version behind. TypeScript 6 changes default tsconfig values and deprecates legacy options.

## Blocker

`typescript-eslint` 8.57.2 peer dep: `>=4.8.4 <6.0.0`. TS 6 support PR #12124 merged 2026-03-29 — waiting for next release (8.58+).

## Breaking Changes for Safeword

### Must fix

- **`types` defaults to `[]`** — safeword's tsconfig has no explicit `types` field. TS 6 stops auto-enumerating `@types/*`, so Node.js globals (`process`, `Buffer`, `__dirname`) break across 31 source files. Fix: add `"types": ["node"]` to tsconfig.json.

### Already compatible (no action)

| Setting            | Current   | TS 6 Default  | Status                              |
| ------------------ | --------- | ------------- | ----------------------------------- |
| `target`           | `ES2022`  | `es2025`      | ✓ Fine (ES5 deprecated, not ES2022) |
| `module`           | `ESNext`  | `esnext`      | ✓ Fine                              |
| `moduleResolution` | `bundler` | `bundler`     | ✓ Already matches new default       |
| `strict`           | `true`    | `true`        | ✓ Already matches new default       |
| `esModuleInterop`  | `true`    | always `true` | ✓ Now enforced, was already set     |

### Check

- Custom ESLint rules use `context.sourceCode` (not deprecated `context.getSourceCode()`) — verify
- `tsup` compatibility with TS 6 — likely fine but untested
- `@types/node` version alignment (currently v20)

## Scope

### In scope

- Add `"types": ["node"]` to tsconfig.json (can do now, pre-upgrade)
- Bump `typescript` from `^5.3.0` to `^6.0.0` after typescript-eslint unblocks
- Run full test suite + typecheck to catch inference changes
- Update `@types/node` if needed

### Out of scope

- Migrating to TypeScript's Node.js native type stripping (experimental)
- Updating `target` to `es2025` (optional, current `ES2022` is fine)

## Work Log

- 2026-03-29T19:42:00Z Research: TS 6 support PR merged in typescript-eslint today (#12124). Temporarily blocked on next release (8.58+). tsconfig needs `"types": ["node"]`. Rest of config already compatible.
- 2026-03-29T19:16:00Z Created: from audit — dev dep pinned at ^5.3.0, latest is 6.0.2

---

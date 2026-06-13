# Safeword Consolidation Plan

## Goal

Consolidate into a single `safeword` package where:

- `bunx safeword setup` → magic happens
- Language presets are self-contained
- No user-facing `eslint-plugin-safeword` (absorbed into main package)
- Minimal user-installed dependencies

## Target Structure

```
packages/
├── safeword/                      # THE package (rename cli → safeword)
│   ├── src/
│   │   ├── cli/                   # Commands
│   │   │   ├── commands/
│   │   │   │   ├── setup.ts
│   │   │   │   ├── upgrade.ts
│   │   │   │   ├── reset.ts
│   │   │   │   ├── check.ts
│   │   │   │   └── sync-config.ts
│   │   │   └── index.ts
│   │   │
│   │   ├── presets/
│   │   │   ├── typescript/
│   │   │   │   ├── eslint-configs/    # ← from eslint-plugin/src/configs/
│   │   │   │   │   ├── base.ts
│   │   │   │   │   ├── recommended.ts
│   │   │   │   │   ├── recommended-typescript.ts
│   │   │   │   │   ├── recommended-react.ts
│   │   │   │   │   ├── recommended-nextjs.ts
│   │   │   │   │   ├── astro.ts
│   │   │   │   │   ├── tailwind.ts
│   │   │   │   │   ├── vitest.ts
│   │   │   │   │   ├── playwright.ts
│   │   │   │   │   └── tanstack-query.ts
│   │   │   │   ├── eslint-rules/      # ← from eslint-plugin/src/rules/
│   │   │   │   │   ├── no-accumulating-spread.ts
│   │   │   │   │   ├── no-incomplete-error-handling.ts
│   │   │   │   │   ├── no-re-export-all.ts
│   │   │   │   │   └── index.ts
│   │   │   │   ├── detect.ts          # ← from eslint-plugin/src/detect.ts
│   │   │   │   ├── files.ts           # Config generators (existing)
│   │   │   │   ├── setup.ts           # Setup logic (existing)
│   │   │   │   └── index.ts
│   │   │   │
│   │   │   ├── python/
│   │   │   │   ├── ruff.ts            # Ruff configs (already inline)
│   │   │   │   ├── mypy.ts            # Mypy configs (already inline)
│   │   │   │   ├── files.ts
│   │   │   │   └── index.ts
│   │   │   │
│   │   │   └── golang/
│   │   │       ├── golangci.ts        # golangci-lint configs
│   │   │       ├── files.ts
│   │   │       └── index.ts
│   │   │
│   │   ├── tools/                     # Cross-language config generators
│   │   │   └── depcruise.ts           # Generates .dependency-cruiser.js
│   │   │
│   │   ├── versions.ts                # Pinned tool versions for bunx
│   │   │
│   │   └── index.ts                   # Main exports
│   │
│   └── package.json                   # Named "safeword"
│
└── website/
```

## Packages to Delete

- `packages/eslint-plugin/` → merged into `safeword/src/presets/typescript/`
- `packages/quality/` → unnecessary abstraction

## Pinned Tool Versions

Create `src/versions.ts`:

```typescript
/**
 * Pinned versions for bunx-invoked tools.
 *
 * These ensure deterministic behavior across all users.
 * Update these when releasing new safeword versions.
 */
export const TOOL_VERSIONS = {
  jscpd: '4.0.5',
  publint: '0.3.16',
} as const;
```

Templates interpolate:

```bash
bunx jscpd@4.0.5 . --gitignore --min-lines 10
bunx publint@0.3.16 .
```

## User-Installed Dependencies

**Installed in user's project (via setup):**

```typescript
base: [
  "eslint",
  "safeword",           // Our package (replaces eslint-plugin-safeword)
  "dependency-cruiser", // Needs local TS transpiler
  "knip",               // For CI integration
],
conditional: {
  standard: ["prettier"],
  astro: ["prettier-plugin-astro"],
  tailwind: ["prettier-plugin-tailwindcss"],
  shell: ["prettier-plugin-sh"],
  legacyEslint: ["@eslint/eslintrc"],
}
```

**Invoked via bunx (not installed):**

- `jscpd@4.0.5` - Copy/paste detection
- `publint@0.3.16` - Package publishing validation

## Generated Config

User's `eslint.config.mjs`:

```javascript
import safeword from 'safeword';
export default safeword.eslint.auto();
```

Or manual:

```javascript
import safeword from 'safeword';
export default [
  ...safeword.eslint.recommendedTypeScript,
  ...safeword.eslint.react,
  ...safeword.eslint.tailwind,
];
```

## Main Package Exports

```typescript
// src/index.ts

// CLI commands (for programmatic use)
export { setup, upgrade, reset, check } from './cli/index.js';

// ESLint presets (for user's eslint.config.mjs)
export const eslint = {
  auto, // Detects and configures everything
  recommended, // JS
  recommendedTypeScript, // TS
  recommendedTypeScriptReact, // React + TS
  recommendedTypeScriptNext, // Next.js + TS
  astro,
  tailwind,
  vitest,
  playwright,
  tanstackQuery,
};

// Detection utilities (for generated configs)
export { detect } from './presets/typescript/detect.js';
```

## Migration Steps

### Phase 1: Restructure

1. Rename `packages/cli` → `packages/safeword`
2. Update package.json name to `safeword`
3. Create `src/presets/typescript/` structure
4. Move `eslint-plugin/src/configs/` → `safeword/src/presets/typescript/eslint-configs/`
5. Move `eslint-plugin/src/rules/` → `safeword/src/presets/typescript/eslint-rules/`
6. Move `eslint-plugin/src/detect.ts` → `safeword/src/presets/typescript/detect.ts`
7. Create `src/versions.ts` with pinned tool versions

### Phase 2: Update Imports

8. Update all internal imports throughout codebase
9. Update generated config templates to `import safeword from "safeword"`
10. Update package installation list (replace `eslint-plugin-safeword` with `safeword`)

### Phase 3: Cleanup

11. Delete `packages/eslint-plugin/`
12. Delete `packages/quality/`
13. Update bun.lock / workspace config
14. Run tests, fix any issues

### Phase 4: Verify

15. Build package
16. Test `bunx safeword setup` in fresh project
17. Verify ESLint works with generated config
18. Verify all presets load correctly

## Breaking Changes

- Users upgrading must change `eslint-plugin-safeword` → `safeword` in dependencies
- Generated `eslint.config.mjs` import changes from `eslint-plugin-safeword` to `safeword`
- Upgrade command should handle this migration automatically

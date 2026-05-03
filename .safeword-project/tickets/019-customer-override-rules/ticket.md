---
id: 019
type: task
phase: implement
status: ready
created: 2026-01-10T19:15:00Z
last_modified: 2026-01-11T05:46:00Z
---

# Allow customers to override LLM-specific checker rules

**Goal:** Enable customers to override safeword's strict LLM rules without forking configs.

**Why:** Safeword uses stricter rules for LLM enforcement (all warnings → errors, additional safety rules). Some teams may disagree with specific rules or have legitimate exceptions. Currently there's no clean way to override these without editing `.safeword/` files (which get overwritten on upgrade).

**Category:** Configuration architecture (standalone - foundational for customer customization).

## The Problem

Safeword generates two ESLint configs:

1. **Project config** (`eslint.config.mjs`): For humans in IDE and pre-commit hooks
2. **LLM config** (`.safeword/eslint.config.mjs`): Stricter rules enforced via PostToolUse hooks

The LLM config imports and extends the project config, adding stricter rules. But customers can't override these stricter rules because:

- `.safeword/` files are owned by safeword and overwritten on upgrade
- ESLint flat config uses "later wins" - safeword rules always come last

Same problem exists for Ruff (Python) and golangci-lint (Go).

## Solution: Override Files in `.safeword-project/`

Add support for customer override files that get merged AFTER safeword's LLM rules:

```
.safeword-project/
├── eslint-overrides.mjs      # ESLint: runtime import
├── ruff-overrides.toml       # Ruff: generation-time merge
└── golangci-overrides.yml    # golangci-lint: generation-time merge
```

### ESLint (Runtime Merge)

ESLint flat config supports array composition. Modify `.safeword/eslint.config.mjs` generation:

```javascript
// .safeword/eslint.config.mjs (generated)
import { defineConfig } from 'eslint/config';
import projectConfig from '../eslint.config.mjs';
import safewordRules from './rules.mjs';

// Customer overrides (optional, applied last)
let customerOverrides = [];
try {
  customerOverrides = (await import('../.safeword-project/eslint-overrides.mjs')).default;
} catch (error) {
  // Only swallow "file not found" - syntax errors surface to user
  if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error;
}

export default defineConfig([
  ...projectConfig, // 1. Customer's project rules
  ...safewordRules, // 2. Safeword LLM enforcement
  ...customerOverrides, // 3. Customer overrides (wins)
]);
```

**Note:** `defineConfig()` is available in ESLint v9+ and provides better TypeScript support and validation. The spread approach remains correct for array composition.

Customer creates `.safeword-project/eslint-overrides.mjs`:

```javascript
// .safeword-project/eslint-overrides.mjs
export default [
  {
    rules: {
      // Override specific safeword rules
      'no-incomplete-error-handling': 'warn', // Downgrade to warning
      'max-lines-per-function': 'off', // Disable entirely
    },
  },
];
```

### Ruff (Generation-Time Merge)

Ruff's `extend` directive only works one level. Use generation-time merge instead:

```toml
# .safeword-project/ruff-overrides.toml
[lint]
ignore = ["E501"]  # Appended to safeword's ignore list

[lint.per-file-ignores]
"tests/**" = ["S101"]  # Merged with safeword's per-file-ignores
```

During `safeword upgrade`, merge into `.safeword/ruff.toml`:

```python
# In generator
base_config = load_ruff_base()
if exists('.safeword-project/ruff-overrides.toml'):
    overrides = load_toml('.safeword-project/ruff-overrides.toml')
    merged = deep_merge(base_config, overrides)
write('.safeword/ruff.toml', merged)
```

### golangci-lint (Generation-Time Merge)

Same pattern as Ruff. **Uses v2 format** (safeword generates v2):

```yaml
# .safeword-project/golangci-overrides.yml
linters:
  settings:
    govet:
      enable-all: false # Override safeword's strict govet
  exclusions:
    rules:
      - path: _test\.go
        linters: [errcheck] # Allow unchecked errors in tests
```

## Implementation Plan

### ESLint

1. Modify `getSafewordEslintConfig()` in `packages/cli/src/templates/config.ts`
2. Add dynamic import for `.safeword-project/eslint-overrides.mjs`, spread after safeword rules
3. Document in generated config comments

### Ruff

1. Modify `packages/cli/src/packs/python/files.ts`
2. In `.safeword/ruff.toml` generator, check for overrides file and deep merge
3. Arrays append, scalars replace (standard deep merge)

### golangci-lint

1. Modify `packages/cli/src/packs/golang/files.ts`
2. In `.safeword/golangci.yml` generator, check for overrides file and deep merge
3. Arrays append, scalars replace (update existing `deepMerge()` function)

### Shared

1. Add config merge utilities to `packages/cli/src/utils/config-merge.ts`

**UX Note:** ESLint overrides take effect immediately (runtime import). Ruff and golangci-lint overrides require `safeword upgrade` to regenerate configs (generation-time merge). Document this difference in generated file comments.

## File Structure Changes

```
packages/cli/src/
├── templates/
│   └── config.ts          # ESLint override import
├── packs/
│   ├── python/files.ts    # Ruff override merge
│   └── golang/files.ts    # golangci-lint override merge
└── utils/
    └── config-merge.ts    # NEW: shared TOML/YAML merge utilities
```

## Acceptance Criteria

- [ ] ESLint: `.safeword-project/eslint-overrides.mjs` applied after safeword rules
- [ ] Ruff: `.safeword-project/ruff-overrides.toml` merged at generation time
- [ ] golangci-lint: `.safeword-project/golangci-overrides.yml` merged at generation time
- [ ] Missing override files don't cause errors
- [ ] Override files survive `safeword upgrade`
- [ ] Override files committed by default (team-wide LLM consistency)
- [ ] Documentation added explaining override mechanism
- [ ] Generated file comments explain UX difference (ESLint immediate, Ruff/golangci requires upgrade)

## Design Decisions

| Decision            | Choice               | Rationale                                   |
| ------------------- | -------------------- | ------------------------------------------- |
| Override location   | `.safeword-project/` | Survives upgrades, clear ownership          |
| ESLint merge        | Runtime              | Flat config supports dynamic imports        |
| Ruff/golangci merge | Generation-time      | No native runtime config composition        |
| Array merge         | Append               | Additive overrides without full replacement |
| Commit by default   | Yes                  | Team-wide LLM behavior should be consistent |

## Why Only Three Tools?

Only ESLint, Ruff, and golangci-lint have `.safeword/` configs because they're **linters with configurable rule severity** where we can meaningfully add LLM-specific strictness.

Other tools don't need override files:

| Tool               | Why No Override                                      |
| ------------------ | ---------------------------------------------------- |
| Prettier           | Formatter = style only, no "stricter" concept        |
| mypy               | `strict = True` is already maximum strictness        |
| knip               | Analysis tool - binary pass/fail, not per-line rules |
| dependency-cruiser | Architecture rules - binary pass/fail                |

**Future-proofing:** If safeword needs to add ignores to tools like knip (e.g., for false positives), use **JSON merge** (same pattern as `package.json` scripts):

```typescript
// typescriptJsonMerges['knip.json']
merge: existing => {
  const ignore = [...(existing.ignore || [])];
  if (!ignore.includes('.safeword/**')) ignore.push('.safeword/**');
  return { ...existing, ignore };
};
```

This additively merges safeword's patterns without overwriting customer config. Knip doesn't support `extends`, so JSON merge is the correct approach.

## Why Separate Files (Not Unified)?

Considered a single unified config file (e.g., `.safeword-project/overrides.toml`) for all tools. **Rejected** in favor of separate per-tool files.

**Why Biome's unified approach works:**

- Biome is ONE tool with ONE parser
- One config format (JSON) for everything
- Translation layer handles all internal concerns

**Why safeword uses separate files:**

- We configure MULTIPLE tools with DIFFERENT parsers
- ESLint needs JavaScript (MJS) for full expressiveness (dynamic imports, computed values)
- Ruff uses TOML, golangci-lint uses YAML
- A translation layer would add complexity without proportional benefit
- Native config formats mean customers can use tool documentation directly

**Result:** Three separate files, each in the tool's native format:

- `.safeword-project/eslint-overrides.mjs` (JavaScript)
- `.safeword-project/ruff-overrides.toml` (TOML)
- `.safeword-project/golangci-overrides.yml` (YAML)

## Alternatives Considered

### 1. Environment Variable Toggle

```bash
SAFEWORD_STRICT=false safeword lint
```

**Rejected:** Binary toggle, no rule-level control.

### 2. Inline Comments

```typescript
// safeword-ignore-next-line no-incomplete-error-handling
```

**Rejected:** Pollutes code, doesn't survive refactoring.

### 3. Separate Override Command

```bash
safeword override --rule no-incomplete-error-handling=warn
```

**Rejected:** Yet another CLI command, harder to discover than file.

## Work Log

---

- 2026-04-19T00:13:00Z **Superseded by [ticket 138](../138-unify-customer-override-contract/ticket.md).** 138 unifies the customer override contract by flipping ESLint composition order (native flat-config "later wins" makes customer win) and unifying Ruff standalone mode to always extend customer config. This eliminates the need for the secondary `.safeword-project/*-overrides.*` surface proposed here. 019's design was sound for the problem it addressed, but 138's single-surface approach avoids the two-surface mental model. Keeping 019 open as historical design reference; not marking complete because the mechanism here is not being built. Cross-reference: ticket 137 exploration surfaced the deeper design issue that led to 138.
- 2026-01-11T05:46:00Z Renumbered: 016d → 019 (standalone ticket)
- 2026-01-11T03:36:00Z Updated: Added defineConfig() wrapper for ESLint v9+ best practices
- 2026-01-10T19:46:00Z Added: "Why Separate Files?" design rationale (Biome comparison, native format benefits)
- 2026-01-10T19:45:00Z Refactored: Made standalone (configuration architecture doesn't fit IDE/Claude Code epic)
- 2026-01-10T19:35:00Z Added: "Why Only Three Tools?" section with future-proofing for knip/depcruiser via JSON merge
- 2026-01-10T19:30:00Z Fixed: golangci-lint v2 format, Ruff uses `ignore` not `extend-ignore` (array append handles it)
- 2026-01-10T19:26:00Z Fixed: ESLint catch only ERR_MODULE_NOT_FOUND (CWD-independent, surfaces syntax errors)
- 2026-01-10T19:20:00Z Refined: Fixed gitignore→commit default, added array merge semantics, documented UX asymmetry
- 2026-01-10T19:15:00Z Created: Unified override design for ESLint, Ruff, golangci-lint

---

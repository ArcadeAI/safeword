# Safeword Architecture

**Version:** 1.6
**Last Updated:** 2026-02-16
**Status:** Production

---

## Table of Contents

- [Overview](#overview)
- [Monorepo Structure](#monorepo-structure)
- [CLI Structure](#cli-structure)
- [Language Packs](#language-packs)
- [Language Detection](#language-detection)
- [Key Decisions](#key-decisions)
- [Best Practices](#best-practices)
- [Migration Strategy](#migration-strategy)

---

## Overview

Safeword is a CLI tool that configures linting, hooks, and development guides for AI coding agent projects (Claude Code and Cursor). It supports JavaScript/TypeScript projects (ESLint, Prettier), Python projects (Ruff, mypy), Go projects (golangci-lint), and Rust projects (clippy, rustfmt).

### Tech Stack

| Category        | Choice        | Rationale                              |
| --------------- | ------------- | -------------------------------------- |
| Runtime         | Bun           | Fast startup, TypeScript native        |
| Package Manager | npm/bun       | Standard for JS ecosystem              |
| JS Linting      | ESLint        | Industry standard, extensive rule set  |
| Python Linting  | Ruff          | Fast, replaces flake8/black/isort      |
| Go Linting      | golangci-lint | Aggregates 100+ linters, fast          |
| Rust Linting    | clippy        | 750+ lints, pedantic by default        |
| Rust Formatting | rustfmt       | Deterministic, gofmt-style formatting  |
| Type Checking   | tsc / mypy    | Native type checkers for each language |

---

## Monorepo Structure

```text
packages/
├── cli/            # Main CLI tool + ESLint configs (bunx safeword)
└── website/        # Documentation site (Astro/Starlight)
```

| Package             | Purpose                                                 | Published As |
| ------------------- | ------------------------------------------------------- | ------------ |
| `packages/cli/`     | CLI + bundled ESLint configs (`safeword/eslint` export) | `safeword`   |
| `packages/website/` | Documentation website                                   | Private      |

ESLint configs are bundled in the main package and accessed via `import safeword from "safeword/eslint"`.

---

## CLI Structure

```text
packages/cli/
├── src/
│   ├── commands/       # CLI commands (setup, upgrade, check, diff, reset, sync-config)
│   ├── packs/          # Language packs + registry
│   │   ├── {lang}/     # index.ts, files.ts, setup.ts per language
│   │   ├── registry.ts # Central pack registry and detection
│   │   ├── config.ts   # Pack config management (.safeword/config.json)
│   │   ├── install.ts  # Pack installation logic
│   │   └── types.ts    # Shared type definitions
│   ├── presets/        # ESLint presets (exported as safeword/eslint)
│   │   └── typescript/ # ESLint configs, rules, detection
│   ├── templates/      # Template content helpers
│   ├── utils/          # Detection, file ops, git, version
│   ├── schema.ts       # Single source of truth for all managed files
│   └── reconcile.ts    # Schema-based file management
├── templates/
│   ├── SAFEWORD.md     # Core instructions (installed to .safeword/)
│   ├── AGENTS.md       # Project context template
│   ├── commands/       # Slash commands (/audit, /bdd, /cleanup-zombies, /done, /lint, /quality-review, /refactor)
│   ├── cursor/         # Cursor IDE rules (.mdc files)
│   ├── doc-templates/  # Feature specs, design docs, tickets
│   ├── guides/         # Methodology guides (TDD, planning, etc.)
│   ├── hooks/          # Claude Code hooks (lint, quality review)
│   ├── prompts/        # Prompt templates for commands
│   ├── scripts/        # Shell scripts (cleanup, bisect)
│   └── skills/         # Claude Code skills (BDD orchestration, debugging, quality review, refactoring)
```

---

## Language Packs

### Pattern: Modular Language Support

Language-specific tooling (detection, config generation, setup) is encapsulated in **language packs**. Each pack implements a standard interface, enabling consistent multi-language support.

```typescript
interface LanguagePack {
  id: string; // e.g., 'python', 'typescript', 'golang', 'rust'
  name: string; // e.g., 'Python', 'TypeScript', 'Go', 'Rust'
  extensions: string[]; // e.g., ['.py', '.pyi']
  detect: (cwd: string) => boolean; // Is this language present?
  setup: (cwd: string, ctx: SetupContext) => SetupResult;
}

// Registry
const LANGUAGE_PACKS: Record<string, LanguagePack> = {
  golang: golangPack,
  python: pythonPack,
  rust: rustPack,
  typescript: typescriptPack,
};
```

### Pack File Structure

**Root files** (shared infrastructure):

| File          | Purpose                                              |
| ------------- | ---------------------------------------------------- |
| `registry.ts` | Central registry, `detectLanguages()`, pack lookup   |
| `config.ts`   | Read/write `.safeword/config.json` (installed packs) |
| `install.ts`  | Pack installation orchestration                      |
| `types.ts`    | Shared types (`LanguagePack`, `ProjectContext`)      |

**Per-language packs** (3-file pattern):

```text
packs/{lang}/
├── index.ts   # LanguagePack interface implementation
├── files.ts   # ownedFiles, managedFiles, jsonMerges exports
└── setup.ts   # Setup utilities (language-specific tooling)
```

**Exports from files.ts:**

- `{lang}OwnedFiles` - Files overwritten on upgrade
- `{lang}ManagedFiles` - Files created if missing
- `{lang}JsonMerges` - JSON keys to merge (TypeScript only)
- `{lang}Packages` - NPM packages to install (TypeScript only)

These exports are spread into `schema.ts` for the reconciliation engine.

**Implementation:** `packages/cli/src/packs/`

### Config Schema

Installed packs tracked in `.safeword/config.json`:

```json
{
  "version": "0.15.0",
  "installedPacks": ["python", "typescript", "golang", "rust"]
}
```

---

## Language Detection

### Pattern: Detect Languages Before Framework

Language detection runs FIRST, before any framework-specific detection. This prevents side effects like creating package.json for Python-only projects.

```text
detectLanguages(cwd)     →  Languages { javascript, python, golang, rust }
       ↓
detectProjectType()      →  ProjectType (if javascript)
detectPythonType()       →  PythonProjectType (if python)
```

### Data Model

```typescript
// Detection functions
function detectLanguages(cwd: string): Languages;
function detectPythonType(cwd: string): PythonProjectType | undefined;

// Language detection result
interface Languages {
  javascript: boolean; // package.json exists
  python: boolean; // pyproject.toml OR requirements.txt exists
  golang: boolean; // go.mod exists
  rust: boolean; // Cargo.toml exists
}

// Python-specific detection (returned only if languages.python)
interface PythonProjectType {
  framework: 'django' | 'flask' | 'fastapi' | undefined;
  packageManager: 'poetry' | 'uv' | 'pip';
}

// Extended ProjectContext (packages/cli/src/packs/types.ts)
// Note: projectType stays REQUIRED - returns all-false for Python-only projects
interface ProjectContext {
  cwd: string;
  projectType: ProjectType; // Unchanged - handles missing package.json
  developmentDeps: Record<string, string>;
  productionDeps: Record<string, string>;
  isGitRepo: boolean;
  languages?: Languages; // Optional - set when language detection runs
}
```

**Implementation:** `packages/cli/src/utils/project-detector.ts`

---

## Key Decisions

### Graceful Linter Fallback

**Status:** Accepted
**Date:** 2025-12-24

| Field          | Value                                                                                     |
| -------------- | ----------------------------------------------------------------------------------------- |
| What           | Skip linter silently if not installed, rather than error                                  |
| Why            | Hook should never block Claude's workflow; users may not have tools installed immediately |
| Trade-off      | User may not realize linting is skipped                                                   |
| Alternatives   | Error on missing linter (rejected: blocks Claude), warn always (rejected: noisy)          |
| Implementation | `packages/cli/templates/hooks/lib/lint.ts` - uses `.nothrow().quiet()`                    |

### TOML Parsing Without Dependencies

**Status:** Accepted
**Date:** 2025-12-24

| Field          | Value                                                                               |
| -------------- | ----------------------------------------------------------------------------------- |
| What           | Use line-based extraction for pyproject.toml instead of full TOML parser            |
| Why            | No new npm dependencies; only need section detection (`[tool.poetry]`, `[tool.uv]`) |
| Trade-off      | May fail on complex TOML edge cases                                                 |
| Alternatives   | @iarna/toml (rejected: adds dependency), toml-js (rejected: adds dependency)        |
| Implementation | `packages/cli/src/utils/project-detector.ts`                                        |

### Ruff in Hook, mypy in Command Only

**Status:** Accepted
**Date:** 2025-12-24

| Field          | Value                                                                                                |
| -------------- | ---------------------------------------------------------------------------------------------------- |
| What           | Lint hook runs Ruff (fast); /lint command runs mypy (slow)                                           |
| Why            | Ruff: ms per file, safe for hooks. mypy: seconds for whole project, would block Claude               |
| Trade-off      | Type errors not caught until explicit /lint run                                                      |
| Alternatives   | mypy in hook with caching (rejected: still too slow), skip mypy entirely (rejected: loses value)     |
| Implementation | Hook: `packages/cli/templates/hooks/lib/lint.ts`; Command: `packages/cli/templates/commands/lint.md` |

### Bundled Language Packs (No External Packages)

**Status:** Accepted
**Date:** 2025-12-26

| Field          | Value                                                                                                   |
| -------------- | ------------------------------------------------------------------------------------------------------- |
| What           | Language packs are bundled in safeword core, not separate npm packages                                  |
| Why            | Simpler distribution, no version matrix, always in sync with CLI                                        |
| Trade-off      | Can't add languages without safeword release                                                            |
| Alternatives   | Separate npm packages (rejected: version coordination complexity), user-defined packs (deferred: YAGNI) |
| Implementation | `packages/cli/src/packs/*.ts`                                                                           |

### Unified BDD+TDD Workflow (Inline TDD in BDD Skill)

**Status:** Accepted
**Date:** 2026-01-07

| Field          | Value                                                                                                      |
| -------------- | ---------------------------------------------------------------------------------------------------------- |
| What           | TDD (RED→GREEN→REFACTOR) is inline in BDD skill Phase 6, not a separate handoff                            |
| Why            | Skill-to-skill handoffs are unreliable; agent memory doesn't guarantee the delegated skill will be invoked |
| Trade-off      | BDD skill is larger; standalone TDD skill and `/tdd` command removed                                       |
| Alternatives   | Separate TDD skill with handoff (rejected: soft enforcement), subagent delegation (rejected: no nesting)   |
| Implementation | `packages/cli/templates/skills/bdd/SKILL.md` Phase 6-7                                                     |

### Skill Consolidation (Removed Redundant Skills)

**Status:** Accepted
**Date:** 2026-01-09

| Field          | Value                                                                                                         |
| -------------- | ------------------------------------------------------------------------------------------------------------- |
| What           | Removed standalone TDD, brainstorming, and writing-plans skills; consolidated into BDD orchestration          |
| Why            | BDD skill's discovery phase covers brainstorming; Phase 6 includes full TDD; Claude Code has native plan mode |
| Trade-off      | Less granular skill invocation; users must use `/bdd` for structured workflows                                |
| Removed        | `safeword-tdd-enforcing`, `safeword-brainstorming`, `safeword-writing-plans` skills; `/tdd` command           |
| Remaining      | 4 skills: `bdd`, `debug`, `quality-review`, `refactor`                                                        |
| Implementation | Deprecated files listed in `packages/cli/src/schema.ts` deprecatedFiles/deprecatedDirs                        |

### Hard Block for Done Phase (Exit Code 2)

**Status:** Accepted
**Date:** 2026-01-07

| Field          | Value                                                                                                   |
| -------------- | ------------------------------------------------------------------------------------------------------- |
| What           | Done phase in quality hook uses exit 2 (hard block) requiring evidence before completion                |
| Why            | Prevents premature "done" claims; agent must show test output (e.g., "✓ 156/156 tests pass")            |
| Trade-off      | Slightly more friction at completion time                                                               |
| Alternatives   | Soft block with reminder (rejected: too easy to ignore), no enforcement (rejected: allows false claims) |
| Implementation | `packages/cli/templates/hooks/stop-quality.ts` - `hardBlockDone()` with evidence pattern matching       |

---

## Best Practices

### File Extension Routing

**What:** Route files to correct linter based on extension
**Why:** Polyglot projects need ESLint, Ruff, golangci-lint, and clippy
**Example:** See `packages/cli/templates/hooks/lib/lint.ts`

```typescript
const JS_EXTENSIONS = new Set(['js', 'jsx', 'ts', 'tsx', ...]);
const PYTHON_EXTENSIONS = new Set(['py', 'pyi']);
const GO_EXTENSIONS = new Set(['go']);
const RUST_EXTENSIONS = new Set(['rs']);
// Route to ESLint, Ruff, golangci-lint, or clippy/rustfmt based on extension
```

### Silent Linter Execution

**What:** Run linters with `.nothrow().quiet()` (Bun shell pattern)
**Why:** Matches current ESLint behavior; tool missing = silent skip, no explicit `which` check needed
**Example:** `await $\`ruff check --fix ${file}\`.nothrow().quiet();`

### Schema Language Awareness

**What:** Schema generators check `ctx.languages.javascript` before creating JS-specific files
**Why:** Prevents eslint.config.mjs, knip.json, package.json merges for Python-only projects
**Files affected:**

- `packages/cli/src/schema.ts` - managedFiles generators, jsonMerges, packages.base

---

## Migration Strategy

### From JS-Only to Polyglot Support

**Trigger:** Implementation of Python support feature

**Steps:**

1. Add `detectLanguages()` layer above `detectProjectType()`
2. Extend lint hook with Python extension routing
3. Make setup command conditional on detected languages
4. Update /lint command template with Python tooling

**Rollback:** Revert to previous version; no breaking changes to JS-only projects

---

## References

- Language Pack Spec: `packages/cli/src/packs/LANGUAGE_PACK_SPEC.md`
- Ruff docs: https://docs.astral.sh/ruff/
- golangci-lint docs: https://golangci-lint.run/
- Clippy docs: https://doc.rust-lang.org/stable/clippy/
- rustfmt docs: https://rust-lang.github.io/rustfmt/
- Cargo lints: https://doc.rust-lang.org/cargo/reference/manifest.html#the-lints-section
- PEP 621: https://peps.python.org/pep-0621/

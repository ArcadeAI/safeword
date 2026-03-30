# Safeword Architecture

**Version:** 1.11
**Last Updated:** 2026-03-30
**Status:** Production

---

## Table of Contents

- [Overview](#overview)
- [Monorepo Structure](#monorepo-structure)
- [CLI Structure](#cli-structure)
- [Language Packs](#language-packs)
- [Language Detection](#language-detection)
- [Reconciliation Engine](#reconciliation-engine)
- [Dependencies](#dependencies)
- [Test Structure](#test-structure)
- [Build & Distribution](#build--distribution)
- [Key Decisions](#key-decisions)

---

## Overview

Safeword is a CLI tool that configures linting, hooks, and development guides for AI coding agent projects (Claude Code and Cursor). It supports JavaScript/TypeScript projects (ESLint, Prettier), Python projects (Ruff, mypy), Go projects (golangci-lint), Rust projects (clippy, rustfmt), and dbt projects (SQLFluff).

### Tech Stack

| Category        | Choice             | Rationale                              |
| --------------- | ------------------ | -------------------------------------- |
| Runtime         | Bun                | Fast startup, TypeScript native        |
| Package Manager | npm/bun            | Standard for JS ecosystem              |
| JS Linting      | ESLint             | Industry standard, extensive rule set  |
| Python Linting  | Ruff               | Fast, replaces flake8/black/isort      |
| Go Linting      | golangci-lint      | Aggregates 100+ linters, fast          |
| Rust Linting    | clippy             | 750+ lints, pedantic by default        |
| Rust Formatting | rustfmt            | Deterministic, gofmt-style formatting  |
| SQL Linting     | SQLFluff           | dbt-aware, Jinja templater support     |
| Type Checking   | tsc / mypy         | Native type checkers for each language |
| Arch Validation | dependency-cruiser | Circular dep detection, layer rules    |

---

## Monorepo Structure

```text
packages/
├── cli/            # Main CLI tool + ESLint configs (bunx safeword)
└── website/        # Documentation site (Astro/Starlight)
plugin/             # Cursor IDE plugin (commands, hooks)
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
│   ├── commands/       # Slash commands (see templates/commands/ for full list)
│   ├── cursor/         # Cursor IDE rules (.mdc files)
│   ├── doc-templates/  # Feature specs, design docs, tickets
│   ├── guides/         # Methodology guides (TDD, planning, etc.)
│   ├── hooks/          # Claude Code hooks (lint, quality review)
│   ├── prompts/        # Prompt templates for commands
│   ├── scripts/        # Shell scripts (cleanup, bisect)
│   └── skills/         # Claude Code skills (see templates/skills/ for full list)
```

---

## Language Packs

### Pattern: Modular Language Support

Language-specific tooling (detection, config generation, setup) is encapsulated in **language packs**. Each pack implements a standard interface, enabling consistent multi-language support.

```typescript
interface LanguagePack {
  id: string; // e.g., 'python', 'typescript', 'golang', 'rust', 'sql'
  name: string; // e.g., 'Python', 'TypeScript', 'Go', 'Rust', 'SQL/dbt'
  extensions: string[]; // e.g., ['.py', '.pyi']
  detect: (cwd: string) => boolean; // Is this language present?
  setup: (cwd: string, ctx: SetupContext) => SetupResult;
}

// Registry
const LANGUAGE_PACKS: Record<string, LanguagePack> = {
  golang: golangPack,
  python: pythonPack,
  rust: rustPack,
  sql: sqlPack,
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

**Per-language packs** (standard pattern: `index.ts`, `files.ts`, `setup.ts`):

```text
packs/{lang}/
├── index.ts   # LanguagePack interface implementation
├── files.ts   # ownedFiles, managedFiles, jsonMerges exports
└── setup.ts   # Setup utilities (language-specific tooling)
```

Note: SQL pack uses `dialect.ts` (dialect auto-detection) instead of `setup.ts`.

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
  sql: boolean; // dbt_project.yml exists
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

### Framework-Specific ESLint Plugins

All framework ESLint plugins are **conditional** — only included when the framework is detected in the user's `package.json` dependencies. This prevents peer dependency warnings for frameworks users don't have installed.

| Plugin         | Detection                   | Peer Dep             |
| -------------- | --------------------------- | -------------------- |
| vitest         | `detect.hasVitest()`        | `vitest: *`          |
| playwright     | `detect.hasPlaywright()`    | —                    |
| storybook      | `detect.hasStorybook()`     | `storybook: ^10.3.3` |
| tanstack-query | `detect.hasTanstackQuery()` | `typescript: ^5.4.0` |
| tailwind       | `detect.hasTailwind()`      | —                    |
| turbo          | `detect.hasTurbo()`         | `turbo: >2.0.0`      |

Base plugins (sonarjs, security, unicorn, import-x, regexp, promise, jsdoc, eslint-comments) are always included.

**Implementation:** `packages/cli/src/presets/typescript/detect.ts`, `packages/cli/src/templates/config.ts`

---

## Reconciliation Engine

The reconciliation engine (`src/reconcile.ts`) is the core of all file operations. Commands never write files directly — they compute a plan from the schema and execute it.

### Schema (`src/schema.ts`)

Single source of truth for everything safeword manages:

```typescript
SAFEWORD_SCHEMA = {
  version: string             // Current safeword version
  ownedDirs: [...]            // Created on setup, deleted on reset
  sharedDirs: [...]           // We add to, not fully owned
  preservedDirs: [...]        // Created but never deleted (user data)
  deprecatedFiles: [...]      // Deleted on upgrade
  deprecatedDirs: [...]       // Deleted on upgrade
  deprecatedPackages: [...]   // Uninstalled on upgrade
  ownedFiles: { ... }         // Overwritten on every upgrade
  managedFiles: { ... }       // Created if missing, not overwritten
  jsonMerges: { ... }         // Merge specific keys into JSON files
  textPatches: { ... }        // Marker-based text insertions
  packages: { base, conditional }  // Dependencies to install
}
```

File definitions support three content sources: `template` (path in `templates/`), `content` (static string or factory), `generator` (dynamic function of `ProjectContext`, returns `undefined` to skip).

### Reconciliation Modes

| Mode             | Behavior                                         |
| ---------------- | ------------------------------------------------ |
| `install`        | Create dirs, write files, merge JSON, patch text |
| `upgrade`        | Remove deprecated, update owned, create missing  |
| `uninstall`      | Remove safeword-managed files and dirs           |
| `uninstall-full` | Also remove generated configs (ESLint, Prettier) |

**Key property:** Idempotent. Running the same mode twice produces the same result.

### Data Flow

```text
CLI command
  → createProjectContext(cwd)     # detect languages, frameworks, tooling
  → reconcile(schema, mode, ctx)  # compute plan from schema + context
    → computePlan()               # directory, file, JSON, text actions
    → executePlan()               # create, update, delete, chmod
  → installDependencies()         # npm/bun/pnpm/yarn
```

---

## Dependencies

### Runtime (`dependencies`)

| Package                                           | Purpose                             |
| ------------------------------------------------- | ----------------------------------- |
| `commander`                                       | CLI argument parsing                |
| `yaml`                                            | YAML config parsing (failsafe mode) |
| `@eslint/js`                                      | ESLint core rules                   |
| `typescript-eslint`                               | TypeScript ESLint parser + rules    |
| `eslint-config-prettier`                          | Disable formatting rules            |
| `eslint-plugin-*`                                 | ESLint plugins (see package.json)   |
| `@eslint-community/eslint-plugin-eslint-comments` | Disable comment governance          |

### Dev (`devDependencies`)

| Package      | Purpose                 |
| ------------ | ----------------------- |
| `vitest`     | Test runner             |
| `tsup`       | Bundler                 |
| `typescript` | Type checking           |
| `eslint`     | Linting (self-hosted)   |
| `prettier`   | Formatting              |
| `knip`       | Dead code detection     |
| `publint`    | Package publishing lint |

### Peer

| Package  | Version  | Purpose                        |
| -------- | -------- | ------------------------------ |
| `eslint` | `^9.0.0` | Required by consuming projects |

---

## Test Structure

| Script             | Config                     | Includes             | Purpose               |
| ------------------ | -------------------------- | -------------------- | --------------------- |
| `test`             | `vitest.config.ts`         | `*.test.ts`          | Main suite (1300+)    |
| `test:release`     | `vitest.release.config.ts` | `*.release.test.ts`  | Dogfood parity gate   |
| `test:slow`        | `vitest.slow.config.ts`    | `*.slow.test.ts`     | Real package installs |
| `test:integration` | (default config)           | `tests/integration/` | Integration subset    |

All configs extend `vitest.base.ts` (sequential execution, `maxWorkers: 1`).

---

## Build & Distribution

```text
tsup → dist/
  ├── cli.js              # Executable entry (#!/usr/bin/env node)
  ├── index.js            # Library exports (VERSION, detect, eslint)
  ├── presets/typescript/  # ESLint preset (safeword/eslint)
  └── *.d.ts              # Type declarations
```

Published files: `dist/` + `templates/` (bundled for setup/upgrade).

**Publish gate:** `prepublishOnly` runs `test:release` (dogfood parity) then `build`.

---

## Key Decisions

### Settled Decisions (2025-12)

- **Graceful Linter Fallback:** Skip linter silently if not installed (`.nothrow().quiet()`). Hook should never block Claude's workflow. (`lint.ts`)
- **TOML Parsing Without Dependencies:** Line-based extraction for pyproject.toml. Only need `[tool.poetry]`/`[tool.uv]` detection — no TOML parser dependency. (`project-detector.ts`)
- **Ruff in Hook, mypy in Command Only:** Ruff is ms/file (safe for hooks); mypy is seconds/project (only runs via `/lint` command).

**Linter crash resilience:** `captureRemainingErrors()` reads stderr when stdout is empty on non-zero exit. This distinguishes "linter found no issues" from "linter crashed" (e.g., golangci-lint Go version mismatch). Crashes surface as warnings via the existing `warnings` array, not as lint errors. This prevents silent failures where a broken linter reports success.

**golangci-lint version check:** The lint hook checks `golangci-lint version --short` before running Go linting. Safeword generates v2 config format — v1 users get a clear warning with upgrade instructions instead of an opaque config parse error. The check runs once per session (cached via `toolWarnings` set).

**ESLint disable comment governance:** `@eslint-community/eslint-plugin-eslint-comments` enforces suppression hygiene: `disable-enable-pair` (block orphaned disables), `no-unlimited-disable` (require rule name), `require-description` (require `-- reason`), `no-duplicate-disable`, `no-unused-enable`. Combined with `reportUnusedDisableDirectives: 'error'` via `linterOptions` to catch stale disables.

**Schema drift prevention:** `.husky/pre-push` runs targeted tests (~60s) when `schema.ts` is modified in commits being pushed. Stop hook also appends a reminder when `git diff` shows schema.ts changes. Skippable with `git push --no-verify`.

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
| Remaining      | See `templates/skills/` for current list                                                                      |
| Implementation | Deprecated files listed in `packages/cli/src/schema.ts` deprecatedFiles/deprecatedDirs                        |

### Hard Block for Done Phase (Exit Code 2)

**Status:** Accepted
**Date:** 2026-01-07

| Field          | Value                                                                                                        |
| -------------- | ------------------------------------------------------------------------------------------------------------ |
| What           | Done phase in quality hook uses exit 2 (hard block) requiring evidence before completion                     |
| Why            | Prevents premature "done" claims; agent must show test/scenario/audit output                                 |
| Trade-off      | Slightly more friction at completion time                                                                    |
| Alternatives   | Soft block with reminder (rejected: too easy to ignore), no enforcement (rejected: allows false claims)      |
| Implementation | `packages/cli/templates/hooks/stop-quality.ts` - `hardBlockDone()` with evidence pattern matching            |
| Evidence       | Features require: `✓ X/X tests pass` + `All N scenarios marked complete` + `Audit passed`. Tasks: test only. |

### Hierarchy Navigation on Ticket Completion

**Status:** Accepted
**Date:** 2026-02-21

| Field          | Value                                                                                                                                                                    |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| What           | When done gate passes, stop hook walks the ticket tree: marks ticket done, cascades to parent if all siblings done, navigates to next undone sibling                     |
| Why            | Eliminates manual "what's next?" lookup; agent automatically continues with adjacent work without user prompt                                                            |
| Trade-off      | Stop hook now has side effects (writes ticket status); must mark current ticket done before calling findNextWork or it finds itself as undone sibling                    |
| Alternatives   | Manual navigation (rejected: interrupts flow), separate navigation command (rejected: requires user prompt)                                                              |
| Implementation | `.safeword/hooks/lib/hierarchy.ts` - pure functions `findNextWork`, `updateTicketStatus`, `resolveTicketDirectory`; called from `stop-quality.ts` after done gate passes |

**Navigation algorithm:**

1. Mark current ticket `status: done, phase: done`
2. Read parent's `children` array
3. Find first child where `status !== done` → `navigate` to that ticket
4. If all children done → `cascade-done`: mark parent done, recurse from parent
5. If no parent or tree exhausted → `all-done`: allow stop

**Zero-dependency YAML parser:** `hierarchy.ts` uses an inline `parseFrontmatter()` rather than the `yaml` npm package. Hooks run in user project context where `yaml` is not installed; inline parser avoids any runtime dependency.

### Continuous Quality Gates (LOC + Phase + TDD)

**Status:** Accepted
**Date:** 2026-02-07 (updated 2026-03-20: added phase access control, meta-path exemption, null→phase skip, shared active-ticket module)

| Field          | Value                                                                                                                                                       |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| What           | PostToolUse hook counts changed lines via `git diff --stat HEAD`, detects phase transitions, and detects TDD step transitions via test-definitions.md       |
| Why            | Prevents 1000-line PRs; forces commit discipline; phase gate prevents skipping BDD phases; TDD gates enforce RED→GREEN→REFACTOR review at each boundary     |
| Trade-off      | Adds ~50ms per tool call (git diff + ticket scan); state file in `.safeword-project/quality-state.json` must be cleaned on commit                           |
| Alternatives   | LOC check in stop hook only (rejected: too late), commit-prefix detection (rejected: convention-based, bypassable), manual discipline (rejected)            |
| Implementation | `packages/cli/templates/hooks/post-tool-quality.ts` + `pre-tool-quality.ts`; state in `.safeword-project/quality-state.json`; shared `lib/active-ticket.ts` |

**Gate types:**

- **LOC gate** (`loc`) — triggers when `git diff --stat HEAD` exceeds 400 LOC of project code; forces commit before more edits. Meta paths (`.safeword/`, `.claude/`, `.cursor/`, `.safeword-project/`) are excluded from the count via git pathspec, so setup/upgrade output doesn't inflate it.
- **Phase gate** (`phase:{name}`) — triggers on ticket phase transitions; uses `additionalContext` to reference `/quality-review` skill. Ticket creation (null→phase) is silent — only real transitions gate.
- **TDD gates** (`tdd:green`, `tdd:refactor`, `tdd:red`) — triggers when RED/GREEN/REFACTOR sub-checkboxes change in test-definitions.md during `implement` phase; uses `additionalContext` to reference `/tdd-review` skill

**Phase-based access control:** PreToolUse reads the active ticket's phase directly from ticket files (via `lib/active-ticket.ts`) and restricts code edits to `implement` phase only. Planning phases (intake, define-behavior, scenario-gate, decomposition) and done phase only allow edits to meta paths. No ticket or no in_progress ticket = no restriction.

**Meta-path exemption:** Files under `.safeword-project/`, `.safeword/`, `.claude/`, and `.cursor/` are always editable regardless of gates or phase. These are tooling/metadata, not application code. This prevents circular dependencies where a gate blocks editing the file that caused the gate.

**Active ticket resolution:** Session-scoped. Each session's state file (`quality-state-{session_id}.json`) tracks the `activeTicket` it's working on. Both `pre-tool-quality.ts` and `stop-quality.ts` read this session binding, then call `getTicketInfo()` to re-read the ticket's current phase and status from disk (stateless re-evaluation). This prevents cross-session blocking — tickets from other sessions are invisible. `getActiveTicket()` (global scan) is only used for hierarchy navigation after the done gate passes. Post-tool auto-clears `activeTicket` when the ticket reaches `done` or `backlog` status.

**TDD step detection:** PostToolUse watches `test-definitions.md` in ticket directories. Each scenario has three sub-checkboxes (`- [ ] RED`, `- [ ] GREEN`, `- [ ] REFACTOR`). The parser finds the first scenario with mixed checked/unchecked items and determines which step just completed. The act of marking a sub-checkbox IS the detection mechanism — the artifact is the single source of truth.

**`additionalContext` field:** PreToolUse deny output uses `additionalContext` (Claude Code v2.1.9+) to guide Claude toward skills. `permissionDecisionReason` explains WHY blocked; `additionalContext` tells WHAT TO DO. This prevents content drift — hooks reference skills by name, skills own the review content.

**Gate clearing:** All gates clear automatically when `git rev-parse --short HEAD` changes (i.e., a commit happened). No manual intervention needed. TDD gates have priority over LOC gate (LOC gate cannot overwrite an active TDD gate).

### Frozen Transcript Fixture Testing

**Status:** Accepted
**Date:** 2026-03-15

| Field          | Value                                                                                                                                                                                                      |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| What           | A checked-in JSONL fixture (`packages/cli/tests/fixtures/stop-hook-transcript.jsonl`) captures the real Claude Code v2.1.42 transcript wire format; CI runs the stop hook against it                       |
| Why            | The stop hook parses transcript JSONL to detect edits. If Anthropic changes the format (field names, nesting, content block types), the hook silently exits 0 instead of blocking — this test catches that |
| Trade-off      | Fixture must be manually updated when Claude Code's transcript format changes; no LLM API key required                                                                                                     |
| Alternatives   | Real E2E with live API (rejected: non-deterministic, expensive), hand-crafted simplified fixtures only (rejected: doesn't catch real format drift)                                                         |
| Implementation | `packages/cli/tests/integration/stop-hook-transcript-format.test.ts`; fixture includes thinking blocks, tool_use, tool_result, and real envelope fields (parentUuid, requestId, etc.)                      |

---

## References

- Language Pack Spec: `packages/cli/src/packs/LANGUAGE_PACK_SPEC.md`
- Ruff docs: https://docs.astral.sh/ruff/
- golangci-lint docs: https://golangci-lint.run/
- SQLFluff docs: https://docs.sqlfluff.com/
- Clippy docs: https://doc.rust-lang.org/stable/clippy/
- rustfmt docs: https://rust-lang.github.io/rustfmt/
- Cargo lints: https://doc.rust-lang.org/cargo/reference/manifest.html#the-lints-section
- PEP 621: https://peps.python.org/pep-0621/

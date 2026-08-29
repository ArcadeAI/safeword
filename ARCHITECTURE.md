# Safeword Architecture

**Version:** 1.23
**Last Updated:** 2026-08-29
**Status:** Production

---

## Table of Contents

- [Overview](#overview)
- [Monorepo Structure](#monorepo-structure)
- [Generated State and Human Decisions](#generated-state-and-human-decisions)
- [CLI Structure](#cli-structure)
- [Language Packs](#language-packs)
- [Language Detection](#language-detection)
- [Reconciliation Engine](#reconciliation-engine)
- [Dependencies](#dependencies)
- [Test Structure](#test-structure)
- [Build & Distribution](#build--distribution)
- [Migration & Evolution](#migration--evolution)
- [Key Decisions](#key-decisions)
- [References](#references)

---

## Overview

Safeword is a CLI tool that configures linting, hooks, and development guides for AI coding agent projects (Claude Code, Cursor, Codex, and OpenCode). It supports JavaScript/TypeScript projects (ESLint, Prettier), Python projects (Ruff, mypy), Go projects (golangci-lint), Rust projects (clippy, rustfmt), and dbt projects (SQLFluff).

### Tech Stack

| Category        | Choice             | Rationale                                                                              |
| --------------- | ------------------ | -------------------------------------------------------------------------------------- |
| CLI Runtime     | Bun                | Fast startup, TypeScript native                                                        |
| Relay Runtime   | Node 24 LTS        | Built-in SQLite support for the separately deployed relay without a native npm addon   |
| Package Manager | npm/bun            | Standard for JS ecosystem                                                              |
| JS Linting      | ESLint             | Industry standard, extensive rule set                                                  |
| Python Linting  | Ruff               | Fast, replaces flake8/black/isort                                                      |
| Go Linting      | golangci-lint      | Aggregates 100+ linters, fast                                                          |
| Rust Linting    | clippy             | 750+ lints, pedantic by default                                                        |
| Rust Formatting | rustfmt            | Deterministic, gofmt-style formatting                                                  |
| SQL Linting     | SQLFluff           | dbt-aware, Jinja templater support                                                     |
| Type Checking   | tsc / mypy         | Native type checkers for each language                                                 |
| Arch Validation | dependency-cruiser | Circular dep detection, layer rules (JS/TS)                                            |
| Arch Validation | import-linter      | Python cycle guard (acyclic_siblings) + layer contracts, scaffolded by the Python pack |
| Docs Rendering  | Astro/Mermaid      | Starlight documentation with versioned diagrams                                        |

---

## Monorepo Structure

```text
packages/
├── cli/            # Main CLI tool + ESLint configs (bunx safeword)
├── retro-collector/ # Credential-free public retrospective intake
├── retro-relay/    # Private retry-safe GitHub filing service
└── website/        # Documentation site (Astro/Starlight)
plugin/             # Claude Code plugin (commands, hooks) — not a workspace package; distributed via .claude-plugin/marketplace.json
```

| Package                     | Purpose                                                 | Published As |
| --------------------------- | ------------------------------------------------------- | ------------ |
| `packages/cli/`             | CLI + bundled ESLint configs (`safeword/eslint` export) | `safeword`   |
| `packages/retro-collector/` | Durable credential-free public retrospective intake     | Private      |
| `packages/retro-relay/`     | Durable, authenticated retro filing boundary            | Private      |
| `packages/website/`         | Documentation website                                   | Private      |

ESLint configs are bundled in the main package and accessed via `import safeword from "safeword/eslint"`.

### Public retrospective collector boundary

`packages/retro-collector` accepts released canonical `v1` single-finding bodies and
the CLI's canonical `v2` ordered finding batches without user registration or client
credentials. Current producers identify
Claude Code, Codex, or Cursor with `hostClass: "unknown"`; the collector also
accepts released Claude Code and Codex clients that used `hostClass: "local"`.
Cursor cannot claim that legacy local classification. The current v2 source does not
accept the released v1-only `userIdentity` field.

The collector validates each version's closed envelope and source schema and stores
the accepted raw body unchanged in SQLite. Duplicate identity is derived only from
harness, project UUID, session identity, and (after the compatibility-preserving
first window) transcript window; byte-identical retries in that scope reuse its
receipt, while unequal raw bytes conflict. Operator reads require the
server-side operator credential; project
UUIDs, request IDs, receipts, and source fields grant no read or filing
authority. This public intake is separate from the authenticated private relay
below.

### Retro relay boundary

`packages/retro-relay` is deliberately separate from the published CLI.
Public relay routing remains compiled off until the readiness evidence below
is satisfied.

**Identity.** The gated shared CLI core sends the same
tenant/installation/repository/request-ID identity from every harness surface
(Claude, Codex, Cursor). Which harness or subject made the call is used only
for authorization and audit — it is never part of that identity.

**Storage.** SQLite WAL is the smallest supported durable store for one
active process on one host; multi-host deployment or a network filesystem
requires migrating through the store boundary to PostgreSQL. The relay uses
Node's built-in `node:sqlite` API, so contributors and deploys need no host
compiler or native-addon prerequisites. A separate SQLite lock database holds
one exclusive transaction for the life of the process — if the process
crashes, the operating system releases that lock automatically, with no PID
files or stale-lock cleanup needed.

**Deployment.** The Railway deployment profile fixes one replica and one
persistent `/data` volume. Readiness must query SQLite's schema version. A
random per-process boot ID proves that an in-place restart replaced the
process; `RAILWAY_REPLICA_ID` identifies the hosted replica but may stay
stable across a restart, so it is not a restart oracle.

**Payload handling.** The relay stores request payloads only as AES-256-GCM
envelopes and keeps GitHub App credentials server-side. When a create
request's outcome is ambiguous, the relay quarantines it until a privileged
reconciliation step finds exactly one reserved marker in a complete raw REST
issue-body scan — sanitized MCP reads are never duplicate authority. The
client supplies one absolute creation-plus-24-hour retry deadline, which the
server persists and may shorten but never extend, followed by one-hour
dispatch grace, 30-day filed-payload retention, and indefinite tombstones; the
timed maintenance worker persists its retry schedule and terminal alert
outbox in the same database. With #1474 and #1481 complete, canonical/legacy
semantic adoption and cross-request aliasing remain unbuilt until the
post-fix collision rates are remeasured and bound into the readiness
evidence.

**Durability guarantees before transport:**

- The CLI writes one immutable file containing the exact serialized request bytes and a UUIDv4 request ID before transport.
- Relay routing requires an explicit absolute `SAFEWORD_RETRO_RELAY_OUTBOX` outside the project workspace — there is no inferred cross-provider cloud persistence.
- Claude, Codex, Cursor, and their cloud surfaces can claim and resend those bytes only when they share that operator-provided durable handoff; without it, routing stays on the native path.
- The outbox is resolved physically, so an external-looking symlink cannot alias back into the disposable project.
- Harness identity is never part of request identity.
- File contents, newly created spool-directory entries, and containing-directory mutations are synced before durable success is reported, and atomic rename fences concurrent claims.
- An atomic acknowledgement journal is authoritative before recoverable payload cleanup, so a crash cannot convert an unknown relay response into permission for native GitHub fallback.
- The immutable record carries its creation time and shared 24-hour retry deadline; expiry moves it to a visible local dead letter.
- Locally, a hashed session, delta-window boundary, and encounter slot correlates retries to that record while allowing later fires and unrelated findings to spool independently; it is stripped before transport and is never server-side semantic or duplicate authority.

**Production authentication and limits:**

- Separate repository-scoped `file` principals for Claude, Codex, and Cursor, plus a `reconcile`/`operate` principal for operators.
- Bounded request bodies and fields, UUIDv4 request identity.
- Ten-second inbound/GitHub timeouts.
- Bounded GitHub concurrency and reconciliation scans.
- Coalesced installation-token minting.
- A per-principal filing/reconciliation rate limit.

The single-principal Railway spike configuration is limited to serving health
checks — it cannot file to GitHub yet. Relay routing is compiled fail-closed
until parsed versioned metric evidence has a nonempty sample, immutable
artifact hashes, and Git ancestry bind the evidence to the running build. Its
drain-throughput evidence is a regression floor: at least 300 queued
requests, at least 80 ms relay latency, at least two acceptances in one
bounded drain, and total drain duration below one second. #1474 and #1481 are
complete prerequisites; their resulting measurements still gate activation.
Issue #834 remains active; #1495 gates readiness only if client credential
helpers are reused.

---

## Generated State and Human Decisions

Safeword intentionally keeps two architecture genres separate:

| Document                               | Authority                                              | What it contributes                                                                                                                   |
| -------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| `.project/architecture.generated.md`   | Machine-owned monorepo index                           | Workspace package inventory, package purposes, dependency edges, coverage gaps, and a freshness fingerprint                           |
| `packages/*/architecture.generated.md` | Machine-owned structure plus human-owned purpose prose | Current top-level source modules, resolving paths, per-module purposes, and visible stale/orphan markers                              |
| `ARCHITECTURE.md`                      | Human-owned decision record                            | System context, runtime and data flows, invariants, rationale, trade-offs, rejected alternatives, and migration/reassessment guidance |

### Reverse-authoring adequacy

The generated state is the structural evidence floor for this document, not a complete replacement for it. It is deliberately sufficient to detect missing, renamed, or orphaned packages/modules. It cannot by itself supply a good architecture narrative because several required inputs are not structural facts:

| Authoring need                                | Generated state                                  | Additional source of truth                                                |
| --------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------- |
| Package and top-level module inventory        | Complete when no coverage-gap marker is present  | Generated root and leaf documents                                         |
| Inter-package dependency direction            | Complete for parsed workspace manifests          | Root generated document and workspace manifests                           |
| Module responsibility                         | Human prose; may be placeholder or visibly stale | Module entry points and package leaf prose                                |
| Public commands, effects, and exit semantics  | Not represented                                  | `src/cli-protocol/catalog.ts`, JSON schema, and executable protocol tests |
| Reconciliation ownership and mutation rules   | Not represented                                  | `src/schema.ts`, `src/reconcile.ts`, and reconciliation tests             |
| Runtime/event flows and external integrations | Not represented                                  | Command/hook entry points, manifests, workflows, and integration tests    |
| Why, trade-offs, alternatives, and migrations | Not derivable safely                             | This document and the accepted ticket/design history                      |

Therefore a reverse-written `ARCHITECTURE.md` must start from every generated node, then reconcile it with the CLI catalogue, schema, boundary configuration, package manifests, release workflows, and accepted design records. Treating the generated map alone as sufficient would turn current structure into invented rationale.

---

## CLI Structure

### Registry-Driven Agent Integrations with Native Trust Boundaries

**Status:** Accepted
**Date:** 2026-08-25

| Field          | Value                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Context        | Claude, Codex, Cursor, and OpenCode expose different project assets, profile operations, lifecycle events, and execution proof. The lifecycle coordinator previously encoded host names directly, making each new integration another cross-cutting branch.                                                                                                                                                                                                                                                                                                                             |
| Decision       | A typed integration registry declares each agent's project surfaces, profile operations, lifecycle capabilities, activation evidence, and conformance policy. The project reconciliation surface remains first; selected adapters follow registry declaration order. Native adapter modules retain host-specific trust, migration, and proof semantics. OpenCode uses a managed stable-1.x profile plugin and exact-version real-process conformance; its project catalogue reuses `.claude/skills` compatibility discovery plus generated `.opencode/commands` and `.opencode/agents`. |
| Consequences   | Coordinator logic becomes integration-neutral and contract tests can reject missing dimensions, capability overstatement, duplicate identity, and skipped registry entries. Shared project assets are reconciled by aggregate consumers. Adding an adapter does not imply equal native enforcement: unsupported or observational boundaries remain explicit in status.                                                                                                                                                                                                                  |
| Alternatives   | Add OpenCode branches to each lifecycle command: rejected because ownership and status logic would keep drifting. Flatten all hosts into one runtime: rejected because it would erase native trust and migration guarantees. Restore `.agents/skills`: rejected because Safeword-owned project copies were deliberately retired for Codex.                                                                                                                                                                                                                                              |
| Reassess when  | A host exposes a common signed plugin/evidence protocol, OpenCode V2 becomes stable, or the registry cannot express a new integration without host-name branching.                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Implementation | Ticket `ZM38A2`; `packages/cli/src/lifecycle/integrations.ts`, native plugin modules, schema filters, adapter contract tests, and `packages/cli/features/opencode-parity.feature`.                                                                                                                                                                                                                                                                                                                                                                                                      |

The generated package leaf is the current structural inventory. These purposes explain how its top-level modules fit together:

| Module                   | Responsibility                                                                                         |
| ------------------------ | ------------------------------------------------------------------------------------------------------ |
| `boundary`               | Evaluates architectural boundary evidence and dependency policy                                        |
| `cli.ts`                 | Executable composition root that registers public, compatibility, and hidden hook commands             |
| `cli-protocol`           | Typed command catalogue, policy, plan/result envelopes, rendering, and execution adapters              |
| `codex-plugin`           | Profile plugin catalogue, installation, proof, legacy authority, migration, finalization, and recovery |
| `commands`               | Domain command handlers for setup, status, removal, project workflows, Codex, tickets, and retros      |
| `cursor-wrappers.ts`     | Generates thin Cursor command/rule wrappers from canonical workflow templates                          |
| `health.ts`              | Aggregates configuration, path, coverage, version, and integration health findings                     |
| `index.ts`               | Stable library exports for version, detection, reconciliation, and ESLint consumers                    |
| `learning-sync`          | Builds deterministic discovery indexes over project learnings                                          |
| `owned-paths.ts`         | Derives writable top-level path prefixes from the schema                                               |
| `packs`                  | Detects languages and installs language-native files, packages, and setup behavior                     |
| `parity.ts`              | Enforces template/dogfood/generated catalogue pairs and one-way content contracts                      |
| `presets`                | Publishes conditional TypeScript/JavaScript ESLint presets                                             |
| `reconcile.ts`           | Computes and executes idempotent file, JSON, text-patch, permission, and dependency plans              |
| `retro`                  | Sanitizes, deduplicates, triages, reconciles, and files retrospective findings                         |
| `schema.ts`              | Single source of truth for owned, managed, preserved, deprecated, merged, and patched assets           |
| `self-report-capture.ts` | Accepts bounded CLI-side self-observation events for retrospective analysis                            |
| `skills`                 | Installs optional third-party language coding skills without owning Safeword workflows                 |
| `templates`              | Produces dynamic configuration and legacy-cleanup content used by reconciliation                       |
| `test-plan`              | Resolves and renders the canonical test/build/typecheck/BDD/dependency plan for a project              |
| `ticket-create`          | Routes ticket creation between local identifiers and issue-first tracker identities                    |
| `ticket-sync`            | Builds active and completed ticket-corpus discovery indexes                                            |
| `tracker-connect`        | Configures tracker identity, credentials, secret storage, and handoff state                            |
| `tracker-sync`           | Plans and applies one-way projection from local tickets to GitHub or Linear                            |
| `upstream-monitor`       | Tracks upstream agent-CLI release signals, and issues gating workaround removal, for review            |
| `utils`                  | Shared architecture, manifest, filesystem, Git, path, detection, Gherkin, and ticket primitives        |
| `version.ts`             | Reads the release version from package metadata                                                        |

Shipped assets live beside the source: `templates/` is the canonical project-local payload, while `codex-plugin/` is the generated profile-scoped plugin bundle. `packages/cli/architecture.generated.md` remains the source of structural truth when this table is reviewed.

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
  "installedPacks": ["python", "typescript", "golang", "rust"]
}
```

> `.safeword/version` (plaintext, regenerated every reconcile) is the source of truth for installed safeword version. `config.json` previously also carried a `version` field, but it was write-once / never-read and was removed in ticket 154.

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

### ESLint Plugin Configuration

Safeword bundles 20+ ESLint plugins organized into three tiers. All rules use `error` severity — LLMs ignore warnings.

**Base Plugins (always included):**

| Plugin                     | Purpose                             |
| -------------------------- | ----------------------------------- |
| sonarjs                    | Bug detection, cognitive complexity |
| security                   | Security anti-patterns              |
| unicorn                    | Modern JS/TS idioms                 |
| import-x                   | Import/export validation            |
| simple-import-sort         | Auto-fixable import ordering        |
| import-resolver-typescript | TypeScript path alias resolution    |
| regexp                     | Regex optimization                  |
| promise                    | Promise anti-patterns               |
| jsdoc                      | Documentation enforcement           |
| eslint-comments            | Disable comment governance          |

**Framework Plugins (conditional — included when framework detected in `package.json`):**

| Plugin                      | Detection                         | Peer Dep                        |
| --------------------------- | --------------------------------- | ------------------------------- |
| @eslint-react/eslint-plugin | `detectFramework()` returns react | `node: >=22.0.0`                |
| react-hooks                 | `detectFramework()` returns react | —                               |
| jsx-a11y                    | `detectFramework()` returns react | —                               |
| @next/eslint-plugin-next    | `detectFramework()` returns next  | —                               |
| astro                       | `detectFramework()` returns astro | —                               |
| storybook                   | `hasStorybook(deps)`              | `storybook: ^10.3.5`            |
| tanstack-query              | `hasTanstackQuery(deps)`          | `typescript: ^5.0.0` (optional) |
| tailwind                    | `hasTailwind(deps)`               | —                               |
| turbo                       | `hasTurbo(deps)`                  | `turbo: >2.0.0`                 |

React framework configs use `@eslint-react/eslint-plugin` for React, JSX, DOM,
RSC, and web API guardrails. `eslint-plugin-react-hooks` remains the official
source for Hooks and React Compiler diagnostics; legacy `eslint-plugin-react` is
not bundled.

`@eslint-react/no-duplicate-key` is intentionally enabled for agent guardrail
parity even though upstream marks it experimental. Keep
`@eslint-react/eslint-plugin` exact-pinned until that rule is stable or the
guardrail is replaced, so minor package updates cannot silently change the
published React preset.

**Tooling Plugins (conditional — included when test runner detected):**

| Plugin     | Detection             | Peer Dep    |
| ---------- | --------------------- | ----------- |
| vitest     | `hasVitest(deps)`     | `vitest: *` |
| playwright | `hasPlaywright(deps)` | —           |

**Config hierarchy** (each extends the previous): `recommended` (JS) → `recommendedTypeScript` → `recommendedTypeScriptReact` → `recommendedTypeScriptNext`

**Implementation:** `packages/cli/src/presets/typescript/eslint-configs/`, `packages/cli/src/presets/typescript/detect.ts`

---

## Reconciliation Engine

The reconciliation engine (`src/reconcile.ts`) is the core of project-configuration file ownership. Setup, convergence, and removal compute plans from the schema rather than copying trees blindly. Domain workflows such as ticket/tracker sync and generated indexes own their narrower state through dedicated modules, but still enter through the typed CLI protocol and report completed effects explicitly.

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

A `managedFiles` entry may also carry an optional `configKey` (`'personas' | 'glossary' | 'architecture'`). When the user sets the matching `paths.<configKey>` in `.safeword/config.json`, reconcile suppresses the entry uniformly — install skips the scaffold, `uninstall-full` skips the removal. The user-configured path becomes the single source of truth; the default location is no longer safeword's concern (ticket K7N2QM).

### Reconciliation Modes

| Mode             | Behavior                                         |
| ---------------- | ------------------------------------------------ |
| `install`        | Create dirs, write files, merge JSON, patch text |
| `upgrade`        | Remove deprecated, update owned, create missing  |
| `uninstall`      | Remove safeword-managed files and dirs           |
| `uninstall-full` | Also remove generated configs (ESLint, Prettier) |

**Key property:** Idempotent. Running the same mode twice produces the same result.

### Install Convergence Flow

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

| Package                                           | Purpose                                                                                    |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `commander`                                       | CLI argument parsing                                                                       |
| `yaml`                                            | YAML config parsing (failsafe mode)                                                        |
| `smol-toml`                                       | TOML parse/validate for Codex config migration (`migrate-codex-plugin.ts`)                 |
| `jsonc-parser`                                    | Source-range edits that preserve unrelated Claude settings comments and formatting         |
| `@secretlint/core`                                | Retro egress: in-process secret detection over a raw string (returns spans)                |
| `@secretlint/secretlint-rule-preset-recommend`    | Retro egress: maintained provider-key rule-packs (28 formats) layered over the regex floor |
| `@cucumber/gherkin`                               | Gherkin parse engine for `lint-gherkin` and `.feature` scenario-source validation          |
| `@cucumber/messages`                              | Gherkin AST message types consumed alongside the parser                                    |
| `@eslint/js`                                      | ESLint core rules                                                                          |
| `typescript-eslint`                               | TypeScript ESLint parser + rules                                                           |
| `eslint-config-prettier`                          | Disable formatting rules                                                                   |
| `@eslint-react/eslint-plugin`                     | React, JSX, DOM, RSC, and web API rules                                                    |
| `eslint-plugin-*`                                 | Other ESLint plugins (see plugin table above)                                              |
| `@eslint-community/eslint-plugin-eslint-comments` | Disable comment governance                                                                 |

### Dev (`devDependencies`)

| Package      | Purpose                                                        |
| ------------ | -------------------------------------------------------------- |
| `vitest`     | Test runner                                                    |
| `tsup`       | Bundler                                                        |
| `typescript` | Type checking                                                  |
| `eslint`     | Linting (self-hosted)                                          |
| `prettier`   | Formatting                                                     |
| `jiti`       | Load TypeScript ESLint config files from generated hook config |
| `knip`       | Dead code detection                                            |
| `publint`    | Package publishing lint                                        |

### Peer

| Package  | Version   | Purpose                        |
| -------- | --------- | ------------------------------ |
| `eslint` | `^10.4.0` | Required by consuming projects |

---

## Test Structure

| Script                    | Config                     | Includes                                                                                                 | Purpose                                                      |
| ------------------------- | -------------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `test`                    | `vitest.config.ts`         | `*.test.ts`                                                                                              | Default unit and integration suite                           |
| `test:smoke`              | default config             | Named fast and integration smoke files                                                                   | Broader pre-merge smoke validation                           |
| `test:smoke:live`         | `vitest.live.config.ts`    | `*.live.test.ts`                                                                                         | Live-model smoke validation                                  |
| `test:release`            | `vitest.release.config.ts` | `*.release.test.ts`                                                                                      | Package, supply-chain, schema, and dogfood release contracts |
| `test:slow`               | `vitest.slow.config.ts`    | `*.slow.test.ts`                                                                                         | Real package installs                                        |
| `test:slow:install-proof` | `vitest.slow.config.ts`    | `non-git-install-proof.slow.test.ts`                                                                     | Focused physical dependency-install proof                    |
| `test:integration`        | default config             | `tests/integration/`                                                                                     | Integration subset                                           |
| `test:bdd`                | `cucumber.mjs`             | `features/**/*.feature` + workspace `*/features/**/*.feature` + configured `paths.features` dir (56JCFZ) | Gherkin acceptance lane (cucumber-js, 102a)                  |

The Vitest lanes extend `vitest.base.ts` and use up to three workers. `test:bdd` is a **separate runner**: cucumber-js executes `.feature` files with TypeScript step defs (loaded via `tsx/esm`). Unit/integration stay in vitest (which globs only `*.test.ts`); the acceptance lane and the unit suite partition the tree, neither double-runs a spec.

The lane is also **core customer scaffolding** (102b): `safeword install` writes the same shape into every project — `cucumber.mjs` (safeword-owned), `features/` + `steps/` starters (customer-owned after creation), `@cucumber/cucumber` + `tsx` as conditional packages, and a `test:bdd` script (add-if-absent). A repo with no `package.json` (pure Go/Rust/Python) gets a minimal private one created to host the lane, and the TS toolchain comes along so the lane's step files are themselves linted (Option A, ticket 102b). **Unless the repo already has its own cucumber harness** (56JCFZ, issue #645): installation detects host cucumber configs/deps (excluding safeword's own template revisions, hash-registered in `cucumber-template-revisions.ts`), suppresses the entire starter lane, and points the user at `paths.features`/`paths.steps` — which all readers (`project codify` / `project lint-gherkin` / `doctor` via `feature-source.ts`) and the scaffolded runner consume as augment-not-replace. `safeword doctor` carries the persistent misalignment advisories; removal never removes host-owned harness pieces.

---

## Build & Distribution

```text
tsup → dist/
  ├── cli.js              # Executable entry (#!/usr/bin/env node)
  ├── index.js            # Library exports (VERSION, detect, eslint)
  ├── presets/typescript/  # ESLint preset (safeword/eslint)
  └── *.d.ts              # Type declarations
```

Published files: `dist/` + `schemas/` + `templates/` (bundled for setup convergence) + `codex-plugin/` (bundled for Codex plugin install).

**Publish path:** an annotated `v*` tag triggers `.github/workflows/release.yml`. Its unprivileged build job installs from the frozen lockfile, builds, runs the release-contract suite, and packs the tarball. A separate minimal OIDC job downloads that artifact and runs `npm publish --provenance --ignore-scripts`. The local `prepublishOnly` hook (tag check → release tests → build) remains defense in depth, not the canonical release path.

---

## Migration & Evolution

- **Unified installation:** `safeword install` converges the current project and installs Claude plus Codex by default. `--agents` narrows the selected integrations; Cursor is included only when explicitly selected. `safeword setup` remains a hidden, indefinitely retained compatibility alias. Schema ownership categories determine whether an asset is replaced, merged, created only when absent, preserved, or removed.
- **Public CLI:** canonical commands are catalogued with stable typed effects and schema-versioned JSON. Hidden compatibility aliases remain through the documented 0.71 window and emit machine-readable deprecation findings.
- **Codex delivery:** migration follows Expand → Prove → Contract. Profile-plugin proof must cover the running hook manifest before legacy project protection can be finalized; fingerprinted backup and recovery protect interrupted transitions.
- **Generated architecture:** fingerprints migrate structural state deterministically. Machine-owned fields heal from source and manifests; human purpose prose survives and is marked stale when it needs semantic review.
- **Architecture decisions:** update accepted decisions in place. Mark superseded choices explicitly, keep their original rationale, and record the replacement and reassessment trigger rather than creating detached ADR files.

---

## Key Decisions

### Settled Decisions (2025-12)

- **Graceful Linter Fallback:** Skip linter silently if not installed (`.nothrow().quiet()`). Hook should never block Claude's workflow. (`lint.ts`)
- **TOML Parsing — line-based for detection, `smol-toml` for Codex config:** pyproject.toml detection uses line-based extraction; it only needs `[tool.poetry]`/`[tool.uv]` and pulls in no TOML parser (`project-detector.ts`). Codex plugin migration is the one exception — it uses `smol-toml` to validate config parseability before its line-based hook surgery (`migrate-codex-plugin.ts`).
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

| Field          | Value                                                                                                                                                                                                                                                        |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| What           | TDD (RED→GREEN→REFACTOR) is inline in BDD skill Phase 6, not a separate handoff                                                                                                                                                                              |
| Why            | Skill-to-skill handoffs are unreliable; agent memory doesn't guarantee the delegated skill will be invoked                                                                                                                                                   |
| Trade-off      | BDD skill is larger; standalone TDD skill and `/tdd` command removed                                                                                                                                                                                         |
| Alternatives   | Separate TDD skill with handoff (rejected: soft enforcement), subagent delegation (rejected: model-mediated depth and tool availability do not guarantee the workflow handoff)                                                                               |
| Implementation | `packages/cli/templates/skills/bdd/` — TDD runs in the `implement` phase (`TDD.md`); the skill was later split from one `SKILL.md` into per-phase files (DISCOVERY / SCENARIOS / TDD / VERIFY / DONE / SPLITTING), see the 2026-05-31 Phase 0 decision below |

### Skill Consolidation (Removed Redundant Skills)

**Status:** Accepted
**Date:** 2026-01-09

| Field          | Value                                                                                                         |
| -------------- | ------------------------------------------------------------------------------------------------------------- |
| What           | Removed standalone TDD, brainstorming, and writing-plans skills; consolidated into BDD orchestration          |
| Why            | BDD skill's discovery phase covers brainstorming; Phase 6 includes full TDD; Claude Code has native plan mode |
| Trade-off      | Less granular skill invocation; users must use `/bdd` for structured workflows                                |
| Removed        | `safeword-tdd-enforcing`, `safeword-brainstorming`, `safeword-writing-plans` skills; `/tdd` command           |
| Remaining      | See `templates/skills/` for Claude Code and `packages/cli/codex-plugin/skills/` for Codex plugin skills       |
| Implementation | Deprecated files listed in `packages/cli/src/schema.ts` deprecatedFiles/deprecatedDirs                        |

### Hard Block for Done Phase (Exit Code 2)

**Status:** Accepted
**Date:** 2026-01-07

| Field          | Value                                                                                                                                                                                                                                 |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| What           | Done phase in quality hook uses exit 2 (hard block) requiring evidence before completion                                                                                                                                              |
| Why            | Prevents premature "done" claims; agent must show test/scenario/audit output                                                                                                                                                          |
| Trade-off      | Slightly more friction at completion time                                                                                                                                                                                             |
| Alternatives   | Soft block with reminder (rejected: too easy to ignore), no enforcement (rejected: allows false claims)                                                                                                                               |
| Implementation | `packages/cli/templates/hooks/stop-quality.ts` - `hardBlockDone()` with evidence pattern matching; GFM checkbox predicate extracted to `.safeword/hooks/lib/scenario-format.ts` (`analyzeScenarioFormat`) for direct unit testability |
| Evidence       | Features require: `✓ X/X tests pass` + `All N scenarios marked complete` + `Audit passed`. Tasks: test only.                                                                                                                          |

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

| Field          | Value                                                                                                                                                                                    |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| What           | PostToolUse hook counts changed lines via `git diff --stat HEAD` and binds `activeTicket` on ticket.md edits. Phase and TDD step are derived at read time from ticket files, not cached. |
| Why            | Prevents 1000-line PRs; forces commit discipline. Phase/TDD derivation avoids stale cache in multi-session/multi-developer scenarios.                                                    |
| Trade-off      | Adds ~50ms per tool call (git diff + ticket scan); per-session state in `<namespace-root>/quality-state-{sessionId}.json`                                                                |
| Alternatives   | LOC check in stop hook only (rejected: too late), commit-prefix detection (rejected: convention-based, bypassable), manual discipline (rejected)                                         |
| Implementation | `packages/cli/templates/hooks/post-tool-quality.ts` + `pre-tool-quality.ts`; per-session state files; shared `lib/active-ticket.ts` (includes `deriveTddStep()`)                         |

**Gate types:**

- **LOC gate** (`loc`) — triggers when `git diff --stat HEAD` exceeds 400 LOC of project code; forces commit before more edits. Meta paths (`.safeword/`, `.claude/`, `.cursor/`, and the resolved namespace root—`.project/` by default, legacy `.safeword-project/`) are excluded from the count via git pathspec, so setup convergence output doesn't inflate it.
- **Phase reminders** — prompt hook derives current phase from ticket.md via `getTicketInfo()` and injects phase-specific one-liner each turn. No blocking gate — guidance only.
- **TDD step reminders** — prompt hook derives TDD step from test-definitions.md via `deriveTddStep()` during `implement` phase. Shows RED/GREEN/REFACTOR status each turn.

**Phase-based access control:** PreToolUse reads the active ticket's phase directly from ticket files (via `lib/active-ticket.ts`) and restricts code edits to `implement` phase only. Planning phases (intake, define-behavior, scenario-gate) and done phase only allow edits to meta paths. No ticket or no in_progress ticket = no restriction.

**Meta-path exemption:** Files under the resolved namespace root, `.safeword/`, `.claude/`, and `.cursor/` are always editable regardless of gates or phase. These are tooling/metadata, not application code. This prevents circular dependencies where a gate blocks editing the file that caused the gate.

**Active ticket resolution:** Session-scoped. Each session's state file (`quality-state-{session_id}.json`) tracks the `activeTicket` it's working on. Both `pre-tool-quality.ts` and `stop-quality.ts` read this session binding, then call `getTicketInfo()` to re-read the ticket's current phase and status from disk (stateless re-evaluation). This prevents cross-session blocking — tickets from other sessions are invisible. `getActiveTicket()` (global scan) is only used for hierarchy navigation after the done gate passes. Post-tool auto-clears `activeTicket` when the ticket reaches `done` or `backlog` status.

**TDD step detection:** PostToolUse watches `test-definitions.md` in ticket directories. Each scenario has three sub-checkboxes (`- [ ] RED`, `- [ ] GREEN`, `- [ ] REFACTOR`). The parser finds the first scenario with mixed checked/unchecked items and determines which step just completed. The act of marking a sub-checkbox IS the detection mechanism — the artifact is the single source of truth.

**`additionalContext` field:** PreToolUse deny output uses `additionalContext` (Claude Code v2.1.9+) to guide Claude toward skills. `permissionDecisionReason` explains WHY blocked; `additionalContext` tells WHAT TO DO. This prevents content drift — hooks reference skills by name, skills own the review content.

**Quality review cadence (SXSCJQ; implement-step reviews quieted by JENFZX):** The quality review fires at phase boundaries, not on a LOC throttle. PostToolUse surfaces a phase-appropriate review (`getQualityMessage`) as `additionalContext` on each `phase:` change in `ticket.md` — at the edit, so it works in long autonomous runs where the Stop hook never fires. Ordinary implement-step (RED/GREEN/REFACTOR) reviews no longer surface per step; they are folded into the whole-ticket review at the implement→verify exit (JENFZX). The Stop hook is a deduped backstop: it reviews per phase, but only for a boundary not already marked (`lastReviewedPhase` in session state). With no resolvable ticket phase — no active ticket, or one in a status escape hatch — a generic review is recorded once per user-prompt boundary: `stopQualityReviewAwaitingUserPrompt` keeps later idle Stops silent until `UserPromptSubmit` clears it, while typecheck, phase, and done gates remain independent. The former implement-phase LOC review throttle (`LOC_REVIEW_THRESHOLD`) is removed. Shared decision logic lives in `lib/review-trigger.ts` (`shouldReviewPhase`); checkbox-flip detection in `lib/checkbox-transitions.ts`.

**Cross-agent Stop delivery (JN403D/P30CRP):** Claude Code keeps the hard done-gate/review behavior in `stop-quality.ts`. Cursor uses a lighter local Stop adapter for continuation nudges (`cursor/stop.ts` appends `followup_message`). Codex uses the profile-scoped Safeword plugin, whose hook manifest calls the packaged, version-pinned `bunx --bun safeword@<version> hook codex stop` entrypoint. It emits Codex continuation output (`decision: "block"`, `reason`) from queued project context. Codex Stop delivery is advisory continuation, not hard done-gate enforcement.

**Codex Desktop session identity (S2CWBE):** Hook payload `session_id` and a
fresh Codex proof-bridge cache remain the preferred sources. When Codex Desktop
code-mode does not deliver the documented PreToolUse bridge, the shared
run-identity resolver may use non-empty `CODEX_THREAD_ID` as a Codex-only,
session-stable fallback. This comes after explicit and cached identities, never
uses `turn_id`, and is unavailable to explicit Claude and Cursor callers. The
single resolver is shared by invocation proof, review-stamp session binding,
and Codex Stop so all three address the same state key.

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

### Product-Framing Layer in BDD Phase 0 (JTBD / Personas / Rules)

**Status:** Accepted
**Date:** 2026-05-31

| Field          | Value                                                                                                                                                                                                                                                                                                                                                                                                  |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| What           | BDD Phase 0 (`intake`) now writes a per-ticket `spec.md` with persona-anchored Jobs To Be Done → numbered Rules (Acceptance Criteria remain as the soft-deprecated legacy alternative) → engineering scope, backed by a project glossary and personas file. Scenarios carry lineage `<slug>.<persona><JTBD#>.R<#>.<scenario>` (or `.AC<#>` on the legacy path) so coverage gaps are machine-checkable. |
| Why            | Engineering scope (`scope` / `out_of_scope` / `done_when`) captured _what_ to build but not _who_ for or _why_; product framing anchors scenarios to verifiable criteria and lets `safeword doctor` flag uncovered rules and orphan scenarios.                                                                                                                                                         |
| Trade-off      | Longer intake for features; Phase 0 advances through structured signoff sub-gates (orientation → JTBD → Rules → scope) rather than one step.                                                                                                                                                                                                                                                           |
| Alternatives   | Keep engineering-only scope (rejected: no product framing); separate product skill with handoff (rejected: skill-to-skill handoffs unreliable — same reasoning as the BDD+TDD merge above).                                                                                                                                                                                                            |
| Implementation | `packages/cli/templates/skills/bdd/DISCOVERY.md` (Phase 0 sub-phases + worked example), `SCENARIOS.md` (lineage numbering), `spec-template.md`, glossary/persona `managedFiles` entries; per-file path overrides via `.safeword/config.json` `paths.*` (ticket K7N2QM). Epic DZ2NM5.                                                                                                                   |

### Canonical Persona Codes with Legacy Lineage Compatibility

**Status:** Accepted
**Date:** 2026-07-13 (updated 2026-07-14: explicit new codes may use 2–4 letters)

| Field          | Value                                                                                                                                                                                                                                                                                                                                                                                                     |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| What           | Newly derived persona codes use deterministic 3–4 character identifiers across the CLI and installed JTBD hook; collisions receive a bounded numeric suffix. Explicitly authored new codes may use 2–4 characters, so natural acronyms such as `PO` remain available. Persisted 5–6 character codes and former derived aliases continue to resolve for compatibility.                                     |
| Why            | Three-character automatic defaults avoid ambiguous initials without forbidding a builder from choosing an obvious two-letter acronym. Separating automatic and explicit bounds improves default readability while preserving user judgment and historical lineage.                                                                                                                                        |
| Trade-off      | Explicit two-letter codes can collide or be less recognizable, so the author owns that choice. The resolver also carries a small legacy-alias path, and the CLI and standalone installed hook deliberately duplicate the pure derivation policy because deployed hooks cannot import the CLI distribution. Exhausting the four-character collision namespace requires an explicit 2–4 character override. |
| Alternatives   | Auto-generate 2–4 characters (rejected: recreates ambiguous initials by default); enforce 3–4 characters for every explicit code (rejected: forbids natural acronyms and breaks history); accept 2–6 as equally recommended (rejected: weakens concise lineage guidance); bulk-rename historical Gherkin tags (rejected: destroys stable traceability).                                                   |
| Implementation | `packages/cli/src/utils/personas.ts`, `packages/cli/templates/hooks/lib/jtbd.ts`, `packages/cli/templates/personas-template.md`, and BDD authoring templates. The repo's current persona catalog uses `TBU`, `NTB`, and `SWM`; existing historical `TB` and `SM` references resolve through compatibility aliases. Ticket FAJV19.                                                                         |

### BDD as a Solo-Agent Adaptation of the Three-Practice Model (retire `decomposition` phase)

**Status:** Accepted — planning-beat placement superseded by "plan-implementation: a gated planning phase" (2026-07-09, below); the solo-agent adaptation rationale stands
**Date:** 2026-06-02

| Field          | Value                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| What           | safeword's `bdd` workflow is explicitly an adaptation of canonical BDD's three practices — Discovery → Formulation → Automation — for a **single agent + one human**, not a team: the agent plays all three "Three Amigos" roles. As part of aligning to that model, the `decomposition` phase is retired as a distinct beat — its only scenario-dependent job (per-scenario test-layer assignment + build order) folds into the `scenario-gate` exit, and its overlapping jobs (component identification, design-doc/ADR triggers) stay in `intake`, where they already happen.                                                                                                                                                 |
| Why            | (1) Canonical BDD has no breakdown phase — decomposition is foreign to the model safeword is built on. (2) It is the only phase with no gate and no required artifact, so agents skip it and nothing notices. (3) ~75% of its work duplicates intake's architecture step (chain audit, epic EECVXB). Retiring it makes the pipeline match the canonical Discovery→Formulation→Automation shape: `intake` (Discovery) → `define-behavior`/`scenario-gate` (Formulation) → `implement`/`verify` (Automation).                                                                                                                                                                                                                      |
| Trade-off      | safeword runs the BDD ritual **more consistently** than a human team (enforced ordering, durable traceable artifacts, an always-on adversarial pass) but **cannot replicate the Three Amigos' core value** — independent minds whose blind spots don't overlap. One model playing all three roles has correlated errors; self-adversarial review is weaker than independent review. The mitigations below reduce but do not eliminate this.                                                                                                                                                                                                                                                                                      |
| Alternatives   | Delete the `decomposition` enum value + files outright (rejected: cross-cutting — touches the phase enum, hooks, the paired Cursor rule, `schema.ts`, the parity fixture, and tests — and a live ticket sits in the phase; staged to a follow-up). Keep `decomposition` as an optional advisory phase (rejected: preserves off-pattern dead weight).                                                                                                                                                                                                                                                                                                                                                                             |
| Implementation | Reversible step (FSX1PP): `scenario-gate` exit (`SCENARIOS.md`) absorbs test-layer assignment + sequencing; `SKILL.md` + `lib/quality.ts` mark `decomposition` deprecated; `scenario-gate` advances straight to `implement`. Staged removal **completed (W9GPE7, 2026-06-02)**: dropped the enum value from `BddPhase`/`PHASE_EVIDENCE` and the hook phase-lists, deleted `DECOMPOSITION.md` + the Cursor rule `bdd-decomposition.mdc` (both copies), removed the `schema.ts`/parity-fixture refs and the skill/doc phase-table rows; ticket `153-boundary-resilience` reached `done`. Historical retirement-rationale prose citing this ADR is kept in `DISCOVERY.md`/`SCENARIOS.md`. Decision via `/figure-it-out` 2026-06-02. |

### plan-implementation: a gated planning phase as the Automation on-ramp

**Status:** Accepted
**Date:** 2026-07-09

| Field          | Value                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| What           | Insert a `plan-implementation` phase between `scenario-gate` and `implement` (issue #480, ticket TXRHMD). The phase owns `impl-plan.md` authoring (now six content-or-skip sections incl. Doc impact), the ADR lifecycle (significance-tested emission from `adr-template.md` into the `paths.architecture` location, supersede-never-edit, date-prefixed directory filenames), relevance-scoped skill surfacing, and the review-before-handoff exit with the default-off `designApprovalGate`. A pre-tool transition gate blocks `phase: implement` until the plan parses valid with status `planned`; scenario-gate becomes a pure behavior-quality gate.                                                                                                         |
| Why            | The scenario-gate exit bundled two kinds of judgment (behavior quality + implementation design); planning items sat late in a five-step prose checklist where instruction-following measurably decays, resume state lied mid-planning, and one review stamp covered two judgments. Evidence: gated artifacts carry value where ungated prose is noise (Spec-Kit ablation, arXiv 2604.05278); plan-mode convergence across harnesses. This **supersedes the placement half** of the decomposition-retirement ADR above: its objections are each answered — this phase carries a hard-gated artifact (decomposition had none), architecture _design_ stays at intake (no duplication), and the phase is the Automation practice's on-ramp, not a fourth BDD practice. |
| Trade-off      | One more phase for feature tickets (tasks/patches exempt; legacy features without spec.md grandfathered). In-flight tickets at scenario-gate pass through the new phase doing work they already owed; the one-step provenance denial self-explains the migration.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Alternatives   | Gate-only hardening without a phase (rejected: resume/reminder/review-stamp state stays wrong — the checklist decay this fixes); relocating architecture-guide consumption into the phase per the issue text (rejected: recreates the intake duplication the retirement ADR correctly killed).                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Implementation | `CANONICAL_PHASES`/`BddPhase`/`PHASE_EVIDENCE` enum insertion; `hooks/lib/plan-gate.ts` + pre-tool wiring; stop/boundary list memberships + planning code freeze; `parseImplPlan` optional-section support; `PLAN_IMPLEMENTATION.md` phase doc (trio + Cursor rule); `adr-template.md`; `designApprovalGate` config doc. Decision trail: ticket TXRHMD spec.md decisions 1-23 (four /figure-it-out passes, 2026-07-08).                                                                                                                                                                                                                                                                                                                                             |

**The Three Amigos, played by one agent.** Canonical BDD's Discovery practice convenes three _perspectives_ — business/product, development, testing — to talk through concrete examples before code. safeword has no room of three; one agent wears all three hats:

- **Product/business** — split with the human: the agent frames personas → JTBD → acceptance criteria in intake and uses `/elicit` to extract intent, but the user signs off at each propose-and-converge gate.
- **Development** — the agent's own proposal; `/figure-it-out` for design calls; the architecture survey-and-reconcile step.
- **Testing/QA** — the `scenario-gate`: AODI checks plus the adversarial "what breaks that none of these scenarios catch?" pass and the negative-case-coverage rule.

**Where the simulation is weaker than a real room** (the deliberate, accepted divergences):

1. **Correlated blind spots** — three different brains catch what each misses; one model re-reading its own work inherits its own misreads across all three hats. This is the irreducible gap.
2. **The human reacts rather than contributes** — the burden of curiosity sits on the agent; an unasked question yields an unvolunteered rule. `/elicit` softens this.
3. **No naive-question friction and no _held_ disagreement** — the agent resolves its own debate instantly; `/figure-it-out`'s steelman-both-sides is one mind arguing with itself.
4. **Unknowns aren't tracked** — Example Mapping's red "question cards" give a readiness signal safeword lacks; ticket V6N5PW addresses this.

safeword accepts this trade — **consistency and enforcement over independent blind-spot coverage** — because an autonomous agent cannot convene independent humans, and the mitigations (adversarial pass, `/elicit`, `/figure-it-out`, user sign-off gates) recover much of the value.

### Architecture Review Gate (evidence + independent design review for features)

**Status:** Accepted
**Date:** 2026-06-12

| Field          | Value                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| What           | A default-off stop-hook gate (`checkArchitectureReviewGate`, ticket MR5M3A) that, for a new-flow feature leaving implement (verify/done), requires its `impl-plan.md` design to (a) carry cited evidence in the Decisions section — a URL or `[n]` marker, the `/figure-it-out` trace — and (b) hold an independent design-review stamp bound to the plan's current content hash. An opt-in `crossModelReview` posture additionally requires the review to run on a _different model_ than the author. Builds on #204's impl-plan artifact; reuses the Tier 2 review-ledger verbatim.                                                                                                                                                                                                                                                                                                                                                                                                 |
| Why            | Architecture was the last major workflow surface with no gate, no required artifact, and no independent review — the same blind spot that retired `decomposition`. It is the direct, concrete mitigation for the **correlated blind spots** gap named in the ADR above: a fresh-context reviewer (different model, under `crossModelReview`) is the one thing that recovers the "independent minds" value a single agent structurally lacks. Research backing: correlated-error limits of self-review; ADRs are governance only when tied to enforcement, not documentation.                                                                                                                                                                                                                                                                                                                                                                                                          |
| Trade-off      | Hooks enforce _presence_ (a citation exists, a stamp exists), not _quality_ — a same-model fork still shares the author's blind spots, and the stamp is honor-system at the hook boundary (Tier 1 floor). It raises the floor and makes the worst outcome (a confident, un-researched, unchallenged design) hard to ship silently; it does not guarantee excellence. Cross-model is the ceiling-raiser but is opt-in.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Alternatives   | Advisory-only auto-fire of `/figure-it-out` (rejected: unenforced records are documentation theater — the `decomposition` failure mode). A presence-only artifact gate without independent review (rejected: launders a bad design instead of challenging it). A voting panel of reviewers (rejected: the "popularity trap" — correlated models converge on shared wrong answers and underperform a single adversarial reviewer).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Implementation | Pure helpers in `lib/review-ledger.ts` (`isArchitectureReviewGateEnabled`, `isCrossModelReviewRequired`, `modelsMatch`, model tag on the stamp) and `lib/impl-plan.ts` (`hasCitation`, `sectionBody`); gate branch in `stop-quality.ts`, hoisted with the sibling artifact gates above the edit-activity early-exit so it enforces on phase/state. Author model captured at SessionStart (`session-author-model.ts`) into `CLAUDE_ENV_FILE`, since Stop hooks receive no model field (Claude Code docs). Default-off behind `architectureReviewGate`; tasks and grandfathered features exempt; every requirement carries an auditable `skip:`. Shipped #208 (2026-06-12). Decision and mid-build correction (reviewer cannot self-report its model → orchestrator-recorded; cross-model review is an explicit different-model subagent, not a `context: fork`) via `/figure-it-out` against the Claude Code docs. Follow-up `7A0B2K`: extend cross-model to the scenario-gate review. |

---

### Host-owned cross-agent adversarial review coordinator

**Status:** Accepted
**Date:** 2026-08-02

| Field          | Value                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Context        | Class-1 quality, scenario/phase, and implementation-plan reviews currently rely on host-native fresh contexts. That preserves same-vendor blind spots and lets each surface drift. Live bidirectional testing also showed that first-hit `PATH` lookup and trailing prompts are brittle, while nested sandboxes may hide a reviewer's desktop credential store.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Decision       | One host-owned `safeword review run` coordinator derives the author runtime, prefers the opposite Claude/Codex CLI, snapshots bounded inputs into a neutral workspace, uses explicit capability-checked executables with structured argv and stdin, validates structured output, and returns typed reviewer/failure/independence provenance. Desktop profiles are reused only where the host boundary can access them; cloud receives only reviewer-scoped managed credentials. Default policy is `prefer` after parity proof, with `require` and `off` as explicit configurations.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Consequences   | All class-1 skills share one observable execution and fallback contract. A same-agent fallback is labeled degraded and cannot satisfy required cross-agent evidence. Executable discovery, unsupported capabilities, compatibility-probe timeout, launch/authentication failure, runtime timeout, and invalid output remain distinct typed failures as they advance through bounded CLI routes. Review packets label work-product targets separately from bounded supporting context while treating both as untrusted and integrity-checking both. Direct CLI use still returns typed `REVIEW_ROUTES_EXHAUSTED` loudly. Foreground agent workflows may then make one best-effort host-native fresh-context attempt and one main-thread self-review; both remain explicitly non-independent, read only accepted paths from the live worktree with source integrity not revalidated, never create a review stamp, and preserve a required-policy failure. Neutral packet containment, tool denial, vendor sandbox flags, and post-run hashes remain layered controls; no sandbox label is trusted alone. |
| Alternatives   | Host-native delegation only was rejected because it cannot choose the opposite vendor deterministically. Direct vendor SDK calls were rejected because they duplicate CLI-owned authentication/provider configuration. Shell commands and first-hit `PATH` lookup were rejected by the live spike. Trusting nested read-only mode alone was rejected because host sandbox behavior and credential access differ.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Reassess when  | A host offers a supported credential broker or external-review primitive; Claude/Codex materially change noninteractive or sandbox contracts; Cursor joins the pairing; or review packets regularly exceed bounded snapshot limits.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Implementation | Tickets `QZAFT2` and `ZRV8D5`; `packages/cli/src/review/`, typed `review run` CLI wiring, optional agent provenance on review stamps, canonical class-1 and internal `finish-review` skill templates, the `safeword-reviewer` host agent, parity tests, and desktop/cloud simulation plus live smoke coverage.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |

### Profile-Scoped Generated Codex Plugin and Staged Hook Migration

**Status:** Accepted
**Date:** 2026-07-16
**Supersedes:** none
**Superseded in part by:** [Next-Task Codex Plugin Activation and Migration Result v2](#next-task-codex-plugin-activation-and-migration-result-v2) (lifecycle wording, pending-marker name, and schema-1 migration-state result)

| Field          | Value                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Context        | Codex needs the full Safeword workflow without copying workflow files into each repository. Plugin installation and enablement do not prove its hooks executed, so migration cannot safely remove working legacy protection. Shared repository cleanup also needs to survive interruption without overwriting teammate changes.                                                                                                                                                                                                                                             |
| Decision       | Generate and distribute the Codex plugin from canonical templates. Migrate with Expand → Prove → Contract: install profile-first; record profile-local SessionStart proof bound to package version and the exact hook-manifest digest; let each viable legacy event remain authoritative while the plugin covers gaps; and finalize only with current proof plus explicit confirmation. Finalization uses a contained, fingerprinted transaction backup and conflict-safe recovery. Historical ownership and viability identities live in `SAFEWORD_SCHEMA.codexMigration`. |
| Consequences   | Generic setup and upgrade preserve recognized legacy assets. `safeword codex status` derives human and schema-1 JSON output from one typed state model. Finalization removes only schema-owned assets, preserves custom content, records plugin mode, and leaves a setup-only bootstrap. Interrupted work reports `recovery_required`; recovery refuses to overwrite intervening edits. Profile proof is operational evidence for the active profile, not a claim that every teammate migrated.                                                                             |
| Alternatives   | Manually maintain plugin skills: rejected because the existing thin catalogue drifted. Generate at customer runtime: rejected because it adds a customer-time failure mode and cannot prove the installed cache. Delete hooks on plugin enablement: rejected because enabled does not mean trusted.                                                                                                                                                                                                                                                                         |
| Reassess when  | Codex adds a public trust-status or approval API, changes plugin/cache or hook schemas, introduces project-scoped plugins, or the canonical workflow adopts metadata/reference syntax outside the generator allowlist.                                                                                                                                                                                                                                                                                                                                                      |
| Implementation | Tickets MZH9QH and AJVXWV (#1572): `packages/cli/src/codex-plugin/`, schema-owned migration inventory, generated `packages/cli/codex-plugin/skills/`, proof/restart markers, event-level dispatch authority, typed status, transactional finalization/recovery, tarball/cache proof, and documented interactive hook acceptance.                                                                                                                                                                                                                                            |

### Explicit Project Enrollment for Profile-Scoped Codex Hooks

**Status:** Accepted
**Date:** 2026-07-27
**Supersedes:** implicit hook-time namespace creation

| Field          | Value                                                                                                                                                                                                                                                                                                                 |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Context        | The Codex plugin is profile-scoped, so its lifecycle hooks can run in repositories that never installed Safeword. The quality-state observer previously treated any committed repository as enrolled and created a partial `.project/` namespace after ordinary tool use.                                             |
| Decision       | `.safeword/SAFEWORD.md`, created by explicit `safeword install`, is the project-enrollment marker. Before that marker exists, Codex project gates fail open and project-scoped PreToolUse, PostToolUse, and Stop handlers do not run or write state; SessionStart may still supply package-owned plugin instructions. |
| Consequences   | Installing the profile plugin never implicitly enrolls a repository. Install creates the complete resolved namespace, including its transient-state ignore contract, before Codex hooks may write there. Default, legacy, and configured custom namespace roots retain identical behavior after enrollment.           |
| Alternatives   | Lazy full bootstrap was rejected because a global plugin should not mutate unrelated repositories. User-cache state before enrollment was rejected because project gates lack the project artifacts they govern and repository fingerprinting would add lifecycle complexity without useful enforcement.              |
| Reassess when  | Codex introduces project-scoped plugin activation, or Safeword adds a standalone profile workflow whose pre-enrollment state has value independent of project setup.                                                                                                                                                  |
| Implementation | Ticket F7BH4J: `hasSafewordProjectMarker` in CLI and standalone hook path helpers; packaged Codex dispatcher guards; Codex proof-cache guard; integration coverage for unconfigured, default, legacy, and custom-root repositories.                                                                                   |

### Typed CLI Execution and Discovery

**Status:** Accepted
**Date:** 2026-07-28
**Supersedes:** command-specific output and implicit command discovery
**Superseded in part by:** [Next-Task Codex Plugin Activation and Migration Result v2](#next-task-codex-plugin-activation-and-migration-result-v2) (Codex domain migration result only; the public CLI result envelope remains v1)

| Field          | Value                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Context        | Safeword commands historically mixed observation, mutation, prompting, output, and process termination. Humans could infer intent from prose, but agents could not reliably discover effects, distinguish drift from failure, or bind destructive consent to an exact preview.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Decision       | Public commands follow Observe → Plan → Confirm → Apply → Verify → Report. Domain handlers return schema-version-1 `Plan` and `Result` values; the executable adapter alone renders output and maps `healthy`/`changed`/`action_required`/`failed` to exit 0/0/2/1. A declarative command catalog owns canonical leaves, aliases, internal routes, compatibility rewrites, effect/prompt/network policy, schema versions, and deterministic invocation fixtures. One side-effect-free `createCliProgram()` factory assembles the production Commander tree; a focused contract gate recursively reconciles that real tree with the catalog and its generated surfaces. `Result.effects` records completed effects; proposed effects live in `Plan.effects`. Destructive confirmation binds a plan identity to its precondition digest. |
| Consequences   | Bare `safeword` is read-only status. Every public leaf supports `--json --no-input`; JSON is one snake-case envelope validated against the published v1 JSON Schema, while human output leads with one verdict and at most one next action. `--offline` refuses declared network work, read-only commands cannot report applied effects, and partial failures retain completed effects plus stable recovery. Legacy names remain hidden deprecated aliases through 0.71. Hook helpers remain hidden and keep their latency-oriented direct adapters under stricter no-network/no-lifecycle policy.                                                                                                                                                                                                                                     |
| Alternatives   | Capture legacy console output (rejected: prose cannot preserve semantic effect integrity); derive capabilities from Commander (rejected: it lacks effect, consent, compatibility, and fixture metadata); require `--yes` without a plan identity (rejected: consent could apply to changed effects); remove old commands immediately (rejected: breaks scripts and installed integrations).                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Reassess when  | A second JSON schema is needed, Commander cannot preserve global-option placement or `--` semantics, or a host exposes a native typed command/effect protocol that can replace Safeword’s adapter.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Implementation | Issue #1574 / ticket K53GQ9 established `packages/cli/src/cli-protocol/`, the schema, catalog, and executable fixtures. Issue #2283 / ticket 6N6M40 adds `cli-protocol/program.ts`, runtime reconciliation, deterministic command-reference generation, terminology checks, `check:cli-contract`, and the dedicated required CI context.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |

Every public invocation, including compatibility aliases and interactive
commands, executes through its catalog handler and returns the shared typed
result to the renderer. Aliases add a machine-readable deprecation finding to
that same result. Command-specific output schemas and direct console/process
exit paths are not compatibility boundaries; callers migrate through the
versioned result envelope and published aliases instead.

Commands that intentionally emit a shell or code artifact still return a typed
Result. They place the artifact in the Result's raw-presentation field, and the
shared renderer emits it for human mode while JSON mode keeps the common
schema-1 envelope. Raw presentation is an output form, not a second command
protocol.

The typed Codex protocol adapters are observation-only unless their catalog
entry explicitly declares mutation. Project SessionStart automation is a
separate, fail-open lifecycle feature across Claude, Cursor, and Codex: it may
wire the committed Git guard, bootstrap missing dependencies, and apply
compatible Safeword upgrades. Codex uses a host-neutral dependency adapter in
its managed project bootstrap; startup remains advisory, while the repo-owned
composed CLI script can require readiness. `safeword install` is the explicit
convergence path.

### Next-Task Codex Plugin Activation and Migration Result v2

**Status:** Superseded by [Restart-Bound Codex Plugin Activation](#restart-bound-codex-plugin-activation)
**Date:** 2026-08-01
**Supersedes in part:** [Profile-Scoped Generated Codex Plugin and Staged Hook Migration](#profile-scoped-generated-codex-plugin-and-staged-hook-migration) and [Typed CLI Execution and Discovery](#typed-cli-execution-and-discovery)

| Field          | Value                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Context        | Codex can install a refreshed plugin while the app is running, but an existing task keeps the bundle it already loaded. The former `restart-pending-v1.json` name and `plugin_installed_restart_required` state incorrectly prescribed an application reboot. Reusing schema version 1 for renamed lifecycle semantics would silently break machine consumers.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Decision       | Before installing the released plugin, inspect configured marketplaces through `codex plugin marketplace list --json`; refresh an existing Git-backed `safeword` marketplace only when its source identity is the official `ArcadeAI/safeword` repository, fail closed on a mismatched Git source, and retain the supported add path for fresh, local, or older-source metadata. Installation fails closed if marketplace discovery or refresh fails. Write `activation-pending-v1.json`, bound to exact plugin version and hook-manifest digest. The current task remains immutable; a later task's matching SessionStart proof retires the marker. Read the v0.70 restart marker only as an exact-identity compatibility input; once a canonical marker is durably written, it supersedes and removes any older legacy marker. Emit `CodexMigrationResultV2` with `schema_version: 2` and `plugin_installed_new_session_required`; expose it under the public schema-v1 envelope's versioned `data.migration` object while retaining the former `data.migration_state` value for compatibility. |
| Consequences   | Users can deploy a plugin update without restarting Codex, but must start a new task to use it and review changed hooks. Human output names the current-task/new-task boundary explicitly. Malformed, stale, version-mismatched, and digest-mismatched markers create neither pending activation nor proof. Schema-1 domain migration-result consumers must move consciously to v2; public `safeword ... --json` envelope consumers are unaffected.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Alternatives   | Hot-reload or rewrite the running task: rejected because Codex exposes no supported task reload boundary. Use a stable `safeword@latest` hook dispatcher: rejected because reviewed hook behavior could change without renewed trust. Keep the old state and change prose only: rejected because machine and human contracts would disagree. Rename the enum under schema 1: rejected because it is a breaking in-place mutation. Mutate Codex's cache directly: rejected because supported marketplace commands own that state.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Reassess when  | Codex exposes a documented trust-preserving plugin hot-reload API, a task/plugin identity API, or materially changes marketplace list/upgrade JSON.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Implementation | Ticket `4S2S8V-codex-plugin-next-task-upgrades`; `packages/cli/src/commands/migrate-codex-plugin.ts`, `packages/cli/src/codex-plugin/profile-proof.ts`, `packages/cli/src/codex-plugin/migration.ts`, command/filesystem integration tests, tagged Cucumber scenarios, and a release-time live host runbook.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |

### Generated Native Claude Plugin with Live Proof and Project Contraction

**Status:** Superseded by [Project-Default Claude Plugin Declarations and Project-Bound Proof](#project-default-claude-plugin-declarations-and-project-bound-proof)
**Date:** 2026-08-02
**Supersedes:** none

| Field          | Value                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Context        | Claude Code can install a marketplace plugin into a user profile and apply plugin changes in the current task with `/reload-plugins`, but installation and listing do not prove the selected cache bundle executed. Existing projects already contain working Safeword-owned Claude hooks and workflows, while fresh projects should avoid materializing that framework tree. Cleanup must not overwrite custom project content or mutate Claude's marketplace, trust, reload, or enablement state.                                                                                                                                                                                                                                                                                                                                                                                       |
| Decision       | Generate the complete root `plugin/` tree from canonical CLI templates and distribute it through the official release-tagged marketplace. Install converges the user-scoped profile through supported Claude commands. SessionStart or the first UserPromptSubmit after reload records proof under `${CLAUDE_PLUGIN_DATA}`, bound to exact version, hook-manifest digest, and canonical `${CLAUDE_PLUGIN_ROOT}`. Existing projects retain viable legacy authority per event until current proof and an explicitly confirmed project-only cleanup. Cleanup uses a host-neutral contained, fingerprinted, durable transaction shared with Codex behind host-specific inventory and marker adapters. Reconciliation computes one of `fresh-native`, `legacy`, or `plugin-mode` before planning files, so setup preserves existing protection and never recreates retired Claude-only assets. |
| Consequences   | Native skills use Claude's `safeword:` namespace and the installed cache is the framework runtime boundary. Status joins profile health, execution proof, legacy inventory, and recovery state under an explicit precedence order. `/reload-plugins` can activate a new bundle without restarting the task; the next prompt proves it. Public Claude profile commands may leave reported partial effects on failure because supported add/remove operations do not restore byte-identical private files; Safeword never rewrites those files directly. Project cleanup preserves unknown content and refuses stale plans, concurrent edits, symlinks, and path escape.                                                                                                                                                                                                                    |
| Alternatives   | Keep project-local delivery: rejected because every upgrade churns framework-owned repository files. Treat enabled/listed as proof: rejected because configuration is not execution. Delete legacy assets during setup or install: rejected because it creates a protection gap and crosses profile/project scopes. Copy Codex migration wholesale: rejected because Claude has different cache, reload, trust, namespace, and settings semantics. Restore private Claude profile files after failure: rejected because those formats are undocumented and a restore could overwrite concurrent user changes.                                                                                                                                                                                                                                                                             |
| Reassess when  | Claude exposes a supported non-interactive reload/trust API, changes SessionStart/UserPromptSubmit ordering or plugin environment variables, makes marketplace operations transactional, changes tagged-source or cache semantics, or Cursor gains a native boundary that removes the shared materialized runtime constraint.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Implementation | Ticket `0S31PG` / issue #1785; planned modules under `packages/cli/src/claude-plugin/`, shared migration transaction extraction, schema delivery modes, generated root plugin catalogue, typed `safeword claude` commands, release-tag cache smoke, and migration/status/setup integration coverage.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |

### Project-Default Claude Plugin Declarations and Project-Bound Proof

**Status:** Accepted
**Date:** 2026-08-02
**Supersedes:** [Generated Native Claude Plugin with Live Proof and Project Contraction](#generated-native-claude-plugin-with-live-proof-and-project-contraction)

| Field          | Value                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Context        | Claude supports project- and user-scoped marketplace/plugin declarations while keeping installed plugin payloads in a shared profile cache. A user-only default activates Safeword in unrelated repositories and cannot express a team's dependency in committed project configuration. Live Claude 2.1.170 evidence shows the same plugin may have simultaneous user and project entries sharing one `installPath`; project entries include `projectPath`, and entries for other repositories remain visible in profile-wide listing. One global execution proof therefore cannot establish that the plugin ran for the repository authorizing legacy cleanup.                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Decision       | `safeword claude install` defaults to project scope and accepts explicit `--scope project\|user`; local scope is unsupported. The selected scope's documented settings declaration is independent authority, while marketplace listing and payload verification describe shared Claude-managed checkout/cache health. Safeword observes all plugin entries, resolves project applicability by comparing the real paths of `projectPath` and the current project root, mutates only through supported Claude commands, preserves the other scope, and reports simultaneous applicable entries as `scope-overlap` without automatic removal. SessionStart or UserPromptSubmit writes one durable schema-v2 proof per canonical project beneath `${CLAUDE_PLUGIN_DATA}/execution-proofs-v2/`, keyed by SHA-256 of that project root and bound to exact version, manifest digest, plugin root, event, and session. Only one exact applicable declaration with matching current-project proof can authorize confirmed project-only legacy cleanup; global v1 proof remains diagnostic and non-authorizing. |
| Consequences   | Teams can commit small Claude marketplace and enablement declarations without vendoring Safeword's framework payload, while developers retain a profile-wide opt-in. Project and user declarations can coexist, but status requires an explicit choice because shared cache execution cannot prove which declaration supplied authority. Another repository's project entry never applies to the current project. Scoped install, upgrade, status, and uninstall preservation require a real-host acceptance gate because same-name overlap is observed behavior rather than an explicit Claude guarantee. Cleanup fails closed on missing or unresolvable project identity, malformed/stale proof, proof for another project, or overlap, and never mutates Claude settings, marketplace, cache, or the surviving scope directly.                                                                                                                                                                                                                                                                    |
| Alternatives   | Keep user scope as the default: rejected because it leaks activation across repositories and cannot declare team policy. Use separate project/user commands: rejected because duplicated lifecycle paths would drift. Treat shared cache state as the selected declaration: rejected because one scope could incorrectly satisfy or overwrite the other. Prefer project silently during overlap or auto-remove user scope: rejected because ambiguity would be hidden and other repositories could lose protection. Store a profile-global or mutable project map proof: rejected because it cannot safely isolate concurrent projects. Vendor the plugin into the repository: rejected because it recreates framework-owned upgrade churn.                                                                                                                                                                                                                                                                                                                                                           |
| Reassess when  | Claude exposes a documented effective-scope API, guarantees or forbids same-name cross-scope declarations, makes marketplace checkout/cache scope-specific, changes `plugin list --json` scope or `projectPath`, moves project declarations away from `.claude/settings.json`, provides trustworthy project identity directly to plugins, or Safeword deliberately adds local scope or an authorized cross-scope migration command.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Implementation | Ticket `H87DZR`; `packages/cli/src/claude-plugin/` scoped observer/reconciler and status, `packages/cli/src/cli-protocol/` scope option, generated runtime project proof, Cucumber/Vitest coverage, isolated real-Claude four-direction upgrade/removal acceptance, customer documentation, and the manual release-candidate runbook.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |

### Proof-Gated Automatic Claude Legacy Contraction

**Status:** Accepted
**Date:** 2026-08-05
**Supersedes in part:** [Project-Default Claude Plugin Declarations and Project-Bound Proof](#project-default-claude-plugin-declarations-and-project-bound-proof)

| Field          | Value                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Context        | The native Claude plugin can prove that its exact generated bundle successfully handled a prompt for one canonical repository. Requiring a separate human cleanup after that proof leaves clean 0.68–0.72 framework assets in repositories, creates recurring support work, and causes historical bytes to be mistaken for user modifications. Concurrent hook processes and interrupted filesystem changes mean automatic cleanup must be recoverable rather than merely careful. Identical user- and project-scoped declarations can refer to the same Claude-managed payload, while incompatible declarations remain ambiguous.                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Decision       | After every successful `UserPromptSubmit` sibling, the generated dispatcher writes exact project-bound execution proof and calls one shared, deadline-aware migration function in-process; the explicit CLI repair path calls the same function. A committed, release-checked catalogue of path-specific historical bytes and exact structural settings-hook fingerprints is the sole deletion authority. The function removes every recognized legacy item, preserves and reports every unknown item, and records forward changes in an exclusively created durable transaction. Recovery accepts each recorded target in either its before or after state and refuses any third state. Clean completion writes the plugin-mode marker before retiring the transaction. Migration failure, deadline, conflict, or contention never blocks the prompt. Project enrollment declarations always survive. Identical applicable project/user entries resolve to one effective project installation; incompatible entries retain the `scope-overlap` error and do not authorize contraction. |
| Consequences   | Clean pre-plugin projects contract on the first successful plugin prompt without cleanup ceremony. Modified and third-party content survives, with one understandable advisory when attention remains. A crash may defer completion to the next prompt but cannot justify guessing ownership or overwriting concurrent edits. A new trusted teammate is still enrolled through Claude's supported project declaration and install prompt. Historical release fixtures, settings fingerprints, hidden entrypoint reachability, and generated bundle dependencies become release-contract inputs.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Alternatives   | Keep explicit confirmation: rejected because exact current execution proof plus byte ownership and a recoverable transaction already supply the meaningful safety boundaries. Delete only when every item is recognized: rejected because one custom file would retain all obsolete framework churn. Run migration during setup only: rejected because it misses repositories opened directly after upgrading the plugin. Duplicate logic in the dispatcher: rejected because cleanup and status classification would drift. Treat every cross-scope overlap as an error: rejected for identical identity/payload because it produces duplicate-work support failures without protecting additional state.                                                                                                                                                                                                                                                                                                                                                                              |
| Reassess when  | Claude documents or changes effective-scope resolution, project trust and teammate installation, hook deadlines, reload behavior, or plugin cache isolation; a cancellable asynchronous host API exists; the supported historical floor moves; or the filesystem transaction assumptions no longer hold.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Implementation | Ticket `GZZEY7`; historical ownership catalogue and generator, shared legacy classifier, forward-idempotent transaction/recovery, in-process generated migration function, explicit repair adapter, dispatcher integration, scope/status reconciliation, real 0.68/0.69/0.72 fixtures, and disposable real-host acceptance.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |

### Restart-Bound Codex Plugin Activation

**Status:** Accepted
**Date:** 2026-08-02
**Supersedes:** [Next-Task Codex Plugin Activation and Migration Result v2](#next-task-codex-plugin-activation-and-migration-result-v2)

| Field          | Value                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Context        | Live rc.1 verification disproved the assumption that a new Codex task reloads an externally upgraded plugin. The long-lived Desktop app-server reused a cached rc.0 skill catalogue while rc.1 hooks executed, creating a split-brain plugin. Matching version-and-manifest hook timestamps also predated installation, so hook proof alone could not establish coherent activation.                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Decision       | External installation writes `activation-pending-v2.json` with exact plugin identity, a unique activation ID, installation time, and every Codex app-server process identity active during installation. It removes pre-install event proof that could authorize cleanup, while retaining bounded task-bound SessionStart history as advisory evidence only. SessionStart may retire the marker only when it runs after installation under a different app-server PID and start time; successful retirement writes an activation receipt. Status uses `plugin_installed_app_restart_required` and tells the user to fully restart Codex before resuming and reviewing the same task. POSIX `ps` and Windows PowerShell process tables are parsed without shell interpolation; unavailable or ambiguous host identity fails closed. |
| Consequences   | A new task in the same app cannot turn status green. Restarting Codex automatically converges proof without requiring the user to edit profile files. Bootstrap distinguishes exact-current protection, an observed prior runtime, and wholly unverified protection; prior-runtime history never proves the installed update or authorizes cleanup. Advisory SessionStart history persists in the user's Codex profile and is bounded to the newest 256 task records per project and 64 projects. Hook proof remains evidence for hook execution, while the host transition is the evidence that skills and hooks were reloaded from one post-install catalogue. The deprecated public `data.migration_state` compatibility value remains unchanged; canonical consumers use `data.migration.state`.                               |
| Alternatives   | Continue promising next-task activation: rejected by live evidence. Treat post-install hook timestamps as whole-plugin proof: rejected because hooks and skills can resolve from different snapshots. Require a permanent manual confirmation flag: rejected because a verifiable host transition can converge automatically. Ask the running Desktop host to refresh after an external CLI install: rejected because the parent-owned app-server transport gives an unrelated Safeword process no supported way to address that host and request its existing runtime refresh.                                                                                                                                                                                                                                                    |
| Reassess when  | Codex exposes a supported external-installer-to-running-host refresh boundary, provides a stable app-instance identity to hooks, or guarantees that creating a task reconstructs the plugin manager.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Implementation | Ticket `4S2S8V`; `packages/cli/src/codex-plugin/host-process.ts`, `profile-proof.ts`, migration status and CLI handlers, process/proof/migration tests, revised Cucumber lifecycle scenarios, customer documentation, and the dogfood removal of retired project-local Codex hooks.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |

### Advisory PR Review as a Split-Privilege Evidence Pipeline

**Status:** Accepted
**Date:** 2026-08-04
**Supersedes:** none

| Field          | Value                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Context        | Automatic review must inspect attacker-controlled pull-request content, optionally call a model, and publish useful findings without executing fork code under authority or acquiring an approval/check/merge capability. Draft PR #1917 proved useful trigger, parser, and poster seams but combined model inspection with a write-capable parent job, used a check-run receipt, and could inspect before all required checks settled.                                                                                                                                                                                                                                                                                                                                                                                                  |
| Decision       | Deliver the pipeline in three additive phases. The MVP is one serialized, schema-managed `pull_request_target` workflow with job-scoped privilege separation: a metadata-only invalidator may update the ordinary-comment receipt; a no-checkout inspection job reads pull-request artifacts as data and calls the configured model without GitHub write permission; and a no-checkout/no-model-secret publisher receives only a strict bounded advisory result. Every new SHA gets a full fresh review. Later children may add exact-SHA inline comments, proven inert/immaterial reuse, finding lifecycle, and finally isolated same-repository execution. The initial provider-neutral adapter ships an explicit OpenAI Responses implementation with strict structured output; provider/model selection is configured, not inferred. |
| Consequences   | The MVP has no customer-code execution, no positive remedy-verification state, no materiality classifier, and no merge-affecting publication surface. Unknown or unreadable artifacts fail conservative; incomplete/failed/stale states cannot become positive. GitHub remains the durable receipt store, so no database is added. Workflow and endpoint contract tests become security gates. Setup adds the uniquely named workflow through schema reconciliation and remains default-off. The first complete live workflow proof requires the file on a repository's default branch or a disposable fixture.                                                                                                                                                                                                                          |
| Alternatives   | Reuse #1917 unchanged: rejected because a check receipt can affect merge policy and model/publisher authority is not separated by job. Use `workflow_run` after one bundle workflow: rejected because one workflow completion does not mean all repository prerequisites settled and GitHub provides no wildcard workflow list. Use `check_suite` as the universal wakeup: rejected because GitHub suppresses these events for Actions-created suites. Use a single privileged process with a scrubbed child environment: rejected because process hygiene is weaker than job-scoped capability absence. Use an external queue/database: rejected as unnecessary for the first serialized release.                                                                                                                                       |
| Reassess when  | GitHub changes privileged-event, job-permission, required-check, concurrency, artifact, or comment semantics; a second provider ships; PR scale exceeds the bounded evidence budget; or distributed workers require a transactional claim store.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Implementation | Epic `P0D6S2` / issue #1909, phased into MVP `HXT3GW`, freshness/noise child `Z7M7Y3`, controlled-execution child `436EQW`, and release-hardening child `YC6JCC`. The MVP implements `packages/cli/src/pr-review/`, typed `review-pr inspect\|invalidate\|publish` commands, a default-off schema-managed router/reusable-worker pair, deterministic contract/wiring tests, and guarded `.flux` and disposable-GitHub evaluations.                                                                                                                                                                                                                                                                                                                                                                                                       |

## References

### Per-file host JavaScript toolchain ownership

**Status:** Accepted
**Date:** 2026-07-24

| Field          | Value                                                                                                                                                                                                                                                                                                                                                                                                                             |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| What           | The shared post-edit JS/TS hook resolves a recognized host toolchain from the edited file's canonical directory ancestry, bounded by the canonical Safeword project root. A recognized Ultracite Biome preset takes precedence over direct Biome; the owner runs only through its local executable, with owner `cwd`, owner-relative `--`-guarded operand, and a child environment without `BIOME_CONFIG_PATH` or `BIOME_BINARY`. |
| Why            | Root-only detection causes nested polyglot workspaces to use the wrong policy; PATH/package-runner execution and ambient Biome overrides can run a different tool or configuration than the project declared.                                                                                                                                                                                                                     |
| Trade-off      | The hook owns path/config parsing and executable lookup instead of delegating to package runners. Unsupported formatters remain on the existing no-Prettier path until a dedicated adapter and scenarios are added.                                                                                                                                                                                                               |
| Alternatives   | Root-wide formatter detection: rejected because it crosses workspace boundaries. Generic package-manager invocation: rejected because it can download or select a global binary. Shell commands: rejected because filenames are operands, not code.                                                                                                                                                                               |
| Implementation | `packages/cli/templates/hooks/lib/host-toolchain.ts` and the shared `lintFile` entry point; ticket 13E3EN.                                                                                                                                                                                                                                                                                                                        |

- Language Pack Spec: `packages/cli/src/packs/LANGUAGE_PACK_SPEC.md`
- Ruff docs: https://docs.astral.sh/ruff/
- golangci-lint docs: https://golangci-lint.run/
- SQLFluff docs: https://docs.sqlfluff.com/
- Clippy docs: https://doc.rust-lang.org/stable/clippy/
- rustfmt docs: https://rust-lang.github.io/rustfmt/
- Cargo lints: https://doc.rust-lang.org/cargo/reference/manifest.html#the-lints-section
- PEP 621: https://peps.python.org/pep-0621/

# Reconciliation Engine

The reconciliation engine (`src/reconcile.ts`) uses the schema’s file ownership rules to plan setup, convergence, and removal. Ticket/tracker sync and generated indexes manage their own state. Both use the typed CLI protocol and report which changes they completed.

## Schema (`src/schema.ts`)

The [schema](../../packages/cli/src/schema.ts) declares ownership and installation policy.

A `textPatches` array applies in list order and unpatches in reverse, so the patch that owns file removal runs last on uninstall. A `managedFiles` entry is normally create-if-missing; with `refreshWhileUnmodified: true`, reconcile also rewrites it when the installed bytes still match a known Safeword scaffold (`shouldRefreshManagedFile` in `reconcile.ts`), so user-edited copies are never overwritten.

File definitions support three content sources: `template` (path in `templates/`), `content` (static string or factory), `generator` (dynamic function of `ProjectContext`, returns `undefined` to skip).

A `managedFiles` entry may also carry an optional `configKey` (`'principles' | 'personas' | 'glossary' | 'surfaces' | 'architecture'`). When the user sets the matching `paths.<configKey>` in `.safeword/config.json`, install skips the default scaffold and the user-configured path becomes the single source of truth (ticket K7N2QM). Independently of any override, a `configKey` marks the default as project-owned knowledge, so `reset --full` (`uninstall-full`) preserves it (ticket KD4C2A).

## Reconciliation Modes

| Mode             | Behavior                                                                             |
| ---------------- | ------------------------------------------------------------------------------------ |
| `install`        | Create dirs, write files, merge JSON, patch text                                     |
| `upgrade`        | Remove deprecated, update owned, create missing managed (refresh unmodified opt-ins) |
| `uninstall`      | Remove safeword-managed files and dirs                                               |
| `uninstall-full` | Also remove generated configs (ESLint, Prettier)                                     |

Each mode is idempotent. Running it twice produces the same result.

## Install Convergence Flow

```text
safeword install (src/lifecycle/commands.ts)
  → profile preflight for selected integration adapters
  → projectLifecycleSchema(cwd, agents)   # schemaForClaudeDelivery() drops .claude/ assets for
                                          #   native-plugin delivery; Codex + selected-surface filters
  → convergeSetup() (src/lifecycle/project-install.ts)
    → namespace migration, version gate
    → createProjectContext(cwd)           # detect languages, frameworks, tooling
    → reconcile(schema, install|upgrade, ctx)
      → computePlan() → executePlan()     # directory, file, JSON, text actions
    → installPack() for missing packs, public-retro project config
    → Codex bootstrap, architecture/workspace/ESLint config stages
    → installDependencies()               # npm/bun/pnpm/yarn
    → Python tooling, package compatibility
  → selected integration adapters (registry order: profile install/proof per agent)
```

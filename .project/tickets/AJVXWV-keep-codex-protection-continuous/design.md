# Design: Continuous Codex plugin migration

## Status

Implemented

## Context

Safe Word currently installs the profile plugin separately from explicit
project-hook cleanup. Installation proves Codex reports the plugin enabled, but
it does not prove that the reviewed hook manifest executed. Meanwhile generic
reconciliation still classifies former project workflow assets as deprecated.

The migration needs one observable state model spanning profile readiness,
project legacy assets, event authority, finalization, and recovery.

## Components

### Codex migration domain

`packages/cli/src/codex-plugin/migration.ts` owns the typed state model and
derivation precedence. It combines three observations without printing:

- plugin enablement reported by the Codex subprocess boundary;
- profile-local proof validity;
- repository legacy, finalized-marker, and recovery-backup state.

The module returns values for command renderers and hook dispatchers. It does
not call `process.exit()`.

The migration inventory is declared on `SAFEWORD_SCHEMA.codexMigration`.
Reconciliation, observation, compatibility, finalization, and recovery all
consume that schema-owned metadata; there is no second legacy allowlist.

### Profile proof

`packages/cli/src/codex-plugin/profile-proof.ts` owns schema-1 proof,
content-bound validation, the restart-pending marker, and atomic profile writes.
The proof digest uses the
exact packaged `codex-plugin/hooks.json` bytes, avoiding a second canonical form
that could drift from the artifact Codex reviews.

Every generated plugin hook carries `--plugin-hook`; the legacy project command
forms do not. Each event records identity-bound proof in its own file before
applying event-level compatibility suppression, avoiding cross-process
read-modify-write races. SessionStart also removes the matching restart marker. The marker
establishes the normal lifecycle path, not tamper-resistant identity; profile
owners can manually invoke or forge it.

### Legacy inventory and authority

Hook dispatch consumes the schema-owned historical hook commands, runtime
files, skills, and agents. A handler is viable only when its exact recognized
command is configured and its required regular-file runtime or package runner
is available. A profile dispatcher no-ops only for that viable event, so
partial or broken legacy installations do not create gaps.

### Finalization transaction

The migration command prepares the complete mutation plan before confirmation.
It then writes a durable backup manifest and file payloads before changing the
project. Config replacement uses the existing durable temp-file + rename path.
If a later mutation fails, recovery restores the prepared snapshot. An
unresolved backup without the finalized marker dominates status as
`recovery_required`.

Each backup entry records a contained repository-relative path, before image
and SHA-256, mode, and the expected finalized image/hash or absence. Preparation
rejects symlinks. Recovery first compares every current path with its expected
post-state; any mismatch aborts the entire restore and reports conflicts,
preserving intervening user edits.

The transaction installs a small bootstrap skill and shared plugin-mode marker
only after legacy cleanup succeeds.

### CLI adapter

`packages/cli/src/commands/migrate-codex-plugin.ts` remains the subprocess,
prompting, rendering, and process-boundary adapter. It exposes:

- `safeword codex migrate [--finalize] [--yes] [--json]`
- `safeword codex status [--json]`
- `safeword codex recover [--json]`
- deprecated `--remove-legacy-hooks` as a finalization alias

Human and JSON output render the same derived result.

## Data Model

### Profile proof v1

```ts
interface CodexHookProofV1 {
  schema_version: 1;
  event: 'session-start' | 'pre-tool-use' | 'post-tool-use' | 'user-prompt-submit' | 'stop';
  plugin_version: string;
  manifest_sha256: string;
  recorded_at: string;
}
```

### Repository marker v1

```ts
interface CodexPluginProjectMarkerV1 {
  schema_version: 1;
  mode: 'plugin';
}
```

### Migration state

```ts
type CodexMigrationState =
  | 'recovery_required'
  | 'plugin_setup_required'
  | 'plugin_disabled'
  | 'plugin_update_required'
  | 'legacy'
  | 'plugin_installed_restart_required'
  | 'plugin_enabled_hook_unproven'
  | 'compatibility'
  | 'plugin'
  | 'not_configured';
```

The public result includes `protected`, `changed`, plugin observation, proof
status, legacy events/assets, and zero or one next action.

## Transition Matrix

| Starting state | `status` | `migrate` | `finalize` | `recover` |
| --- | --- | --- | --- | --- |
| `recovery_required` | Report recovery only | Refuse; recovery first | Refuse | Conflict-check and restore; rerun is no-op after success |
| `plugin_setup_required` | Report bootstrap install path | Install → `plugin_installed_restart_required` | Refuse | No-op |
| `plugin_disabled` | Report enablement action | Enable/install → `plugin_installed_restart_required` | Refuse | No-op |
| `plugin_update_required` | Report version mismatch | Update → `plugin_installed_restart_required` | Refuse | No-op |
| `legacy` | Report protected/partial legacy | Install/enable → `plugin_installed_restart_required` | Refuse without current proof | No-op |
| `plugin_installed_restart_required` | Report restart/review until marked SessionStart writes proof | Idempotently report restart/review | Refuse | No-op |
| `plugin_enabled_hook_unproven` | Report protection from viable legacy events | Idempotently report restart/review | Refuse | No-op |
| `compatibility` | Report protected and finalization action | Idempotently report ready-to-finalize | Confirmed transaction → `plugin` | No-op before backup exists |
| `plugin` | Exit 0 with no next action | No-op | No-op | No-op |
| `not_configured` | Report unprotected install path | Install → `plugin_installed_restart_required` | Refuse | No-op |

All mutating commands return the same schema-1 result envelope. Repeated
execution in a settled state either makes the next valid transition or returns
an unchanged result.

## JSON Contract

The domain derives `CodexMigrationResultV1`, but issue #1574 established one
shared public wire contract for every command. The CLI adapter therefore maps
the Codex result into `CliResult` and publishes
`packages/cli/schemas/cli-result-v1.schema.json`:

```ts
interface CliResult {
  schemaVersion: 1;
  ok: boolean;
  state: 'healthy' | 'changed' | 'action_required' | 'failed';
  changed: boolean;
  findings: Finding[];
  effects: {
    files: Effect[];
    packages: Effect[];
    configuration: Effect[];
    network: Effect[];
    destructive: Effect[];
  };
  errors: Array<{ code: string; message: string; retryable: boolean }>;
  recovery: RecoveryAction[];
  nextActions: NextAction[];
  data: {
    command: 'codex status';
    migration_state: CodexMigrationState;
    protected: 'protected' | 'partial' | 'unprotected' | 'uncertain';
    plugin: {
      installed: boolean;
      enabled: boolean | null;
      version: string | null;
      observation: 'observed' | 'unknown';
    };
    proof: {
      status: 'current' | 'missing' | 'stale' | 'malformed';
      plugin_version: string | null;
      manifest_sha256: string | null;
      recorded_at: string | null;
    };
    legacy: { events: string[]; viable_events: string[]; assets: string[] };
  }
}
```

Wire rendering converts camelCase to the schema's snake_case keys. There is at
most one next action. Exit `0` means ready/no action, `2` means a valid state
needs action, and `1` means execution error.

Every effect is `{kind, target, operation?}` in one of the five shared
categories. `errors[].code` comes from the registry in `spec.md`; next-action
commands are exact public command strings.

## Failure Handling

- Profile commands may partially mutate Codex-owned state; repository state
  stays unchanged and the result reports what was observed.
- Malformed project config is rejected before prompting or profile mutation.
- Malformed/stale proof is treated as unproven, never as current.
- Installed-but-disabled is distinct from installed/restart-required and
  enabled/unproven.
- Finalization writes backup evidence before project mutation.
- Automatic rollback restores only paths still matching the transaction's
  expected post-state; conflicts retain the backup and yield
  `recovery_required`.
- A pre-existing unresolved backup blocks new finalization until recovery.

## Compatibility

- Existing `codex install` remains supported.
- Existing `--remove-legacy-hooks` remains an alias for two releases but gains
  the current-proof and confirmation guarantees.
- Generic setup/upgrade stops deleting historical Codex project assets.
- Claude Code and Cursor files and hooks are untouched.

## Security and Privacy

- Proof is profile-local and contains no repository path, user identity, or
  remote data.
- The shared marker never embeds profile readiness.
- Cleanup uses exact known command/path identities and rejects ambiguous TOML
  blocks.
- No command reads or writes Codex's private trust store.

## Verification

- Cucumber scenarios exercise command and hook entry points through real
  temporary files and fake only the Codex subprocess/profile boundary.
- CLI integration tests cover output, exit codes, idempotence, selective
  cleanup, and recovery.
- Unit tests densely cover proof corruption, state precedence, and rollback
  failures.
- Release tests prove every plugin hook carries the internal marker while
  remaining pinned and trust-respecting.

## Alternatives Rejected

- **Treat enablement as proof:** loses because Codex may skip an untrusted or
  changed hook.
- **Project-local profile-readiness marker:** loses because one teammate's profile
  state must not be committed as team readiness.
- **All-or-nothing legacy suppression:** loses because partial installations
  can either duplicate covered events or leave missing events unprotected.
- **Git-only recovery:** loses because legacy assets may be untracked or locally
  customized.

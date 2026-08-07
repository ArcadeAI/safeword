# Spec: Keep Codex protection continuous while teams migrate to the profile plugin

## Intent

Move existing repositories from project-local Codex protection to the
profile-scoped plugin without creating an unprotected interval or implying
that one teammate's local readiness applies to the whole team.

## Intake Brief

- **Requested by:** Safe Word product owner.
- **Cost of inaction:** A generic upgrade can remove working legacy protection
  before the replacement plugin is trusted, leaving developers and teammates
  with an ambiguous or unprotected repository.
- **Reversibility:** One-way public migration contract. Cleanup changes shared
  repository state and must therefore retain a tested recovery path.

## References

- [GitHub issue #1572](https://github.com/ArcadeAI/safeword/issues/1572)
- `MZH9QH-give-codex-users-full-workflow` established the current two-step
  plugin installation and explicit legacy-hook cleanup.
- [Codex project-scoped plugin request](https://github.com/openai/codex/issues/18115)
- [Kubernetes rolling updates](https://kubernetes.io/docs/tasks/run-application/update-deployment-rolling/)
- [Terraform state recovery](https://developer.hashicorp.com/terraform/cli/commands/state)

## Personas

- Technical Builder (TBU)
- Non-Technical Builder (NTB)
- Safeword Maintainer (SWM)

## Surfaces

Affected:

- OpenAI Codex
- Safeword CLI

Unaffected:

- OpenAI Codex Cloud — local profile plugins are unavailable there.
- Claude Code — its project configuration and hooks are unchanged.
- Cursor — its project configuration and hooks are unchanged.

## Vocabulary

- **Legacy protection:** Safe Word-owned project hooks and runtime assets
  installed before profile-plugin delivery.
- **Hook proof:** Profile-local evidence that the currently installed plugin
  hook manifest actually executed after Codex trust review.
- **Compatibility mode:** The migration interval in which the plugin is ready
  but complete legacy protection remains authoritative for the repository.
- **Finalization:** The explicit shared-repository cleanup that retires legacy
  protection after local plugin proof.

## Jobs To Be Done

### codex-continuity.TBU1 — Migrate without losing protection

**Persona:** Technical Builder (TBU)

> When my repository still uses legacy Codex protection, I want Safe Word to
> keep it active until my profile plugin has actually run, so I can migrate
> without an unprotected interval.

#### codex-continuity.TBU1.R1 — Generic project maintenance never retires working legacy Codex protection

#### codex-continuity.TBU1.R2 — Plugin readiness requires current hook-execution proof, not installation or enablement alone

#### codex-continuity.TBU1.R3 — Coexistence executes exactly one authoritative implementation

#### codex-continuity.TBU1.R4 — Shared cleanup is explicit, selective, recoverable, and idempotent

### codex-continuity.NTB1 — Always know the safe next step

**Persona:** Non-Technical Builder (NTB)

> When Safe Word tells me Codex needs attention, I want one plain-language
> state and one safe next action, so I can finish migration without
> understanding plugin internals.

#### codex-continuity.NTB1.R1 — Every migration state names whether the repository is protected and what to do next

#### codex-continuity.NTB1.R2 — Non-interactive use never performs shared cleanup without an explicit finalization flag

### codex-continuity.SWM1 — Preserve team compatibility

**Persona:** Safeword Maintainer (SWM)

> When one developer finalizes a shared repository, I want custom assets
> preserved and future teammates guided to the plugin, so migration does not
> damage user configuration or strand new contributors.

#### codex-continuity.SWM1.R1 — Finalization removes only known Safe Word-owned legacy assets

#### codex-continuity.SWM1.R2 — A finalized repository retains a small plugin-setup bootstrap without duplicated workflow policy

## Rave Moment

### codex-continuity — A migration that refuses to create a flag day

- **Moment:** After trusting the plugin and rerunning one command, Safe Word
  proves the repository stayed protected throughout and offers a previewed,
  recoverable finalization.
- **Beats:** The usual plugin migration dread that a shared cleanup silently
  breaks teammates or destroys custom configuration.
- **They'd say:** "Safe Word kept the old guardrails live until the new ones
  actually ran, then showed me exactly what it would remove."

## Outcomes

- An upgrade cannot remove working legacy protection.
- A trusted plugin hook produces current, profile-local evidence.
- Status distinguishes legacy, restart-required, trust-unproven,
  compatibility, and plugin-only states for humans and automation.
- Compatibility mode runs one protection path.
- Finalization preserves custom content, records a backup, and can be
  recovered until committed.
- Future teammates see a concise plugin setup path in the repository.

## Delivery Contract

### Detection and state precedence

Safe Word derives status in this order:

1. `recovery_required` when a finalization backup exists without the finalized
   marker.
2. `plugin_setup_required` when the repository is finalized but the active
   profile has no enabled plugin.
3. `plugin_disabled` when Codex reports the plugin installed but disabled.
4. `plugin_update_required` when an enabled plugin reports a version different
   from the packaged plugin. An unknown version remains compatible for older
   Codex clients that do not expose it.
5. `legacy` when one or more recognized legacy hook events exist and the
   current profile plugin is absent.
6. `plugin_enabled_hook_unproven` when the plugin is enabled but current proof
   is absent, stale, malformed, or content-mismatched.
7. `compatibility` when the installed plugin version and current proof identity
   match the package and any recognized legacy hook or runtime asset remains.
8. `plugin` when that same identity is current and no recognized legacy asset
   remains.
9. `not_configured` when neither plugin proof, finalized marker, nor recognized
   legacy protection exists.

`plugin_installed_app_restart_required` is the schema-2 migration state derived
from a profile-local, version-and-manifest-bound activation marker after
`codex migrate` installs or updates the plugin. Read-only status keeps reporting
it until a different Codex host executes the marked profile-plugin SessionStart
command. Host identity is the observed `(pid, started_at)` pair for the Codex
app-server ancestor; both values must match to count as the installing host, so
PID reuse cannot satisfy the comparison. SessionStart from the installing host
records proof but preserves the marker, because that app may still have the old
catalogue loaded. SessionStart from a different host atomically writes its event
proof and activation receipt, then removes the marker. Finalization readiness remains partial until every
packaged hook event has recorded matching proof. If the plugin was enabled outside
this migration path, or current proof later becomes stale without a matching
install marker, status reports `plugin_enabled_hook_unproven`. All non-ready
states exit `2`.

Partial legacy installations are never called complete. Status lists the
recognized events and assets, labels protection as partial, and recommends
`safeword codex migrate`; it does not delete residue automatically.

### Profile-local hook proof

Every profile-plugin hook command carries an internal `--plugin-hook` marker
that legacy project hooks never used. Each command writes a separate record at
`${CODEX_HOME:-~/.codex}/safeword/hook-proof-v2/<event>.json`.

The atomic JSON record contains:

- `schema_version: 2`
- the normalized hook event;
- the running Safe Word package version;
- a SHA-256 digest of the exact packaged `codex-plugin/hooks.json` bytes;
- the activation identifier when the proof belongs to a pending activation;
- the UTC execution timestamp.

Proof has no time-based expiry. It is current only while the schema, package
version, hook-manifest digest, and expected event match the running CLI.
Finalization requires current records for SessionStart, PreToolUse, PostToolUse,
UserPromptSubmit, and Stop. A changed plugin version or manifest invalidates
the affected records immediately. Profile proof never claims readiness for
another teammate.

This is operational provenance, not a cryptographic attestation: it proves the
exact reviewed plugin command path executed in the normal Codex lifecycle.
A user with write access to the profile can manually invoke or forge the same
path, just as they can edit the proof file. Safe Word does not represent the
proof as tamper-resistant or inspect Codex's private trust store.

### Compatibility authority

Authority is event-level. Every profile-plugin dispatcher writes its own proof
first, then no-ops only when the repository's Codex config contains an exact
recognized Safe Word handler for that event and its required project runtime is
runnable. Script handlers require the exact allowlisted file to be a regular
file; package-backed historical handlers require the enrollment marker and an
available package runner. The legacy handler remains authoritative for that
event; the plugin handles events whose handler is missing or broken. This
prevents duplicate gates without turning stale configuration into a protection
gap.

### Upgrade preservation

Generic setup and upgrade never delete the finite legacy Codex skill, runtime,
agent, or hook allowlist. The Safe Word schema owns this migration metadata;
reconciliation preserves it, while compatibility and finalization derive their
inventory from that same definition. Unrelated `.agents/skills/`, `.codex/`,
and `.safeword/` content is always outside the cleanup allowlist.

### Finalization and recovery

The preferred command is `safeword codex migrate --finalize`.
`--remove-legacy-hooks` remains a deprecated alias for two releases.

- Interactive finalization shows the exact paths and config blocks, then asks
  `Finalize shared repository cleanup? [y/N]`.
- Non-interactive finalization requires replaying the exact preview with
  `--finalize --yes --plan <id>`; otherwise it exits without mutation.
- Current profile proof is required before either path.
- Before mutation, Safe Word writes an exact backup manifest and copies every
  file it will remove under `.safeword/codex-migration-backup/`.
- It updates `.codex/config.toml` atomically, removes only allowlisted assets,
  creates `.safeword/codex-plugin.json` with `schema_version: 1` and
  `mode: plugin`, and installs
  `.agents/skills/safeword-plugin-setup/SKILL.md`.
- If any mutation fails, Safe Word restores the backup automatically. A backup
  left without the finalized marker produces `recovery_required`.
- The backup records repository-relative, containment-validated paths,
  pre-mutation content/mode/hash, and the exact expected post-mutation hash or
  absence. Symlink targets are rejected before mutation.
- `safeword codex recover` restores a path only when its current state still
  equals the transaction's expected post-state. Any intervening edit is
  reported as a conflict and nothing is overwritten. A successful recovery
  removes the backup, finalized marker, and bootstrap. Successful finalized
  reruns are no-ops.
- The bootstrap contains installation, restart/trust, and status instructions
  only; it duplicates no workflow policy.

Profile installation may be partially successful even when a later Codex
command fails, because Codex owns that profile state. Safe Word reports the
observed profile state precisely but guarantees that repository state remains
unchanged.

### Status contract

Issue #1574 supersedes the ticket-specific wire shape proposed earlier in this
document. `safeword codex status --json` uses the shared public CLI result
schema (`packages/cli/schemas/cli-result-v1.schema.json`), while the Codex
migration domain remains available under `data`:

```json
{
  "schema_version": 1,
  "ok": true,
  "state": "action_required",
  "changed": false,
  "findings": [
    {
      "code": "CODEX_COMPATIBILITY",
      "message": "Codex is protected by the current profile plugin; verified legacy protection remains until explicit finalization.",
      "severity": "warning"
    }
  ],
  "effects": {
    "files": [],
    "packages": [],
    "configuration": [],
    "network": [],
    "destructive": []
  },
  "errors": [],
  "recovery": [],
  "next_actions": [
    {
      "command": "safeword codex migrate --finalize",
      "mutates": true,
      "requires_human": true
    }
  ],
  "data": {
    "command": "codex status",
    "migration_state": "compatibility",
    "protected": "protected",
    "plugin": {
      "installed": true,
      "enabled": true,
      "version": "0.70.0",
      "observation": "observed"
    },
    "proof": {
      "status": "current",
      "plugin_version": "0.70.0",
      "manifest_sha256": "…",
      "recorded_at": "…"
    },
    "legacy": {
      "events": ["SessionStart"],
      "viable_events": ["SessionStart"],
      "assets": [".codex/config.toml"]
    }
  }
}
```

JSON mode emits no prose on stdout. Public `state` is one of `healthy`,
`changed`, `action_required`, or `failed`. The domain `migration_state` drives
that mapping: `plugin` maps to `healthy`, execution errors map to `failed`, and
all other migration states map to `action_required`. Status exits `0`, `1`, or
`2` respectively. Human output leads with protection state and ends with at
most one `Next:` command.

The shared envelope schema-1 fields and effect categories are required. The
nested `data.migration` object is schema 2 and exposes the canonical domain
state. The compatibility `data.migration_state` field retains the older
`plugin_installed_restart_required` spelling while consumers migrate. Codex
data enums are:

- `data.migration_state`: `recovery_required | plugin_setup_required |
  plugin_disabled | plugin_update_required | legacy |
  plugin_installed_restart_required |
  plugin_enabled_hook_unproven | compatibility | plugin | not_configured`
- `data.migration.state`: the same values except the restart state is
  `plugin_installed_app_restart_required`
- `data.protected`: `protected | partial | unprotected | uncertain`
- `data.plugin.observation`: `observed | unknown`
- `data.proof.status`: `current | partial | missing | stale | malformed`
- `data.proof.events` and `data.proof.missing_events`: observed and outstanding
  packaged hook events for the current plugin identity
- `effects.*[].kind`: a stable operation name; `target` is the affected
  resource and optional `operation` adds detail

Nullable Codex fields are limited to `data.plugin.enabled`,
`data.plugin.version`, `data.proof.plugin_version`,
`data.proof.manifest_sha256`, and `data.proof.recorded_at`; each uses JSON
`null` when unknown. All effect categories, `findings`, `errors`, `recovery`,
and `next_actions` are always arrays. At most one next action is returned.

Stable schema-1 error codes are:

- `CODEX_UNAVAILABLE`
- `PLUGIN_OBSERVATION_FAILED`
- `PLUGIN_INSTALL_FAILED`
- `PLUGIN_ENABLEMENT_UNKNOWN`
- `PLUGIN_ENABLEMENT_FAILED`
- `PLUGIN_MARKETPLACE_FAILED`
- `PLUGIN_UPDATE_REQUIRED`
- `PROOF_WRITE_FAILED`
- `FINALIZATION_PROOF_REQUIRED`
- `FINALIZATION_CONFIRMATION_REQUIRED`
- `AMBIGUOUS_LEGACY_CONFIG`
- `UNSAFE_MIGRATION_PATH`
- `BACKUP_EXISTS`
- `FINALIZATION_FAILED`
- `ROLLBACK_FAILED`
- `RECOVERY_CONFLICT`
- `RECOVERY_FAILED`

Adding codes is backward-compatible within schema 1; changing or reusing a
code's meaning requires a schema version change. Next-action commands are exact
public CLI strings, not prose.

## Open Questions

None.

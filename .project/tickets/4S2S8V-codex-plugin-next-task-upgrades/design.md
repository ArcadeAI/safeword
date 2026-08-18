# Design: Restart-bound Codex plugin upgrades

**Related:** [Spec](./spec.md) | [Test definitions](./test-definitions.md)

## Architecture

Safeword keeps Codex plugin bundles immutable and version-pinned. The installer
refreshes the configured Git marketplace, installs the released cache copy, and
writes a profile-local activation marker bound to the plugin version, hook
manifest digest, installation ID/time, and every active Codex app-server
identity. It does not mutate the bundle already loaded by the running app.
SessionStart clears the marker only under a different app-server instance.

The v0.70 restart marker remains a read-only compatibility input. The new
release writes only `activation-pending-v2.json`; pre-install proof is removed.
Status requires an app restart and never treats a same-app task resume as reload
evidence.

## Components

### Marketplace installation

**What:** Select `marketplace add` for an absent or non-Git source and
`marketplace upgrade safeword` for an existing Git source, then install and
verify the exact packaged version.

**Where:** `packages/cli/src/commands/migrate-codex-plugin.ts`

**Boundary:** Codex CLI subprocess. Tests use a real Safeword command with only
the Codex executable replaced by a recording fixture.

### Activation evidence

**What:** Write, recognize, and clear installation- and host-bound activation
markers while accepting the former restart marker as compatibility input.

**Where:** `packages/cli/src/codex-plugin/profile-proof.ts`

**Identity:** `{ plugin_version, manifest_sha256, activation_id, installed_at, active_hosts }`,
plus the native task ID, Codex profile, and canonical project worktree carried by
the SessionStart proof.

### Migration status

**What:** Introduce migration result schema v2 and derive
`plugin_installed_app_restart_required`, protection, next action, and human
guidance from the installed plugin, proof, legacy protection, and activation
marker. Schema v1 remains historical; the renamed enum is never emitted under
the old schema identifier.

**Where:** `packages/cli/src/codex-plugin/migration.ts` and
`packages/cli/src/cli-protocol/public-handlers.ts`

### Documentation

**What:** Explain install-now/restart-to-activate behavior consistently in the
README, website reference/quick-start/FAQ pages, migration bootstrap, and
architecture decision.

## User flow

1. The builder runs `bunx --bun safeword@latest codex install` while Codex is open.
2. Safeword refreshes the existing Git marketplace or adds it for a fresh profile.
3. Codex installs and enables the exact released plugin cache copy.
4. Safeword explains that the running app may retain a stale catalogue.
5. The builder fully restarts Codex, resumes the existing task, and reviews `/hooks`.
6. SessionStart under the new app-server identity clears pending activation.

## Key decisions

### Preserve immutable task bundles

**What:** Never redirect an already-trusted hook to `safeword@latest` and never
rewrite the running task's loaded manifest.

**Why:** OpenAI documents bundled skills as available in new chats/sessions.
Exact-version commands also keep Codex hook review meaningful.

**Trade-off:** The installed release waits for an app restart instead of merely
the next task.

### Migrate marker names with a dual reader

**What:** Write the new activation marker, read both marker names, and retire
superseded legacy state only after the new canonical exact identity is durable.
SessionStart proof alone does not mutate a legacy marker.

**Why:** Existing v0.70 profiles must converge without manual cleanup or false
activation claims.

**Trade-off:** One small compatibility branch remains until the v0.70 migration
window can be retired.

### Refresh only known Git marketplaces

**What:** Inspect `codex plugin marketplace list --json`; use the documented
upgrade command only for a configured Git source and retain add/install behavior
for absent, local, or older-source metadata.

**Why:** Codex documents marketplace upgrade for configured Git marketplaces.
The fallback preserves existing local test and authoring flows.

**Trade-off:** Installation performs one additional read-only Codex command.

### Supersede only the affected architecture clauses

**What:** Add an ADR superseding next-task activation with restart-bound proof. Link
back to it from the older profile-plugin and typed-CLI ADRs as a partial
supersession.

**Why:** A renamed machine state cannot truthfully retain schema version 1, and
the old restart wording is no longer the accepted lifecycle contract.

**Trade-off:** Consumers must consciously move to the v2 migration result while
the public CLI protocol envelope remains unchanged.

## Error handling

- Marketplace observation or refresh failures stop before plugin installation.
- Installation or enablement verification failures retain existing repository protection.
- Malformed canonical activation state remains pending and fails closed. Malformed or stale legacy markers are not silently promoted; a later successful canonical install may safely supersede and remove them.
- Exact proof is written durably before a matching marker is removed.
- Marketplace-list command failures and malformed JSON fail closed before installation; configured non-Git sources retain the supported add/install fallback.

## References

- [OpenAI Plugins](https://learn.chatgpt.com/docs/plugins)
- [Codex CLI plugin commands](https://learn.chatgpt.com/docs/developer-commands?surface=cli#cli-codex-plugin)
- `ARCHITECTURE.md` — Profile-Scoped Generated Codex Plugin and Staged Hook Migration

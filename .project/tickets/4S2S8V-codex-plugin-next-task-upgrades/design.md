# Design: Next-task Codex plugin upgrades

**Related:** [Spec](./spec.md) | [Test definitions](./test-definitions.md)

## Architecture

Safeword keeps Codex plugin bundles immutable and version-pinned. The installer
refreshes the configured Git marketplace, installs the released cache copy, and
writes a profile-local activation marker bound to the plugin version and hook
manifest digest. It does not mutate the bundle already loaded by the running
task. A later task's SessionStart proof clears the matching marker.

The v0.70 restart marker remains a read-only compatibility input. The new
release writes only `activation-pending-v1.json`; matching SessionStart proof
retires either marker. Status uses next-task language and never promises a
mid-task hot reload.

## Components

### Marketplace installation

**What:** Select `marketplace add` for an absent or non-Git source and
`marketplace upgrade safeword` for an existing Git source, then install and
verify the exact packaged version.

**Where:** `packages/cli/src/commands/migrate-codex-plugin.ts`

**Boundary:** Codex CLI subprocess. Tests use a real Safeword command with only
the Codex executable replaced by a recording fixture.

### Activation evidence

**What:** Write, recognize, and clear exact-identity activation markers while
accepting the former restart marker during migration.

**Where:** `packages/cli/src/codex-plugin/profile-proof.ts`

**Identity:** `{ plugin_version, manifest_sha256 }`.

### Migration status

**What:** Introduce migration result schema v2 and derive
`plugin_installed_new_session_required`, protection, next action, and human
guidance from the installed plugin, proof, legacy protection, and activation
marker. Schema v1 remains historical; the renamed enum is never emitted under
the old schema identifier.

**Where:** `packages/cli/src/codex-plugin/migration.ts` and
`packages/cli/src/cli-protocol/public-handlers.ts`

### Documentation

**What:** Explain install-now/activate-next-task behavior consistently in the
README, website reference/quick-start/FAQ pages, migration bootstrap, and
architecture decision.

## User flow

1. The builder runs `bunx --bun safeword@latest codex install` while Codex is open.
2. Safeword refreshes the existing Git marketplace or adds it for a fresh profile.
3. Codex installs and enables the exact released plugin cache copy.
4. Safeword confirms the running task keeps its loaded version and the next task uses the installed release; no application restart is requested.
5. The builder starts a new task and reviews changed hooks in `/hooks`.
6. Matching SessionStart proof clears pending activation.

## Key decisions

### Preserve immutable task bundles

**What:** Never redirect an already-trusted hook to `safeword@latest` and never
rewrite the running task's loaded manifest.

**Why:** OpenAI documents bundled skills as available in new chats/sessions.
Exact-version commands also keep Codex hook review meaningful.

**Trade-off:** The installed release waits until the next task instead of
appearing mid-task.

### Migrate marker names with a dual reader

**What:** Write the new activation marker, read both marker names, and remove a
legacy marker when matching SessionStart proof arrives. A successful canonical
write also retires any superseded legacy marker after the new exact identity is
durable.

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

**What:** Add a new ADR for next-task activation and migration result v2. Link
back to it from the older profile-plugin and typed-CLI ADRs as a partial
supersession.

**Why:** A renamed machine state cannot truthfully retain schema version 1, and
the old restart wording is no longer the accepted lifecycle contract.

**Trade-off:** Consumers must consciously move to the v2 migration result while
the public CLI protocol envelope remains unchanged.

## Error handling

- Marketplace observation or refresh failures stop before plugin installation.
- Installation or enablement verification failures retain existing repository protection.
- Malformed or stale markers do not produce pending activation and are not silently promoted; a later successful canonical install may safely supersede and remove them.
- Exact proof is written durably before a matching marker is removed.
- Marketplace-list command failures and malformed JSON fail closed before installation; configured non-Git sources retain the supported add/install fallback.

## References

- [OpenAI Plugins](https://learn.chatgpt.com/docs/plugins)
- [Codex CLI plugin commands](https://learn.chatgpt.com/docs/developer-commands?surface=cli#cli-codex-plugin)
- `ARCHITECTURE.md` — Profile-Scoped Generated Codex Plugin and Staged Hook Migration

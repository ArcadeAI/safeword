# Spec: Move Codex users to the Safe Word plugin

## Intent

Safe Word's Codex integration should be a plugin, not a set of installed project
files. Existing projects need a deliberate migration that does not accidentally
turn off their gates, duplicate hooks, or overwrite their own Codex settings.

## Intake Brief

- **Requested by:** Alex, while completing GitHub PR #993.
- **Cost of inaction:** New and existing Codex users keep receiving repo-local
  hook configuration, and enabling the plugin can run both sets of hooks.
- **Reversibility:** One-way-adjacent. The code can restore legacy behavior, but
  a migration modifies project configuration after changing a profile, so the
  operation must be ordered and independently verifiable.

## References

- PR #993: `https://github.com/ArcadeAI/safeword/pull/993`
- Plugin parity ticket: `.project/tickets/39KJX7-codex-plugin-hook-parity/`
- Plugin test harness: `.project/tickets/4DK9H4-test-codex-plugin-migration/`
- Codex plugin CLI: `codex plugin marketplace add`, `codex plugin add`, and
  `codex plugin list --json`, checked against the installed Codex CLI on 2026-07-14.

## Personas

- Technical Builder (TB) - uses Safe Word with Codex in an existing project.
- Safeword Maintainer (SM) - releases the plugin and needs regression evidence
  that migration cannot silently weaken enforcement.

## Surfaces

Affected:

- OpenAI Codex
- Safe Word packaged CLI

Unaffected:

- Claude Code - it already supports project-scoped plugin installation.
- Cursor - it has no equivalent installable plugin system.

## Vocabulary

- **Legacy hook** - a Safe Word command stanza in a project's
  `.codex/config.toml`, whether it calls an old repo-local script or the former
  package-runner command.
- **Verified plugin** - the `safeword@safeword` plugin is present in Codex's
  `installed` list and reports `enabled: true` for the active profile.
- **Active Codex profile** - the `CODEX_HOME` configuration used by the command,
  normally the user's `~/.codex` directory.

## Jobs To Be Done

### migrate-codex-to-plugin.TB1 - Move safely to the plugin

**Persona:** Technical Builder (TB)

> When I move an existing Safe Word Codex project to the plugin, I want one
> explicit command to make the change only after it proves the plugin is active,
> so my workflow gates keep working and never run twice.

#### migrate-codex-to-plugin.TB1.R1 - Standard setup and upgrade never change a user's Codex profile or remove existing legacy hooks

#### migrate-codex-to-plugin.TB1.R2 - Explicit migration verifies the profile plugin before removing Safe Word-owned project hooks

#### migrate-codex-to-plugin.TB1.R3 - Migration preserves user-authored Codex configuration and hooks

### migrate-codex-to-plugin.SM1 - Release a deterministic Codex integration

**Persona:** Safeword Maintainer (SM)

> When I release a Codex plugin version, I want the packaged plugin and CLI
> migration to have one Bunx-only contract and layered evidence, so release
> changes cannot reintroduce npx, version skew, or a silent no-op.

#### migrate-codex-to-plugin.SM1.R1 - The shipped plugin uses exact version-pinned Bunx commands and no Codex npx command

#### migrate-codex-to-plugin.SM1.R2 - The packed package and a real isolated Codex profile prove the release contract

## Rave Moment

skip: table-stakes migration safety.

## Outcomes

- `safeword setup` does not create Safe Word Codex hook configuration.
- `safeword upgrade` leaves an existing legacy Codex configuration intact.
- `safeword migrate codex-plugin` installs the trusted distribution source into
  the active profile, verifies its enabled state, then removes only Safe Word
  hook stanzas from the project.
- When Codex, Bun, marketplace installation, or enablement fails, the command
  leaves the project untouched and says how to resolve the prerequisite.

## Open Questions

- Marketplace distribution: the migration will add the public Safe Word source
  repository as a Codex marketplace using the repository's committed
  `.agents/plugins/marketplace.json`, with a sparse checkout for the marketplace
  and plugin paths. This keeps plugin assets out of customer repositories.

# Spec: Let new Codex users install Safe Word without a migration

## Intent

New Codex users should see an installation command, not a migration command.
Safe Word must make the profile plugin setup clear while keeping the separate,
destructive legacy-hook cleanup explicit and reversible.

## Intake Brief

- **Requested by:** Safe Word product owner after validating the new-user Codex flow.
- **Cost of inaction:** New users are told to migrate despite having nothing to migrate, which makes the supported plugin path look unsafe or unfinished.
- **Reversibility:** Public CLI naming is a compatibility commitment, so keep the old command working while documentation adopts the clearer path.

## References

- `YH2ZRN-migrate-codex-to-plugin`: established the profile-scoped plugin and protected legacy cleanup.
- `MZH9QH-give-codex-users-full-workflow`: moved Codex workflow assets into the plugin.
- `H1P0D7-canonical-retro-spool-dedupe`: completed the Codex plugin retro-filing parity work without restoring project agents.

## Personas

- Technical Builder (TBU)
- Non-Technical Builder (NTB)

## Surfaces

Affected:

- OpenAI Codex
- Safeword CLI

Unaffected:

- Claude Code and Cursor — their project-local setup surfaces do not use Codex's profile plugin.

## Vocabulary

- **Install:** Add and verify the Safe Word plugin in the active Codex profile without inspecting or editing project Codex configuration.
- **Legacy cleanup:** Remove only Safe Word-owned hook registrations from an existing project after the profile plugin has been reviewed and verified.

## Jobs To Be Done

### codex-plugin-install.TBU1 — Install Safe Word in Codex without migration language

**Persona:** Technical Builder (TBU)

> When I add Safe Word to a project that uses Codex, I want a clearly named
> plugin installation step, so I can enable the workflow without guessing
> whether I have old configuration to move.

#### codex-plugin-install.TBU1.R1 — Setup and upgrade direct new Codex users to the install command

#### codex-plugin-install.TBU1.R2 — Installing the profile plugin does not create or modify project Codex configuration

### codex-plugin-install.NTB1 — Keep the risky legacy cleanup separate

**Persona:** Non-Technical Builder (NTB)

> When I already use Safe Word's old Codex hooks, I want a separate, explicit
> cleanup step after I review the plugin, so I do not accidentally lose custom
> configuration or protection.

#### codex-plugin-install.NTB1.R1 — Legacy cleanup requires an explicit command and only proceeds after enabled-plugin verification

#### codex-plugin-install.NTB1.R2 — The former migration command remains available for existing automation

## Rave Moment

skip: table-stakes

## Outcomes

- A fresh setup or upgrade explains `safeword codex install` as the Codex next step.
- `safeword codex install` adds, enables, and verifies the profile plugin without creating `.codex` in the current project.
- `safeword codex migrate --remove-legacy-hooks` preserves custom configuration and never reinstalls a reviewed plugin.
- `safeword migrate codex-plugin` continues to work for existing scripts.

## Open Questions

None. The prior plugin migration already establishes the trusted profile scope;
this feature clarifies the public command surface without changing it.

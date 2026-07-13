# Spec: Preserve Codex hook behavior through the plugin CLI

<!--
Product-framing spec for a feature ticket. The engineering contract
(scope / out_of_scope / done_when) lives in ticket.md frontmatter; this
file holds the *why and who*. The bdd intake flow authors it before
engineering scope. Fill each section, then delete the
guidance comments.
-->

## Intent

Safe Word's Codex plugin migration should change delivery, not behavior. A
project that moves from repo-local Codex hook scripts to plugin-bundled hook
commands must keep the same quality gates, context, nudges, continuations, and
fail-open behavior that existing Codex users rely on.

## Intake Brief

<!-- The decide-to-build framing for substantial features (advisory — write
`skip: <reason>` on any line that doesn't apply). Intent above is the positive
"why"; this is who asked, the cost of NOT doing it, and how reversible it is.
If cost-of-inaction is low and reversibility is high, ask whether this is a
feature at all, or a leaner task. -->

- **Requested by:** alex (TheMostlyGreat), after review found that the packaged
  Codex hook CLI path preserved only a subset of the old repo-local adapters.
- **Cost of inaction:** Safe Word could ship a cleaner plugin install while
  silently dropping Codex quality gates, post-tool review state, skill nudges,
  retro filing, architecture nudges, or SessionStart auto-upgrade behavior.
- **Reversibility:** one-way-adjacent. The implementation is reversible in code,
  but the user-facing migration removes repo-local implementation files, so
  missing behavior would be discovered after users have already trusted the new
  install shape.

## References

- Prior harness ticket: `.project/tickets/4DK9H4-test-codex-plugin-migration/`.
- Legacy Codex adapters: `packages/cli/templates/hooks/codex/`.
- Packaged CLI command: `packages/cli/src/commands/codex-hook.ts`.
- Plugin hook manifest: `packages/cli/codex-plugin/hooks.json`.
- Codex plugin docs: https://developers.openai.com/codex/plugins/build.
- Codex hooks docs: https://developers.openai.com/codex/hooks.
- Codex state docs: https://developers.openai.com/codex/config-advanced.

## Personas

- Technical Builder (TB) - uses Safe Word in Codex and expects a plugin-backed
  install to behave like the old project-local install.
- Safeword Maintainer (SM) - needs a parity map and test ladder that catches
  behavior loss before publishing the migration.

## Surfaces

<!-- Optional: supported product, agent, runtime, protocol, client, or
deployment contexts this feature affects. Prefer names from the configured
surfaces file. Use spec-local names only for one-off contexts.

Affected:
- <surface name>

Unaffected:
- <surface name> — <reason>

Each affected surface should be covered by at least one saved scenario tagged
`@surface.<slug>` (OpenAI Codex -> `@surface.openai-codex`) or carry
`skip: <reason>` on the Affected line. -->

Affected:

- OpenAI Codex
- Codex plugin hooks
- Safe Word packaged CLI

Unaffected:

- Claude Code - shared hooks may be reused, but Claude hook behavior is not
  changed by this ticket.
- Cursor - Cursor parity is not part of this migration follow-up.
- OpenAI Codex Cloud - this ticket proves local Codex plugin/hook behavior only.

## Vocabulary

- **Legacy Codex adapter** - the repo-local `packages/cli/templates/hooks/codex/*`
  scripts that currently translate Codex lifecycle payloads into Safe Word hook
  behavior.
- **Packaged Codex hook CLI** - `safeword hook codex <event>`, the command that
  plugin hooks run through `npx` or `bunx`.
- **Parity behavior** - a legacy adapter behavior that users rely on and that the
  packaged CLI must preserve unless deliberately deferred in this ticket.

## Jobs To Be Done

### codex-plugin-hook-parity.TB1 - Keep Safe Word behavior when Codex delivery changes

**Persona:** Technical Builder (TB)

> When I enable Safe Word's Codex plugin, I want the plugin hook commands to
> enforce and surface the same Safe Word behavior as the old repo-local hooks,
> so I get a cleaner repo without weaker guardrails.

#### codex-plugin-hook-parity.TB1.R1 - PreToolUse preserves quality gates and proof bridges

#### codex-plugin-hook-parity.TB1.R2 - PostToolUse preserves quality state and language-skill nudges

#### codex-plugin-hook-parity.TB1.R3 - Stop preserves continuations, retro work, and fail-open behavior

#### codex-plugin-hook-parity.TB1.R4 - SessionStart preserves context and auto-upgrade behavior through one dispatcher

#### codex-plugin-hook-parity.TB1.R5 - UserPromptSubmit preserves queued prompt context

### codex-plugin-hook-parity.SM1 - Diagnose parity through layered evidence

**Persona:** Safeword Maintainer (SM)

> When I review the Codex plugin migration, I want an event-by-event parity map
> and tests at the right layer, so I can tell whether a failure is in command
> rendering, payload translation, shared hook behavior, plugin trust, or live
> Codex invocation.

#### codex-plugin-hook-parity.SM1.R1 - The parity audit names every preserved, redesigned, and deferred behavior

#### codex-plugin-hook-parity.SM1.R2 - Deterministic tests prove every must-preserve behavior before live smoke

#### codex-plugin-hook-parity.SM1.R3 - Live smoke proves the trusted plugin path invokes the package command

## Rave Moment

skip: table-stakes parity. The user-facing win belongs to the broader plugin
migration: clean repos without lost behavior.

## Outcomes

- The packaged CLI path preserves the old Codex adapter behavior or records a
  deliberate, reviewed defer decision.
- Plugin hook commands remain package-runner commands and do not require
  customer repo-local Safe Word hook scripts.
- Default tests catch parity regressions without launching a model.
- The opt-in live smoke proves trusted Codex actually invokes the plugin-backed
  command path.

## Open Questions

- SessionStart auto-upgrade implementation detail: preserve by reusing the
  shared auto-upgrade core in `safeword hook codex session-start`, not by
  installing a second SessionStart hook. This is resolved for planning; tests
  decide the exact code shape.
- Retro extraction through packaged CLI: preserve current behavior by launching
  the same shared retro child boundary from package code. Defer remote
  marketplace publishing; local marketplace/live smoke is enough for this PR.

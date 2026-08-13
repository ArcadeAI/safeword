# Spec: Ship native Claude Code plugin for Safeword users

<!--
Product-framing spec for a feature ticket. The engineering contract
(scope / out_of_scope / done_when) lives in ticket.md frontmatter; this
file holds the *why and who*. The bdd intake flow authors it before
engineering scope. Fill each section, then delete the
guidance comments.
-->

## Intent

Move Safeword-owned Claude Code workflows and executable hooks out of each
repository and into a versioned native plugin, while keeping project-owned
configuration, tickets, knowledge, and runtime state in the repository. Existing
users must retain working legacy protection until the installed plugin has
actually run and an explicit cleanup safely retires only recognized legacy assets.

## Intake Brief

<!-- The decide-to-build framing for substantial features (advisory — write
`skip: <reason>` on any line that doesn't apply). Intent above is the positive
"why"; this is who asked, the cost of NOT doing it, and how reversible it is.
If cost-of-inaction is low and reversibility is high, ask whether this is a
feature at all, or a leaner task. -->

- **Requested by:** Safeword maintainers through GitHub issue #1785, succeeding the feasibility work in #292 and carrying the cross-editor goal in #749.
- **Cost of inaction:** Claude users keep vendoring and reconciling roughly a hundred framework-owned hooks, skills, guides, and helpers in every repository; upgrades keep creating repository churn and cannot use Claude's native plugin update path.
- **Reversibility:** One-way door at the migration boundary: plugin packaging is reversible, but retiring working legacy protection and changing public workflow names are cross-cutting migration/API changes that require staged proof and rollback.

## References

- GitHub #1785 — implementation issue and acceptance criteria
- GitHub #292 — Claude plugin feasibility audit, superseded by this feature
- GitHub PR #993 — Codex Expand -> Prove -> Contract migration precedent
- GitHub #1784 — parallel Cursor plugin outcome
- Claude Code docs: Create plugins, Discover plugins, Plugin marketplaces,
  Plugins reference, Hooks reference, and environment variables (revalidated
  2026-08-02)

## Personas

- Technical Builder (TBU)
- Non-Technical Builder (NTB)
- Safeword Maintainer (SWM)

## Surfaces

Affected:

- Claude Code
- Safeword CLI

Unaffected:

- Claude Code Cloud — plugin installation and local profile/cache lifecycle are
  local Claude Code concerns; project-owned instructions continue to cover cloud
  sessions separately.
- OpenAI Codex — its packaged-plugin lifecycle is already implemented and serves
  as parity precedent, not a migration target here.
- Cursor — tracked independently by #1784.

## Vocabulary

- **Legacy protection:** Safeword-owned Claude hooks, skills, commands, agents,
  and supporting code materialized in an existing repository before native
  plugin migration.
- **Viable legacy hook:** An exact structurally recognized settings entry whose
  target and transitive Safeword runtime graph are present at contained,
  non-symlinked schema paths with accepted fingerprints. Viability is determined
  before dispatch; an incomplete, custom, escaped, or symlinked graph is not
  allowed to suppress plugin behavior.
- **Plugin proof:** profile-local evidence that the exact installed plugin
  version and hook manifest executed at a Claude session boundary; installation
  or enablement alone is not proof.
- **Cleanup:** the explicit, project-scoped operation that verifies current
  plugin proof and atomically retires recognized legacy assets without changing
  marketplace, plugin, enablement, update, or trust state.

## Engineering Decisions

### Lifecycle and scope

- Explicit `safeword claude install` defaults to **user scope** and manages the
  active Claude profile across projects. Fresh `safeword setup` is the one
  intentional automatic path: it enables the exact plugin at project scope for
  that project, so a new Claude user is protected without a second command.
- Public lifecycle commands are `safeword claude install`, `safeword claude
  status`, `safeword claude cleanup`, and `safeword claude recover`. Install
  mutates only the profile; cleanup/recover mutate only the current project;
  status is read-only. Cleanup requires confirmation or `--yes`.
- Each command uses the public CLI result envelope and typed states for missing,
  disabled, wrong-version, errored, unproven, coexistence, cleanup-ready,
  recovery-required, plugin-mode, and unsupported-host outcomes. The tested
  capability baseline is Claude Code 2.1.170; an older or unparseable host is
  unsupported rather than guessed compatible. Non-ready states exit non-zero
  and name one safe next action.
- Status classification precedence is `recovery-required` →
  `unsupported-host` → plugin health (`missing`, `disabled`, `wrong-version`,
  `errored`) → proof health (`unproven`) → project migration state. With valid
  proof, mixed recognized/conflicting legacy is `coexistence`, wholly recognized
  removable legacy is `cleanup-ready`, and a durable marker with no Claude
  legacy is `plugin-mode`. `errored` exits 1, action-required states exit 2,
  and `plugin-mode` exits 0 with no next action. Status never mutates either
  profile or project.
- Fresh `safeword setup` creates project state, enables the exact project-scoped
  plugin, and creates no Claude-only legacy surface. Ordinary setup/upgrade of
  an existing project never installs or updates a profile plugin and never
  cleans existing legacy protection. A durable plugin-mode marker prevents
  later reconciliation from recreating retired Claude assets.
- Ordinary setup of an existing legacy project preserves every viable legacy
  asset and the complete Claude profile; it may recommend, but never invoke, a
  Claude lifecycle command.

### Live activation and proof

- Plugin hooks execute readable TypeScript directly under Bun from
  `${CLAUDE_PLUGIN_ROOT}`. Hook invocation performs no package-registry access;
  Bun remains the required Claude hook runtime.
- The plugin ships an immutable generated identity containing the marketplace
  version and SHA-256 of `hooks/hooks.json`. Hook code hashes its own installed
  manifest and rejects an inconsistent identity. Proof also records the
  canonicalized `${CLAUDE_PLUGIN_ROOT}` selected by that hook execution, so a
  persistent data record cannot make another cache path appear loaded.
- SessionStart records normal-launch proof. After install, enable, or update,
  the user runs Claude's supported `/reload-plugins`; the next
  UserPromptSubmit hook records the same exact identity in
  `${CLAUDE_PLUGIN_DATA}` before Claude processes the prompt. This proves the
  new cache path in the current task without a restart.
- `claude plugin list --json` is necessary health evidence, but never execution
  proof. Missing, disabled, wrong-version, errored, stale, or malformed state
  cannot authorize cleanup.
- Safeword cannot invoke the interactive reload command on the user's behalf.
  Install/update therefore returns `/reload-plugins` as the immediate action;
  if Claude refuses reload, legacy authority remains and a new task is the
  fallback.

### Coexistence and cleanup

- Coexistence uses **legacy authority with plugin proof-only dispatch**: while a
  viable legacy hook for an event remains, the matching plugin hook records its
  identity but suppresses duplicate functional effects. After explicit cleanup,
  the already-loaded plugin becomes authoritative in the same task through
  Claude's settings/reload behavior.
- Recognized legacy files require a schema-owned path plus an exact current or
  historical Safeword fingerprint. Unknown content at a Safeword path is
  preserved and reported as a conflict. Settings hooks use structural command
  identities and remove only matched Safeword entries.
- Cleanup reuses the Codex migration's contained-path, symlink rejection,
  before/after fingerprint, durable backup, atomic rename, and conflict-safe
  recovery model. Cleanup never calls a Claude marketplace/plugin command and
  never changes trust.
- Native plugin skills use `/safeword:<skill>`. Legacy short names coexist until
  cleanup; no project-owned compatibility wrappers remain afterward.

### Asset boundary and parity

- Generated into `plugin/`: Claude skills and phase references, commands,
  Safeword agent definitions, Claude hook manifest, hook entrypoints/libraries,
  and every guide/script/template required transitively by those plugin
  components. Canonical sources remain under `packages/cli/templates/`.
- `skills/` is the canonical workflow surface. `commands/` contains only
  canonical flat commands with no same-name skill equivalent; generation rejects
  duplicate invocation names across both directories.
- Remain project-owned or irreducibly materialized: `.safeword/config.json`,
  `.project/**`, durable/transient project state, language/tool configuration,
  project instruction imports, and status-line wiring. Assets still required by
  Cursor remain until #1784 supplies its native replacement, but Claude plugin
  code must not resolve through those copies.
- Parity maps canonical workflow IDs and lifecycle events across Claude, Codex,
  and Cursor. Explicit host exceptions are namespace syntax, matcher vocabulary,
  install/trust/reload lifecycle, status-line support, and assets retained for a
  materialized host.

### Proof boundary

- Automated: manifest/catalogue validation; exact source transformations;
  version and release sync; install/list/update/disable/error/idempotence through
  an isolated profile; cache execution via `--init-only`; malformed state,
  ownership preservation, interruption, symlink, and concurrent-edit tests;
  cross-host parity.
- Opt-in live or recorded manual acceptance: interactive marketplace/plugin
  trust, `/reload-plugins` in an authenticated task, next-prompt proof, native
  skill and agent discovery, and representative PreToolUse/PostToolUse/Stop
  behavior. Automation must record an explicit skip where the trust UI cannot be
  driven safely.

## Jobs To Be Done

### native-claude-plugin.TBU1 — Adopt native workflows without repository churn

**Persona:** Technical Builder (TBU)

> When I install or upgrade Safeword for Claude Code, I want framework-owned
> workflows to arrive through Claude's native plugin system while my project's
> configuration and customizations stay intact, so I can keep protection current
> without reviewing a large framework diff in every repository.

#### native-claude-plugin.TBU1.R1 — Fresh installation establishes an observable native plugin without requiring legacy assets

#### native-claude-plugin.TBU1.R2 — Plugin installation, update, coexistence, and cleanup preserve project-owned, user-authored, and third-party configuration

#### native-claude-plugin.TBU1.R3 — Framework code executes from the installed versioned plugin while project state remains in the repository

#### native-claude-plugin.TBU1.R4 — Repeating any successful lifecycle operation is idempotent and produces no unrelated repository churn

#### native-claude-plugin.TBU1.R5 — Installed, enabled, or updated plugin behavior becomes available in the current Claude task through supported live reload whenever the host permits it

### native-claude-plugin.NTB1 — Keep protection continuous through migration

**Persona:** Non-Technical Builder (NTB)

> When my project moves from legacy Safeword files to the Claude plugin, I want
> the old protection to remain authoritative until the replacement is proven and
> any failure to explain the safe next action, so I can trust the agent without
> auditing the implementation myself.

#### native-claude-plugin.NTB1.R1 — Every viable legacy hook remains authoritative until the exact installed plugin version and hook definition have executed

#### native-claude-plugin.NTB1.R2 — Missing, disabled, stale, malformed, or unproven plugin state leaves legacy protection intact and reports a safe next action

#### native-claude-plugin.NTB1.R3 — Cleanup never installs, upgrades, enables, reloads, or changes trust for the plugin or its marketplace

#### native-claude-plugin.NTB1.R4 — Cleanup is atomic, recoverable after interruption, and refuses to overwrite concurrent project edits

### native-claude-plugin.SWM1 — Publish one verifiable Claude workflow bundle

**Persona:** Safeword Maintainer (SWM)

> When I release a Safeword version, I want Claude's hooks, skills, commands,
> agents, and supporting code generated from canonical sources with lifecycle and
> parity checks, so every supported host exposes the same reference workflow
> without hand-maintained drift.

#### native-claude-plugin.SWM1.R1 — Every release carries a complete, valid Claude plugin generated from canonical Safeword assets

#### native-claude-plugin.SWM1.R2 — Version, hook, skill, command, agent, schema, documentation, and package contracts fail visibly when the Claude delivery surfaces drift

#### native-claude-plugin.SWM1.R3 — The reference workflow remains behaviorally aligned across Claude, Codex, and Cursor wherever each host exposes an equivalent native surface

#### native-claude-plugin.SWM1.R4 — Automated cache and host-surface smoke tests prove packaged execution, with unavoidable manual trust boundaries recorded explicitly

## Rave Moment

### native-claude-plugin — Upgrade without a framework diff or protection gap

- **Moment:** A Safeword release updates through Claude's plugin cache; the next
  session proves the new hooks, while the repository diff contains only the
  user's project work and legacy protection remains available until cleanup.
- **Beats:** The expected hundred-file framework upgrade diff and the fear that
  deleting legacy hooks creates an invisible protection gap.
- **They'd say:** "Safeword updated itself without touching my repo, and it
  wouldn't remove the old guardrails until the new ones had actually run."

## Outcomes

- New Claude users can install, inspect, and activate a versioned Safeword plugin
  through documented native Claude commands.
- Users can apply plugin changes to the current Claude task without restarting;
  when live reload is refused or cannot establish proof, Safeword reports that
  boundary and keeps legacy protection authoritative.
- Existing projects can observe coexistence, plugin proof, cleanup readiness,
  recovery needs, and completed plugin mode without guessing from files.
- Cleanup preserves user and third-party assets and never installs, upgrades,
  enables, reloads, or changes trust for the plugin.
- Release and parity checks prove the generated Claude plugin carries the same
  reference workflows as Codex and Cursor wherever their native surfaces allow.

## Open Questions

None. The Engineering Decisions above resolve the original intake questions and
the gaps found by the cold-start executability check.

# Spec: Choose where Safeword runs in Claude

## Intent

Let a repository declare Safeword for its collaborators by default while
retaining an explicit profile-wide installation for developers who want
Safeword in every Claude project.

## Intake Brief

- **Requested by:** The user while reviewing the native Claude plugin delivery
  in PR #1821.
- **Cost of inaction:** The current user-scoped default activates Safeword in
  unrelated repositories and prevents a team from expressing its Claude plugin
  dependency in versioned project configuration.
- **Reversibility:** Cross-cutting but reversible. The CLI default, settings
  ownership, status model, migration guidance, and proof checks change, while
  an explicit user-scope option preserves the existing behavior.

## References

- Claude Code documentation: project scope writes plugin activation to
  `.claude/settings.json`; user scope applies across projects; marketplace
  plugins remain physically cached beneath the Claude profile.
- Existing native Claude plugin ticket `0S31PG` and PR #1821.

## Personas

- Technical Builder (TBU)
- Non-Technical Builder (NTB)

## Surfaces

Affected:

- Claude Code
- Safeword CLI

Unaffected:

- Claude Code Cloud — this feature governs local Claude CLI installation and
  cache behavior.
- OpenAI Codex and Cursor — their installation models do not change.

## Vocabulary

- **Project scope:** Claude records marketplace and plugin activation for the
  repository in `.claude/settings.json`; collaborators receive the declaration
  after cloning and trusting the project.
- **User scope:** Claude activates the plugin for the current profile across
  projects without adding project configuration.
- **Applicable installation:** A project-scoped installation bound to the
  current repository, otherwise a user-scoped installation available to it.
- **Scope overlap:** The current repository has an applicable project-scoped
  installation while the same profile also has Safeword installed at user
  scope.

## Jobs To Be Done

### choose-claude-plugin-scope.TBU1 — Choose the right activation boundary

**Persona:** Technical Builder (TBU)

> When I install Safeword for Claude, I want to choose whether it belongs to
> this repository or my whole Claude profile, so I can share team policy without
> losing the convenience of an app-wide setup.

#### choose-claude-plugin-scope.TBU1.R1 — Project scope is the predictable default while user scope remains an explicit supported choice

#### choose-claude-plugin-scope.TBU1.R2 — Installation and upgrade mutate only the selected scope and preserve unrelated state

#### choose-claude-plugin-scope.TBU1.R3 — Repeating installation in either scope is idempotent

### choose-claude-plugin-scope.NTB1 — Stay protected without ambiguous activation

**Persona:** Non-Technical Builder (NTB)

> When Safeword is present in more than one Claude scope, I want it to explain
> which installation applies and what I should do, so I never have to guess
> whether my project's guardrails are active.

#### choose-claude-plugin-scope.NTB1.R1 — Status identifies the applicable scope and reports overlap without silently removing protection

#### choose-claude-plugin-scope.NTB1.R2 — Legacy cleanup proceeds only from one unambiguous applicable and proven installation

## Rave Moment

skip: table-stakes — installation scope should be predictable and safe, not a
novel experience claim.

## Outcomes

- Teams can commit project-scoped Safeword activation.
- Developers can deliberately opt into profile-wide activation.
- Scope selection is preserved across upgrades and repeated commands.
- Existing installations in another scope are observed, never silently removed.
- Status and cleanup fail safely when overlapping activation is ambiguous.

## Open Questions

None. The user approved project scope as the default, explicit user scope as the
escape hatch, and explicit rather than automatic cross-scope cleanup.

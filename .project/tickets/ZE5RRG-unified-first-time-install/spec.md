# Spec: Give users one coherent Safe Word command model

## Intent

Give users one predictable CLI vocabulary for installing, inspecting, planning,
and removing Safe Word across project and agent scopes. The canonical path stays
small, while every existing alias continues working as an explicitly labeled
compatibility route.

## Intake Brief

- **Requested by:** Safeword maintainer reviewing the first-time installation experience.
- **Cost of inaction:** New users must discover separate setup and plugin installers, while existing users encounter duplicate health commands, overdue aliases, a silently ignored option, ambiguous flags, two JSON contracts, and lifecycle commands whose scopes do not line up.
- **Reversibility:** Two-way door for canonical naming, one-way compatibility obligation for shipped routes. Every existing command and option alias remains executable, so cleanup cannot strand scripts or learned workflows.

## References

- `README.md`, “Quick Start (30 seconds)”
- Existing `safeword setup`, `safeword claude install`, and `safeword codex install` command contracts
- `packages/cli/src/cli-protocol/catalog.ts`, the public command catalogue and compatibility metadata
- `packages/cli/src/commands/architecture.ts` and `packages/cli/tests/commands/architecture-stage.test.ts`, the current differential contract proving `--stage` reads from the index and stages generated output while `--staged` reads from the index without staging output
- `packages/cli/src/cli-protocol/catalog.ts`, which currently maps `reset` directly to project-only `remove` and identifies legacy raw JSON on `project test-plan` and `retro signals`
- `packages/website/src/content/docs/reference/cli.mdx`, the public CLI reference
- 2026-08-04 CLI surface audit: 30 canonical commands, 17 command aliases, duplicate `status`/`doctor` handlers, and lifecycle/documentation gaps
- [Command Line Interface Guidelines](https://clig.dev/) — human-first defaults, consistency, discoverability, dry-run safety, idempotence, and one `--json` convention
- [GNU command-line interface standards](https://www.gnu.org/prep/standards/html_node/Command_002dLine-Interfaces) — consistent long-option vocabulary and compatibility forms
- [POSIX.1-2024 utility syntax guidelines](https://pubs.opengroup.org/onlinepubs/9799919799/basedefs/V1_chap12.html) — comma-separated values for multi-value option arguments and predictable option grammar

## Personas

- Technical Builder (TBU)
- Non-Technical Builder (NTB)

## Surfaces

Affected:

- Safeword CLI
- Claude Code
- OpenAI Codex
- Cursor — default installation must leave its project configuration untouched; an explicit opt-in continues to support it.

Unaffected:

- Claude Code Cloud — the command manages a developer's local project and profile.
- OpenAI Codex Cloud — local profile plugins do not install into cloud containers.
- Cursor Cloud Agents — no Cursor project configuration is produced unless the user explicitly opts in.

## Vocabulary

- **Unified install:** One orchestration that reconciles project configuration, installs the Claude and Codex profile plugins, and reports activation follow-ups.
- **Agent selector:** The single `--agents=<comma-separated agents>` option shared by lifecycle commands. Supplying it replaces the default Claude-and-Codex selection with exactly the named integrations; `none` means project-only.
- **Canonical route:** The command form taught in help, quick starts, next actions, and machine capability metadata.
- **Compatibility alias:** A retained command or option spelling that delegates to a canonical route, stays outside the primary quick path, and emits structured compatibility guidance. It is hidden where the CLI host supports hiding that form.
- **Project configuration:** Repository-owned core Safe Word assets produced by reconciliation and intended to be committed.
- **Profile plugin:** User-scoped Claude Code or Codex installation outside the repository.
- **Cursor opt-in:** An explicit request to create or reconcile Cursor's project-local hooks, rules, and commands.
- **Concise status:** A short aggregate health result with prioritized next actions.
- **Deep diagnostics:** Doctor output that explains causes, coverage, and repair evidence beyond concise status.

## Jobs To Be Done

### unified-first-time-install.TBU1 — Install the native integrations at once

**Persona:** Technical Builder (TBU)

> When I adopt Safe Word in a project, I want one command to configure the
> repository and install its Claude and Codex integrations, so I can start
> using either native plugin without discovering additional installation steps.

#### unified-first-time-install.TBU1.R1 — One install reconciles the project and installs both native profile plugins

#### unified-first-time-install.TBU1.R2 — Agent selectors narrow installation to exactly the selected integrations

#### unified-first-time-install.TBU1.R3 — Default installation leaves Cursor configuration untouched

#### unified-first-time-install.TBU1.R4 — Cursor configuration is created only when `cursor` appears in `--agents`

#### unified-first-time-install.TBU1.R5 — Repeated installation converges safely across the selected surfaces

### unified-first-time-install.TBU2 — Predict lifecycle effects from one vocabulary

**Persona:** Technical Builder (TBU)

> When I inspect, plan, or reverse a Safe Word installation, I want the same
> scope selector and precise effect language, so I can predict what the command
> will read or change without memorizing exceptions.

#### unified-first-time-install.TBU2.R1 — Status and doctor are observably different commands, not duplicate names

#### unified-first-time-install.TBU2.R2 — Planning covers every effect of the matching lifecycle selection without mutating state

#### unified-first-time-install.TBU2.R3 — Uninstallation reverses only recognized Safe Word-owned state after exact-plan confirmation

#### unified-first-time-install.TBU2.R4 — Canonical options distinguish architecture input selection from output staging

#### unified-first-time-install.TBU2.R5 — Global `--json` is the sole canonical machine-output contract

#### unified-first-time-install.TBU2.R6 — Every shipped alias remains executable but is excluded from the canonical quick path

### unified-first-time-install.NTB1 — Know what remains after installation

**Persona:** Non-Technical Builder (NTB)

> When the installer finishes, I want plain-language results and exact next
> actions for each agent, so I know whether Safe Word is ready without
> understanding its project and profile architecture.

#### unified-first-time-install.NTB1.R1 — Results identify project, Claude, and Codex outcomes separately

#### unified-first-time-install.NTB1.R2 — Manual reload or restart requirements are presented as unfinished activation steps

#### unified-first-time-install.NTB1.R3 — A partial failure names what failed without hiding successful work

#### unified-first-time-install.NTB1.R4 — Destructive commands say what they deactivate, preserve, back up, and can recover

## Rave Moment

### unified-first-time-install — One mental model, old scripts still work

- **Moment:** Install, status, doctor, plan, and uninstall use one scope vocabulary, while an old script receives compatibility guidance and still succeeds.
- **Beats:** Guessing whether two commands are synonyms, whether removal includes plugins, or which JSON shape automation will receive.
- **They'd say:** "Safe Word has one obvious CLI, and it didn't break the commands I already had."

Grounding result: a detection-only installer or interactive wizard would reduce
typing, but would make CI behavior less explicit and hide what was selected.
The canonical-command-plus-compatible-alias model wins because it is guessable
for new users, composable for automation, and upward-compatible for existing
scripts. The premortem risk is that compatibility routes become a second
documented interface; mitigate it by excluding aliases from quick starts and
keeping them in one exhaustive compatibility table.

## Decisions

- Missing Claude or Codex tooling produces a per-surface partial result: successful project or agent work remains valid, the failed surface is named, and the next action is copyable.
- Repeated values in `--agents=` are normalized to one selection. `none` is valid only by itself; combining it with an integration is rejected before mutation.
- `--offline` with a network-requiring selected integration refuses before any mutation; `--agents=none --offline` remains the project-only offline route.
- `--no-input` never infers destructive consent. Install may run non-destructively; uninstall always previews and requires the exact returned plan for apply.
- Unqualified uninstall mirrors unqualified install (core project, Claude, and Codex) but is preview-only until exact-plan confirmation. Cursor remains untouched unless selected.
- Canonical architecture flags are `--from-index` for input selection and `--stage-output` for staging generated documents. Legacy `--staged` maps to `--from-index`; legacy `--stage` maps to both canonical flags.
- Compatibility metadata represents retained aliases with no scheduled removal date. Human and JSON output must not claim they become removal-eligible in a named release.
- Compatibility preserves every shipped spelling and its safety guarantees, not every historical side effect. The install-family aliases intentionally adopt the new unified selection contract; destructive `remove` and `reset` retain their existing project-only exact-plan confirmation behavior through `uninstall --agents=none`.
- `setup --yes` remains accepted but cannot imply additional consent because unified install is non-destructive; it reports that the compatibility option is redundant and names the canonical `install` route.
- Legacy raw JSON compatibility is limited to `project test-plan --format json` and `retro signals --format json`, including their retained aliases; other `--format` values are not reclassified as JSON compatibility routes.

## Outcomes

- `safeword install` becomes the documented first command for new users.
- The command reconciles core repository assets without changing Cursor configuration.
- The command installs the Claude Code and Codex profile plugins using their existing safety and proof contracts.
- The shared `--agents=` option accepts `claude`, `codex`, `cursor`, and project-only `none`; once supplied, unselected integrations remain untouched.
- Users receive one per-agent summary with Claude reload and Codex restart/new-task guidance.
- An NTB can use the completion summary to identify what is ready, what failed, and the one next action without understanding project/profile internals.
- A TBU can progressively disclose exact per-surface evidence, the selected scope, and a targeted retry without losing direct control.
- Users who run `install --agents=cursor` receive its project-local hooks, rules, and commands.
- Status stays concise; doctor provides additional causal diagnostics and coverage instead of duplicating status.
- Plan and uninstall use the same selection vocabulary and account for project, profile, Cursor, network, manual activation, destructive, backup, and recovery effects.
- Existing `setup`, `claude install`, `codex install`, `remove`, top-level command aliases, bare invocation, and option aliases keep working and return compatibility guidance.
- `setup --yes` is explicitly interpreted or reported rather than silently ignored.
- Global `--json` is the only documented stable envelope; legacy raw JSON remains available only as labeled compatibility behavior.
- Architecture commands use unambiguous canonical options while preserving `--stage` and `--staged` semantics.
- The CLI reference and capabilities catalogue exhaustively and accurately describe canonical routes, effects, and retained aliases.

## Verification Obligations

- Safeword CLI: exercise the registered command through its production catalogue, option parser, policy checks, handlers, and result renderer in a temporary project.
- Claude Code: exercise unified orchestration through the production Claude profile installer and status reader, mocking only the Claude subprocess/profile boundary; record a live-host `skip:` when Claude is unavailable.
- OpenAI Codex: exercise unified orchestration through the production Codex marketplace, plugin-cache, activation-marker, and status collaborators, mocking only the Codex subprocess/profile boundary; record a live-host `skip:` when Codex is unavailable.
- Cursor: exercise the production schema and reconciliation engine against a temporary project containing both Safe Word-owned and third-party Cursor content.
- Experience: record one NTB walkthrough of human output and recovery, and one TBU walkthrough of verbose/JSON evidence and targeted retry.
- Planning: divide implementation into independently testable slices and name the objective proof command for each.

## Open Questions

None.

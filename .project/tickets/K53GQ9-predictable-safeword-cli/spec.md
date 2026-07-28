# Spec: Give developers and AI agents one predictable Safeword CLI

<!--
Product-framing spec for a feature ticket. The engineering contract
(scope / out_of_scope / done_when) lives in ticket.md frontmatter; this
file holds the *why and who*. The bdd intake flow authors it before
engineering scope. Fill each section, then delete the
guidance comments.
-->

## Intent

Make Safeword feel like one dependable tool whether a developer reads its
terminal output or an AI agent consumes it as a protocol. Every command follows
one observable lifecycle and reports its effects and next action without
surprises.

## Intake Brief

<!-- The decide-to-build framing for substantial features (advisory — write
`skip: <reason>` on any line that doesn't apply). Intent above is the positive
"why"; this is who asked, the cost of NOT doing it, and how reversible it is.
If cost-of-inaction is low and reversibility is high, ask whether this is a
feature at all, or a leaner task. -->

- **Requested by:** Safeword's product owner after reviewing the Codex plugin
  migration and the CLI experience around it.
- **Cost of inaction:** Developers keep learning more than twenty inconsistent
  verbs, agents keep scraping prose, read-only-looking commands remain
  untrustworthy, and each new command creates another bespoke output contract.
- **Reversibility:** One-way public contract with a two-release compatibility
  bridge. The internals are replaceable, but command names, JSON fields, and
  exit semantics become user-facing APIs once released.

## References

- [GitHub issue #1574](https://github.com/ArcadeAI/safeword/issues/1574)
- [Command Line Interface Guidelines](https://clig.dev/)
- [Terraform plan](https://developer.hashicorp.com/terraform/cli/commands/plan)
- [Model Context Protocol tools](https://modelcontextprotocol.io/specification/2025-06-18/server/tools)

## Personas

- Technical Builder (TBU) — wants the state and one trustworthy next action
  without learning Safeword's implementation.
- Non-Technical Builder (NTB) — needs plain-language outcomes and safe
  confirmations rather than internal workflow jargon.
- Safeword Maintainer (SWM) — needs one typed execution model so new commands
  cannot drift in output, effects, or exit behavior.

## Surfaces

Affected:

- Safeword CLI
- Claude Code
- OpenAI Codex
- Cursor

Unaffected:

- Cloud-only agent lifecycle mechanics — agents consume the same repository
  CLI contract; this ticket does not change their hosting environments.

## Vocabulary

- **Plan** — a typed, immutable description of intended effects, warnings,
  confirmation requirements, and the verification that would follow. Creating
  a Plan never performs the effects.
- **Result** — the typed outcome after observing or applying, including state,
  findings, actual effects, and zero or more machine next actions.
- **Renderer** — the only layer allowed to turn a Result into stdout/stderr.
  Human and JSON renderers preserve the same semantics.
- **Public command** — a supported user/agent entrypoint listed by
  `safeword capabilities`; hidden hook and compatibility helpers are callable
  but are not public commands.
- **Action required** — a successful observation that cannot safely converge
  without a human decision or a subsequent mutating command; exits 2.

## Jobs To Be Done

### predictable-safeword-cli.TBU1 — Know what is true and what to do next

**Persona:** Technical Builder (TBU)

> When I run Safeword in a project, I want a fast, honest account of its state
> and one useful next action, so I can move forward without learning the tool's
> internal command map or wondering what it changed.

#### predictable-safeword-cli.TBU1.R1 — The default command reports project health without changing the project

#### predictable-safeword-cli.TBU1.R2 — Read-only commands remain read-only on first run, drift, and failure

#### predictable-safeword-cli.TBU1.R3 — Human output leads with the outcome, says whether anything changed, and offers no more than one next action

#### predictable-safeword-cli.TBU1.R4 — Destructive work shows an exact plan and requires explicit confirmation

#### predictable-safeword-cli.TBU1.R5 — Setup converges, and the second identical run reports no changes

### predictable-safeword-cli.NTB1 — Get safe, understandable guidance

**Persona:** Non-Technical Builder (NTB)

> When Safeword needs my attention, I want it to explain the consequence and
> give me one copyable action in ordinary language, so I can make a safe choice
> without interpreting logs or engineering jargon.

#### predictable-safeword-cli.NTB1.R1 — Action-required state is distinct from failure and never masquerades as success

#### predictable-safeword-cli.NTB1.R2 — Non-interactive operation never prompts or guesses consent

### predictable-safeword-cli.SWM1 — Extend one protocol instead of inventing another

**Persona:** Safeword Maintainer (SWM)

> When I add or change a command, I want its execution, effects, output, and
> discoverability governed by shared types and one command catalog, so humans
> and agents cannot receive contradictory versions of the same operation.

#### predictable-safeword-cli.SWM1.R1 — Plans and results have shared typed contracts and renderers own presentation

#### predictable-safeword-cli.SWM1.R2 — Every public command supports deterministic JSON and no-input operation

#### predictable-safeword-cli.SWM1.R3 — JSON uses one versioned envelope and stable error and exit semantics

#### predictable-safeword-cli.SWM1.R4 — Capabilities describe commands and effects without executing them

#### predictable-safeword-cli.SWM1.R5 — Normal help exposes the simplified hierarchy while old names remain deprecated aliases

#### predictable-safeword-cli.SWM1.R6 — Hook entrypoints stay hidden, quiet, offline, and free of install or upgrade effects

#### predictable-safeword-cli.SWM1.R7 — Long-running interactive commands report meaningful progress within 100 milliseconds

## Rave Moment

### predictable-safeword-cli — The CLI explains itself

- **Moment:** A developer types only `safeword`, immediately sees “Needs
  attention,” “Changed: nothing,” and one copyable `safeword plan` action;
  their agent runs the same operation with `--json --no-input` and acts without
  scraping a sentence.
- **Beats:** A wall of command help, surprise setup work, ambiguous warnings,
  and bespoke output adapters for every agent.
- **They'd say:** “Safeword tells me and my agent the same truth.”

## Outcomes

- A new user reaches a correct next action from bare `safeword` without opening
  help.
- An agent can enumerate capabilities, preview effects, execute without
  prompting, and distinguish failure from required human action using only
  stable JSON and exit status.
- Read-only command tests prove zero file, package, and network effects.
- Adding a public command requires a catalog entry and a typed handler, not a
  new presentation convention.
- Existing automation keeps working through explicit deprecated aliases during
  the compatibility window.

## Open Questions

- Resolved: `upgrade` remains public during the compatibility window but
  `setup` is the preferred convergent mutation; `plan` previews reconciliation.
- Resolved: `status`, `plan`, and `doctor` are the read-only allowlist. Any
  future read-only command must declare that effect class in the catalog.
- Resolved: a command may have multiple machine `next_actions`, but the human
  renderer selects exactly one primary action.
- Resolved: global flags are accepted before or after the command so shell
  authors and agents do not need positional special cases.
- Resolved: aliases retain existing side effects and arguments, add a
  machine-readable deprecation finding, and remain for the next two release
  lines.
- Resolved: hook latency is measured at p95 after one warm-up; the existing
  repository threshold remains authoritative rather than inventing a second
  number here.

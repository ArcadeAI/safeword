# Spec: Honor host JavaScript toolchains during agent edits

<!--
Product-framing spec for a feature ticket. The engineering contract
(scope / out_of_scope / done_when) lives in ticket.md frontmatter; this
file holds the *why and who*. The bdd intake flow authors it before
engineering scope. Fill each section, then delete the
guidance comments.
-->

## Intent

Let Safeword honor a project's declared JavaScript quality toolchain while it
continues to provide its own workflow and evidence gates. A host using
Ultracite's Biome presets or direct Biome must not be silently restyled or
checked by a competing Safeword default.

## Intake Brief

<!-- The decide-to-build framing for substantial features (advisory — write
`skip: <reason>` on any line that doesn't apply). Intent above is the positive
"why"; this is who asked, the cost of NOT doing it, and how reversible it is.
If cost-of-inaction is low and reversibility is high, ask whether this is a
feature at all, or a leaner task. -->

- **Requested by:** Safeword maintainer, following a toolchain-compatibility investigation.
- **Cost of inaction:** Agent edits can pass Safeword's generic ESLint step while failing the project's actual Ultracite/Biome/Oxlint policy, or receive conflicting automatic fixes.
- **Reversibility:** Two-way door; this changes local detection and hook dispatch without a public data format or migration.

## References

- `.project/tickets/V7GGJZ-formatter-aware-lint-hook/ticket.md` — established the safe baseline: skip Prettier for non-Prettier formatter owners while retaining ESLint.
- [Ultracite providers](https://docs.ultracite.ai/provider/biome) — current Biome, ESLint, and Oxlint preset model.

## Personas

- Safeword Maintainer (SWM)
- Technical Builder (TBU)

## Surfaces

Affected:

- Safeword CLI
- Claude Code
- OpenAI Codex
- Cursor

Unaffected:

- Claude Code Cloud — this feature changes locally-installed hook behavior only.
- OpenAI Codex Cloud — this feature changes locally-installed hook behavior only.
- Cursor Cloud Agents — this feature changes locally-installed hook behavior only.

## Vocabulary

- **Host toolchain:** The formatter/linter command and configuration a project
  has explicitly selected for its JavaScript and TypeScript files.
- **Provider adapter:** Safeword's mapping from a detected host toolchain to its
  safe file-fix and check commands.

## Jobs To Be Done

### honor-host-toolchains.SWM1 — Preserve the host project's quality contract

**Persona:** Safeword Maintainer (SWM)

> When I add Safeword to a project that already chose a JavaScript toolchain, I
> want its agent-edit hook to use that toolchain's supported fix and check
> commands, so Safeword reinforces the project's standards without creating a
> second, conflicting lint policy.

#### honor-host-toolchains.SWM1.R1 — A recognized host toolchain is the sole formatter and JavaScript policy fixer for edited files

#### honor-host-toolchains.SWM1.R2 — An existing Ultracite installation is adopted in place without configuration churn

#### honor-host-toolchains.SWM1.R3 — A recognized host toolchain's check result is surfaced to the agent as the JavaScript quality result for the edited file

#### honor-host-toolchains.SWM1.R4 — An unrecognized or unavailable host toolchain fails safely without suppressing Safeword's existing quality workflow

#### honor-host-toolchains.SWM1.R5 — Safeword-owned generated files stay outside the host toolchain's edited-file scope

#### honor-host-toolchains.SWM1.R6 — Ambient process settings cannot replace the selected host toolchain's configuration or executable

#### honor-host-toolchains.SWM1.R7 — Nested workspace dispatch selects only a canonical in-project owner

## Rave Moment

skip: internal compatibility work; success is invisible absence of toolchain conflicts.

## Outcomes

- A project whose host toolchain is recognized has its edited JavaScript files
  fixed and checked by that toolchain rather than by Safeword's generic
  formatting path.
- An existing Ultracite installation is used as-is: Safeword neither initializes
  it nor edits its dependencies, configuration, editor settings, or agent hooks.
- Direct Biome projects receive the same host-owned edit-time behavior.
- In a polyglot monorepo, the edited file's nearest workspace configuration
  determines its JavaScript toolchain and command working directory; sibling
  workspaces cannot affect it.
- If a recognized owner cannot be run from a project-local binary, Safeword
  reports the problem and leaves that file untouched rather than substituting
  a downloaded or generic JavaScript tool.
- Unsupported alternative formatter projects retain the existing safe behavior:
  Safeword does not run Prettier against their files.
- Safeword's workflow, testing, security, and evidence gates remain active.

## Open Questions

None.

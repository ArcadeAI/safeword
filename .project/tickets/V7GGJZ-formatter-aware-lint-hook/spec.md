# Spec: Formatter-aware lint hook: stop colliding with the customer's formatter

## Intent

Safeword's runtime auto-lint hook reformats every edited file with Prettier (forcing
`--config .safeword/.prettierrc`), regardless of the formatter the repo already uses. This feature
makes the hook **defer to the customer's formatter**: when a non-Prettier JS/TS formatter (Biome,
dprint, oxfmt, deno) owns the repo, safeword skips its Prettier step entirely; when the repo has its
own Prettier config, safeword formats with that; only greenfield repos get safeword's defaults. It
eliminates the prettier-vs-formatter churn that makes safeword unwelcome in established repos.

## References

- Epic: [2H2XKH formatter-coexistence](../2H2XKH-formatter-coexistence/ticket.md)
- Siblings: [9C2CFX inert-install](../9C2CFX-inert-install-no-churn/ticket.md), [EYRK34 ignore-safeword-paths](../EYRK34-formatter-ignore-safeword-paths/ticket.md)
- Prior art: [8BNSTE prettier-config-shadow](../8BNSTE-prettier-config-shadow/ticket.md) (install-time detection — this closes the runtime gap); 1J6JKP (exact-filename config detection, the `.bak` guard)
- Decision: locked to **A — skip** (see ticket.md "Decision").

## Personas

- **Technical Builder (TB)** — runs an AI agent under safeword on a real repo that already has a formatter.

## Vocabulary

- **Alternative formatter** — a non-Prettier JS/TS formatter that owns the repo's formatting: Biome, dprint, oxfmt, deno fmt (and legacy Rome). Detected by its config file at the project root.
- **Formatter ownership** — which tool resolves as the formatter for the repo: an alternative formatter, the customer's own Prettier config, or (greenfield) none.

## Jobs To Be Done

### formatter-aware-lint-hook.TB1 — Keep my formatter's style; no churn from the agent

**Persona:** Technical Builder (TB)

> When I run an agent under safeword on a repo whose JS/TS formatting is owned by a non-Prettier
> formatter (Biome, dprint, oxfmt, deno), I want the auto-lint hook to not reformat my files with
> Prettier, so my repo doesn't ping-pong between two styles on every edit.

#### formatter-aware-lint-hook.TB1.AC1 — JS/TS edits are not restyled by Prettier when an alternative formatter owns the repo

#### formatter-aware-lint-hook.TB1.AC2 — The same hands-off applies to markup/data files (JSON, CSS, YAML, Markdown) the alternative formatter owns

#### formatter-aware-lint-hook.TB1.AC3 — Safeword's non-style ESLint checks (security/complexity) still run on JS/TS in an alternative-formatter repo

### formatter-aware-lint-hook.TB2 — Format with my own Prettier config

**Persona:** Technical Builder (TB)

> When my repo has its own Prettier config, I want agent edits formatted with my config, so they
> match my house style rather than safeword's defaults.

#### formatter-aware-lint-hook.TB2.AC1 — On a repo with its own Prettier config, agent edits are formatted with that config, not safeword's

### formatter-aware-lint-hook.TB3 — Still get formatting on a greenfield repo

**Persona:** Technical Builder (TB)

> When my repo has no formatter of its own, I want safeword to keep formatting my files with its
> defaults, so I still get consistent formatting from the agent.

#### formatter-aware-lint-hook.TB3.AC1 — On a greenfield repo (no formatter config; a disabled/backup config does not count), agent edits are formatted with safeword's Prettier config

### formatter-aware-lint-hook.TB4 — Don't push Prettier on me

**Persona:** Technical Builder (TB)

> When my repo uses a non-Prettier formatter, I don't want safeword's session start warning that
> Prettier is missing or telling me to install it, so I'm not pushed toward a tool I don't use.

#### formatter-aware-lint-hook.TB4.AC1 — On a repo with an alternative formatter, the session lint check emits no "Prettier missing / install Prettier" warning

## Outcomes

- On a Biome/dprint/oxfmt/deno repo, editing JS/TS/JSON/CSS via the agent produces zero Prettier restyling — no churn, no prettier-vs-formatter ping-pong.
- ESLint's security/complexity value still applies on those repos.
- Repos with their own Prettier config, and greenfield repos, behave exactly as before (regression-guarded).
- A Biome user sees no Prettier nag at session start.
- oxfmt and deno are recognized as alternative formatters (new detection).

## Open Questions

- defer: per-workspace formatter detection in monorepos — root-cwd detection matches how the tools resolve (consistent with 8BNSTE / 1J6JKP); revisit only if a monorepo case forces it.

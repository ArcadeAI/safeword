# Spec: Epic: default namespace .safeword-project/ → .project/ (configurable root, legacy detection)

<!--
Product-framing spec for a feature ticket. The engineering contract
(scope / out_of_scope / done_when) lives in ticket.md frontmatter; this
file holds the *why and who*. The bdd intake flow authors it before
engineering scope. Fill each section, then delete the
guidance comments.
-->

## Intent

Make `.project/` the default safeword namespace root, replacing the prefixed
`.safeword-project/`, so that teams running both arcade and safeword maintain
shared project knowledge (personas, glossary, specs) in one place instead of
two. The root is configurable, and existing `.safeword-project/` installs keep
working untouched via automatic legacy detection.

## References

- [ticket.md](./ticket.md) — the four driver-locked intake decisions.
- P8RJ4M (done, superseded) — the cross-tool coexistence _bridge_; cancelled-by-convergence once this ships.
- K7N2QM (done) — the `paths.*` config machinery this epic extends with a root-level key.
- DZ2NM5 (done) — locked strict `.safeword-project/` ownership for personas/glossary; this epic revisits that default.

## Personas

- **Agent-Driven Developer (DEV)** — runs arcade and/or safeword on a real project; feels the duplicate-maintenance pain and adopts/migrates the convention.
- **Safeword Maintainer (SM)** — extends safeword itself; needs the resolution precedence defined in one place, not re-derived per call site.

## Vocabulary

- **Namespace root** — the directory holding safeword's project knowledge (tickets, learnings, personas, glossary). Default `.project/`; legacy `.safeword-project/`.
- **Legacy detection** — resolution that prefers an explicit config root, then `.project/`, then an existing `.safeword-project/`, so old installs keep working without migration.

## Jobs To Be Done

### project-namespace-default.DEV1 — Maintain shared knowledge in one place

**Persona:** Agent-Driven Developer (DEV)

> When I run both arcade and safeword on the same project, I want both tools to
> read my personas, glossary, and specs from one directory, so I can maintain
> that knowledge in a single place instead of keeping two copies in sync.

#### project-namespace-default.DEV1.AC1 — A fresh safeword install scaffolds the namespace at `.project/`

#### project-namespace-default.DEV1.AC2 — Safeword reads project knowledge (personas, glossary, architecture, tickets, learnings) from `.project/` whenever it is the resolved root

#### project-namespace-default.DEV1.AC3 — The default location of personas, glossary, and architecture derives from the resolved root, not a hard-coded prefix

### project-namespace-default.DEV2 — Point the namespace where my repo keeps it

**Persona:** Agent-Driven Developer (DEV)

> When my project keeps shared knowledge somewhere other than the default, I
> want to tell safeword where the namespace root lives, so I can adopt safeword
> without reorganizing my repo.

#### project-namespace-default.DEV2.AC1 — A configured root override redirects every namespace read/write to that location

#### project-namespace-default.DEV2.AC2 — Existing per-file `paths.personas` / `paths.glossary` / `paths.architecture` overrides still work and resolve against the root

### project-namespace-default.DEV3 — Upgrade an existing install without a flag day

**Persona:** Agent-Driven Developer (DEV)

> When I upgrade safeword on a project that already uses `.safeword-project/`, I
> want my existing layout to keep working untouched, so I can take the upgrade
> without a migration scramble.

#### project-namespace-default.DEV3.AC1 — An install with only `.safeword-project/` present continues to resolve there after upgrade

#### project-namespace-default.DEV3.AC2 — The upgrade introduces no new required migration step for existing installs

### project-namespace-default.DEV4 — Converge an old install via upgrade

**Persona:** Agent-Driven Developer (DEV)

> When I run `safeword upgrade` on a project still using `.safeword-project/`, I
> want it to offer to move me onto `.project/` as the recommended default, so I
> converge during a routine upgrade without a separate command or hand-editing
> paths.

#### project-namespace-default.DEV4.AC1 — Interactive `upgrade` on a legacy install prompts to migrate, defaulting to yes (recommended); accepting moves the namespace to `.project/` preserving git history

#### project-namespace-default.DEV4.AC2 — The move never happens without consent: scripted runs gate on `--migrate-namespace` / `--no-migrate-namespace`, and the non-interactive auto-upgrade hook only nudges

#### project-namespace-default.DEV4.AC3 — After a migration, resolution points at `.project/` and the old location is no longer consulted

### project-namespace-default.SM1 — Resolve the root in one place

**Persona:** Safeword Maintainer (SM)

> When I add a call site that needs the namespace root, I want one resolver to
> call, so I don't re-derive the precedence and risk drift across surfaces.

#### project-namespace-default.SM1.AC1 — A single resolver computes the root via the precedence (explicit config → `.project/` → legacy `.safeword-project/`)

#### project-namespace-default.SM1.AC2 — CLI, hooks, and skill surfaces consume that resolver rather than hard-coding the namespace literal

## Outcomes

- An arcade+safeword project authors personas/glossary once and both tools read them — zero duplicate files.
- Existing `.safeword-project/` installs keep resolving unchanged if they decline the upgrade prompt — declining is honored, nothing breaks.
- No surviving hard-coded `.safeword-project` namespace literal outside the resolver and its legacy-detection path.

## Open Questions

_All resolved during intake:_

- **Both-dirs-present resolution** — RESOLVED: both-dirs is a transient mid-migration state, not steady coexistence. Precedence: explicit config → `.project/` → legacy `.safeword-project/`. When both exist, `safeword check` emits an advisory.
- **Migration vehicle** — RESOLVED: the move lives in `safeword upgrade`, not a standalone command. Interactive upgrade on a legacy install prompts defaulting to yes (recommended); scripted runs gate on `--migrate-namespace` / `--no-migrate-namespace`; the non-interactive auto-upgrade hook only nudges. Never silent, never required — declining keeps `.safeword-project/` working (preserves decision #3 "detect, don't force").

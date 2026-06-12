# Spec: Single namespace-root resolver with legacy detection + literal migration

> Child of epic [AQJ95G](../AQJ95G-project-namespace-default/spec.md). The epic
> holds the full persona/JTBD/outcome story; this child carries the subset it
> implements: the resolver itself (SM1) and the resolution guarantees that
> depend on it (DEV1.AC2/AC3, DEV2, DEV3.AC1). Setup-scaffolding (N9S5XG) and
> upgrade-migration (9MMWS7) are sibling children.

## Intent

Compute the safeword namespace root in one shared resolver — explicit config
(`paths.projectRoot`) → `.project/` → legacy `.safeword-project/` — and route
every surface through it, so the default flips to `.project/` while existing
`.safeword-project/` installs keep resolving unchanged.

## References

- Epic [AQJ95G](../AQJ95G-project-namespace-default/spec.md) — parent, four locked decisions.
- K7N2QM (done) — the `configured-paths.ts` `paths.*` machinery this extends with a root-level key.
- Siblings: N9S5XG (setup scaffold), 9MMWS7 (upgrade migration) — both `depends_on` this ticket.

## Personas

- **Agent-Driven Developer (DEV)** — gets `.project/` as the default and a configurable root; existing installs keep working.
- **Safeword Maintainer (SM)** — gets one resolver to call instead of re-deriving precedence per call site.

## Vocabulary

- **Namespace root** — the directory holding safeword's project knowledge (tickets, learnings, personas, glossary, architecture). Default `.project/`; legacy `.safeword-project/`.
- **Resolution precedence** — explicit config `paths.projectRoot` → `.project/` → legacy `.safeword-project/`.

## Jobs To Be Done

### namespace-root-resolver.SM1 — Resolve the root in one place

**Persona:** Safeword Maintainer (SM)

> When I add a call site that needs the namespace root, I want one resolver to
> call, so I don't re-derive the precedence and risk drift across surfaces.

#### namespace-root-resolver.SM1.AC1 — A single resolver computes the root via the precedence (explicit config → `.project/` → legacy `.safeword-project/`)

#### namespace-root-resolver.SM1.AC2 — CLI, hooks, and skill surfaces consume that resolver rather than hard-coding the `.safeword-project` literal

### namespace-root-resolver.DEV1 — Read project knowledge from the resolved root

**Persona:** Agent-Driven Developer (DEV)

> When safeword reads my personas, glossary, architecture, tickets, and
> learnings, I want them read from whichever root resolves, so the new
> `.project/` default and my existing layout both just work.

#### namespace-root-resolver.DEV1.AC1 — The default location of personas, glossary, and architecture derives from the resolved root, not a hard-coded prefix

#### namespace-root-resolver.DEV1.AC2 — A project with only `.safeword-project/` present continues to resolve there

### namespace-root-resolver.DEV2 — Point the namespace where my repo keeps it

**Persona:** Agent-Driven Developer (DEV)

> When my project keeps shared knowledge somewhere other than the default, I
> want to set the namespace root in config, so I can adopt safeword without
> reorganizing my repo.

#### namespace-root-resolver.DEV2.AC1 — A configured `paths.projectRoot` redirects every namespace read/write to that location

#### namespace-root-resolver.DEV2.AC2 — Existing per-file `paths.personas` / `paths.glossary` / `paths.architecture` overrides still work and resolve against the root

## Outcomes

- Every namespace read/write flows through one resolver; no `.safeword-project` literal survives outside the resolver + its legacy-detection path (exhaustive grep, fresh build).
- A fresh project (or one with `.project/`) resolves `.project/`; a legacy-only project resolves `.safeword-project/` with no change.
- A configured `paths.projectRoot` redirects the whole namespace; per-file overrides still win for their file.

## Open Questions

_None — inherited from epic [AQJ95G](../AQJ95G-project-namespace-default/spec.md); both-dirs precedence and migration-vehicle resolved there. Both-dirs *handling* (advisory) and migration live in sibling 9MMWS7; this child only owns the precedence the resolver returns._

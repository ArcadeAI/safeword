# Spec: Upgrade-vehicle migration to .project/ + both-dirs advisory

> Final child of epic [AQJ95G](../AQJ95G-project-namespace-default/spec.md),
> implementing **DEV4** (converge via upgrade) and **DEV3.AC2** (no new
> required migration step). TAGWZ8 (resolver) and N9S5XG (setup scaffold) are
> done. Driver steer: seamless — the move is the default and recommended,
> never silent, never forced.

## Intent

A routine `safeword upgrade` is the moment an existing `.safeword-project/`
install converges on `.project/`: it offers the move as the recommended
default, performs it git-aware on consent, rewrites stale config overrides,
and continues the upgrade on the new root. Declining keeps everything working
where it is; `safeword check` nudges only when a half-finished state exists.

## Personas

- **Technical Builder (TB)** — upgrades safeword on an old project and gets walked across the namespace convention in one keystroke, or declines with zero consequence.

## Jobs To Be Done

### upgrade-namespace-migration.DEV1 — Converge an old install during a routine upgrade

**Persona:** Technical Builder (TB)

> When I run `safeword upgrade` on a project still using `.safeword-project/`,
> I want it to offer the move to `.project/` as the recommended default and do
> it safely when I accept, so I converge without a separate command, lost git
> history, or a broken config.

#### upgrade-namespace-migration.DEV1.AC1 — Interactive upgrade on a legacy install prompts to migrate, defaulting to yes; accepting moves the namespace preserving git history

#### upgrade-namespace-migration.DEV1.AC2 — The move never happens without consent: declining keeps legacy untouched; scripted runs gate on `--migrate-namespace` / `--no-migrate-namespace`; non-interactive runs only nudge

#### upgrade-namespace-migration.DEV1.AC3 — After migration, resolution points at `.project/`, stale per-file config overrides are rewritten, and the rest of the upgrade operates on the new root

#### upgrade-namespace-migration.DEV1.AC4 — A half-finished state (both directories present) is surfaced by `safeword check` as an advisory naming the finishing action

## Outcomes

- Legacy installs converge on `.project/` through normal upgrades — no support docs for a separate migration procedure.
- Zero reports of a silent or unwanted namespace move.

## Open Questions

_None — consent model, vehicle, and both-dirs semantics were locked at epic intake (driver-confirmed: default and recommended, never silent)._

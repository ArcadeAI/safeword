# Spec: Warn on stale tooling-config namespace refs after migration

> Follow-up to epic [AQJ95G](../AQJ95G-project-namespace-default/spec.md),
> ticket 9MMWS7. The design decision was settled by `/figure-it-out` (this
> session): detect-and-warn at migration time, never auto-edit. Found during
> the v0.46.0 dogfood, where this repo's own `eslint.config.ts` failed lint
> after the migration moved the namespace.

## Intent

A successful `--migrate-namespace` move is seamless for safeword-owned state,
but a customer's hand-authored tooling config (eslint, prettier, tsconfig, CI)
that referenced `.safeword-project/` silently goes stale and breaks lint/CI.
The migration names those files so the developer can fix them in the same
review where they commit the move — without safeword editing files it doesn't
own, and without false-flagging the documentary references that legitimately
keep the old path.

## Personas

- **Technical Builder (TB)** — runs `safeword upgrade --migrate-namespace` on a real project and needs their lint/CI to keep working, or to be told exactly what to fix.

## Jobs To Be Done

### migration-stale-config-warning.TB1 — Don't let the move silently break my tooling

**Persona:** Technical Builder (TB)

> When `safeword upgrade` moves my namespace to `.project/`, I want it to tell
> me which of my own tooling configs still point at the old path, so I fix my
> lint/CI in the same commit instead of discovering it as a broken build —
> and without safeword editing my files or crying wolf over references that
> are fine.

#### migration-stale-config-warning.TB1.AC1 — After a move, tooling configs still referencing the legacy path are named in the upgrade output, with the old→new mapping

#### migration-stale-config-warning.TB1.AC2 — Safeword edits none of those files — the warning lists, the developer decides

#### migration-stale-config-warning.TB1.AC3 — No false positives: a clean repo, the safeword-managed both-roots `.prettierignore` block, and documentary references under the namespace dir produce no warning

#### migration-stale-config-warning.TB1.AC4 — The warning fires only when the migration actually moved the directory (silent on decline, both-dirs, custom-root, already-current)

## Outcomes

- Zero "lint broke after I upgraded" surprises that trace to a stale namespace path the migration could have named.
- No reports of safeword editing a tooling config the user didn't ask it to touch.

## Open Questions

_None — vehicle, the never-auto-edit stance, the curated file set, and the managed-block exclusion were all settled at /figure-it-out._

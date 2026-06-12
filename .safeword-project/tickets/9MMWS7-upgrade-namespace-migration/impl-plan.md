# Impl Plan: Upgrade-vehicle migration to .project/ + both-dirs advisory

**Status:** planned

## Approach

Build order, each step green before the next:

1. **Migration module** (`packages/cli/src/utils/namespace-migration.ts`) — pure-ish core: `planNamespaceMigration(cwd)` returns one of `{offer | already-current | both-dirs | custom-root | blocked}`; `executeNamespaceMigration(cwd, {git})` performs git mv (tracked repo) or fs rename, then rewrites stale per-file `paths.*` legacy prefixes in `.safeword/config.json`. **Unit layer** — covers plan states, the move (git/non-git), the blocked-target failure, and the config rewrite (8 of 14 scenarios).
2. **Upgrade wiring** (`packages/cli/src/commands/upgrade.ts`) — BEFORE `createProjectContext`/reconcile: resolve consent (`--migrate-namespace` → yes; `--no-migrate-namespace` → no; TTY → `confirmMigration` prompt defaulting to yes via injected confirm seam (`node:readline/promises`, EOF → decline); non-TTY → one-line nudge). On accept: execute migration, then proceed — context creation after the move picks up `.project/` so the same run reconciles on the new root. **Integration layer** — flag-driven subprocess scenarios; prompt pair via the injected seam (unit).
3. **Check advisory** (`packages/cli/src/commands/check.ts`) — both-dirs → zero-exit advisory naming `safeword upgrade --migrate-namespace`; silent on any single root. **Integration layer** (subprocess, mirrors existing advisory tests).
4. **CLI flags** (`cli.ts`) — `--migrate-namespace` / `--no-migrate-namespace` on the upgrade command.
5. **Full suite + fresh build.**

## Decisions

| Decision             | Choice                                                       | Alternatives considered                        | Rejected because                                                                                                   |
| -------------------- | ------------------------------------------------------------ | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Prompt mechanism     | `node:readline/promises` behind an injected confirm function | prompts/inquirer dependency; raw stdin parsing | Zero deps (bundled-packs ADR ethos); the seam makes the TTY pair unit-testable and EOF-safe                        |
| Migration timing     | Before context creation in `upgrade()`                       | After reconcile; separate command              | Context must see the post-move tree so one run finishes coherently (AC3); separate command rejected at epic intake |
| Failure posture      | Report and continue upgrade on the legacy root               | Abort the whole upgrade                        | A failed _optional_ migration shouldn't break a routine upgrade — seamless ethos; legacy keeps working by design   |
| Config rewrite scope | Only per-file `paths.*` values prefixed `.safeword-project/` | Rewriting arbitrary config strings             | Surgical and reversible; anything else is user content                                                             |

## Arch alignment

Consulted `ARCHITECTURE.md` (repo root):

- **Reconciliation engine modes** — migration stays OUT of reconcile (it's a one-time consensual tree mutation, not idempotent state convergence); upgrade composes the two.
- **Bundled packs / no external packages** — readline/promises keeps the zero-dependency stance.
- **Graceful fallback pattern** (linter fallback precedent) — git mv falls back to fs rename; blocked move degrades to a report, never a broken tree.

## Known deviations

`skip: no deviations planned` — composes the TAGWZ8 resolver and N9S5XG context seam as designed.

## Assessment triggers

- If a second command ever needs a confirm prompt, extract the seam into `utils/prompt.ts`.
- If both-dirs persists in the wild (advisory telemetry/issues), revisit the refuse-and-advise stance with a guided merge.

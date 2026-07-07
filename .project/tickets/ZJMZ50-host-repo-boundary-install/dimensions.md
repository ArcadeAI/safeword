# Dimensions: host-repo boundary-gate installation (ZJMZ50)

Derived from intake (spec.md Rules TB1.R1–R5, SM1.R1–R2; scope frontmatter)
plus domain knowledge and the #888 environment guide-words.

## Dimension table

| Dimension                          | Partitions                                                                                                                                                                  |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Hook-manager world                 | husky · lefthook · pre-commit framework · bare (git, no manager) · conflicting signals (e.g. `.husky/` dir AND `lefthook.yml`)                                              |
| Hook-file pre-state (husky world)  | no `.husky/` at all · `.husky/` exists, hook file absent · hook file with user content · shim already present (idempotency) · stale shim from older version (heal)          |
| Reconcile mode                     | install (setup) · upgrade · uninstall (reset) — each must be symmetric over the same schema entries                                                                         |
| Git context                        | git repo at cwd · non-git directory · git repo where cwd ≠ repo root (monorepo subdir)                                                                                      |
| Nudge lifecycle                    | first run prints snippet · target config already integrates the gate (self-quiescing) · repeat runs stay quiet                                                              |
| Shim runtime (emitted-line shape)  | binary present → gate runs · binary absent (fresh clone, deps not installed) → silent pass-through · gate exits non-zero → hook still passes (`sh -e` + whole-line `\|\| true`) |

## Environment guide-words (#888 trial)

- **gone/partial** — `node_modules` absent at hook time (fresh clone before install): existence guard no-ops, commit proceeds. `.husky/_` runner absent (husky dep never `prepare`d): hooks don't fire at all — not ours to fix, no nudge noise.
- **rewritten** — user deletes the shim block: upgrade re-adds it (standard textPatch semantics — consistent with every managed block; opting out permanently = reset or removing safeword). User edits *around* the block: marker detection leaves their content alone.
- **other hands** — another tool appends its own line to the same hook file after ours: our marker block is untouched and both run. Teammates who never ran setup still execute the versioned shim (safeword is a devDependency for all packs), and the guard keeps it safe if their install is stale.
- **other cadence** — host upgrades safeword across a shim-line change: the block heals in place (rerender) rather than duplicating or skipping stale.
- **many at once** — monorepo: hooks belong at the git root; setup run in a workspace subdir must not plant a dead `.husky/` where git never looks.

## Partition → Rule mapping

- Hook-manager world → TB1.R1 (husky), TB1.R3 (lefthook/pre-commit), SM1.R1 (world-gated schema), bare → nudge (TB1.R3 sibling scenario)
- Hook-file pre-state → TB1.R1 (content preserved), TB1.R2 (idempotent), SM1.R1 (heal)
- Reconcile mode → SM1.R1 (install/heal), TB1.R5 (reset revert)
- Git context → SM1.R2 (non-git silent), monorepo-subdir partition (SM1.R2 sibling)
- Nudge lifecycle → TB1.R3 (exact snippet, self-quiescing)
- Shim runtime → TB1.R4 (never blocks)

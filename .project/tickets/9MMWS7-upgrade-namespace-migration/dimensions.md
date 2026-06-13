# Behavioral Dimensions — upgrade-vehicle migration

Migration behavior is a function of `(install state, consent channel, git
state)`; the advisory is a function of directory presence.

| Dimension             | Partitions (equivalence classes + boundaries)                                                                                                                     | ACs proved |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Install state         | legacy-only (offer) · `.project/` already current (no offer) · both dirs (refuse + advise) · configured custom root (no offer, boundary)                          | AC1, AC4   |
| Consent channel       | `--migrate-namespace` flag (yes) · `--no-migrate-namespace` (no) · TTY prompt accept (Enter/default) · TTY prompt decline (n) · non-TTY no flag (nudge, boundary) | AC1, AC2   |
| Git state of the move | tracked dir in a git repo (git mv, history preserved) · untracked/non-git (fs rename fallback, boundary)                                                          | AC1        |
| Post-move integrity   | resolver lands on `.project/` · stale per-file `paths.*` overrides rewritten · reconcile continues on the new root in the same run                                | AC3        |
| Advisory              | both dirs present (advisory fires, zero-exit) · single root (silent)                                                                                              | AC4        |

**Domain-knowledge boundaries not surfaced in intake:**

- **Decline memory** — declining the prompt must not re-prompt every future upgrade into nagging; the nudge line is acceptable, a modal prompt each run is the experience risk. Settled: prompt every interactive upgrade is fine for v1 (legacy installs shrink monotonically), but the prompt is one line and Enter accepts.
- **Mid-move failure** — git mv/rename failing midway must leave a coherent state; the move is a single directory rename (atomic on one filesystem), so the failure cell is "rename threw → report, change nothing else".
- **Auto-upgrade hook** — runs `safeword upgrade` with no TTY; covered by the non-TTY partition (nudge only).

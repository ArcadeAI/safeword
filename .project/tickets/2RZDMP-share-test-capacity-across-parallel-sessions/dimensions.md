# Dimensions: Let parallel sessions share test capacity safely

Derived from [spec.md](./spec.md). The partitions below define the smallest
set of materially different states the feature scenarios must exercise.

| Dimension | Partitions | Rules |
| --- | --- | --- |
| Protocol participation | all current-protocol wrappers / legacy wrapper present / current protocol not initialized | R1, R6 |
| Run classification | existing literal default-convention test files / existing non-test file / mixed test and non-test files / nonexistent path / directory / direct symlink / symlinked ancestor / lexical or canonical checkout escape / glob or pattern / option-like token / `--` boundary / no filter / coverage / done lane / alternate or unknown flag mixed with files | R1, R3, R4 |
| Shared capacity | default one / configured 2..8 / malformed / below one / above eight / change while idle / change with owner or waiter | R1, R6 |
| Checkout relationship | distinct worktrees / same worktree | R1, R2 |
| Queue head | focused / consecutive focused / broad / dead waiter / unverifiable waiter | R1, R3, R4, R5 |
| Available permits | none / some / all | R1, R3, R4 |
| Owner lifecycle | waiting / reserved / active / releasing / abandoned before activation / abandoned after activation | R3, R5 |
| Cancellation point | queued / reserved before repository code / active | R3, R5 |
| Container platform | Linux out-of-group supervisor plus process group / macOS out-of-group supervisor plus process group / Windows out-of-job supervisor plus named owner-only Job Object / primitive unavailable | R5, R6 |
| Process identity | exact live instance / exact absent instance / reused PID or PGID / surviving group member / missing, malformed, denied, or changed birth identity | R5 |
| POSIX descendant behavior | ordinary inherited descendant / deliberately detached descendant | R5 |
| Scheduler state | valid current schema / unreadable or corrupt / newer schema / interrupted pre-rename / interrupted post-rename | R5, R6 |
| Capacity-domain identity | stable machine and user identity / unavailable / changed or conflicting / prior domain proven idle and explicitly reset | R5, R6 |
| Checkout mutex recovery | queued or reserved wrapper absent / active wrapper absent with live container / active container proven empty / reused or unverifiable wrapper or container identity | R2, R5 |
| Guard order | checkout then scheduler then reverse release / wait fails or cancels / attempted opposite ordering | R2, R5 |
| First-use ordering | concurrent initialization / interrupted initialization recovery / initialization and first registration held in one guarded transition before a waiting capacity change | R6 |

## Partition notes

- The completed 72WMQ5 fix is the compatibility baseline: capacity one must
  preserve its machine-wide serialization and must never restore an unlocked
  wait-cap fallback.
- Classification is intentionally conservative. Only explicit test-file
  arguments that resolve to existing non-symlink regular files inside the
  checkout, with no option or pattern syntax, are focused; every ambiguous
  form is broad while downstream command validity remains unchanged.
- Fairness is observable at the live queue head. Consecutive focused requests
  may batch only until a broad request reaches the head; later focused work
  cannot pass it.
- `reserved` and `active` are separate crash partitions because repository code
  must be unable to run before active container identity is durable.
- Reclamation depends on exact OS process incarnation, never PID or elapsed
  age alone. Unverifiable identity is a fail-closed state, not a stale-owner
  state.
- POSIX deliberately detached descendants are a named unsupported boundary;
  scenarios must not claim containment that process groups cannot enforce.
- Mixed legacy/current execution is excluded, not silently made safe. A legacy
  wrapper may be used only after current capacity is one, the scheduler is
  idle, and the operator positively confirms every untracked legacy execution
  has ended.

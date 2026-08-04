# Dimensions: Close completed sessions safely

| Dimension | Partitions and boundaries | Rules |
| --- | --- | --- |
| Delivery evidence | current local verification and required hosted checks green · verification missing/stale/failing · hosted checks pending/failing · draft or review requirement unresolved | NTB1.R1 |
| Merge authority | observe/report only · explicit normal merge · explicit administrative merge · implied or ambiguous authority | TBU1.R1 |
| Merge completion | direct merge confirmed · already merged · merge queue entered · auto-merge enabled · command failed before merge · command failed after remote merge | NTB1.R1, NTB1.R3, TBU1.R1 |
| Retro completion | zero findings and empty spool · findings filed and empty spool · extraction failed · filing/spool drain incomplete | NTB1.R2, NTB1.R3 |
| Closeout restart point | before merge · waiting in queue · merged before cleanup · worktree removed with branches remaining · already complete | NTB1.R3 |
| PR and branch identity | one exact PR/head SHA match · no PR · ambiguous PR · local head advanced beyond PR · remote head differs or disappeared | TBU1.R2, TBU1.R3 |
| Worktree target | exact clean linked worktree · no linked worktree · main worktree · dirty · locked · ambiguous or stale registration | TBU1.R2, TBU1.R3 |
| Branch cleanup | local and remote present · one already absent · squash/rebase merge with exact head · unmerged or extra local commits · branch checked out elsewhere | NTB1.R3, TBU1.R2, TBU1.R3 |
| Final report | fully closed · queued/pending · merged with incomplete retro · merged with incomplete cleanup · blocked before merge | NTB1.R1, NTB1.R3 |
| Host distribution | canonical source · dogfood Claude · generated Codex · generated Cursor command · one surface drifted | TBU1.R4 |

## Boundary decisions

- A successful merge command is not merge evidence. Cleanup requires a fresh
  pull-request observation whose state is merged and whose head identity still
  matches the preflight target.
- Entering a merge queue or enabling auto-merge is an unresolved closeout state;
  the workflow waits and re-observes instead of deleting early.
- Retro is complete only after extraction and the code-owned filing path finish
  with no pending spool. Zero findings is a valid completed result.
- A local branch that advanced beyond the pull request head is never deleted,
  even when the pull request itself merged.
- Squash and rebase merges may require non-ancestry branch deletion, but only
  after the exact local head matches the independently confirmed merged PR head.
- Worktree removal never uses force. Dirty, locked, main, ambiguous, and stale
  registrations are preserved with a concrete recovery action.
- Closeout is idempotent: an already-absent exact target is complete, while an
  absent or changed target whose identity was never established is unresolved.

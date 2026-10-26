# Behavior Dimensions: Implementation-exit branch review

| Dimension | Representative partitions and boundaries | Rules |
| --- | --- | --- |
| Branch scope | Committed add/modify/delete/rename; caller-supplied later base; configured ref naming the current topic branch; topic tracking a configured non-default integration ref; no changed paths; missing merge base; already-merged work; nonignored staged, unstaged, or untracked work | TBU1.R1, TBU1.R4, NTB1.R3 |
| Evidence | Small authored change; multiple bounded passes; generated output; oversized or unreadable change; sensitive content withheld; failed pass | TBU1.R1, NTB1.R2, NTB1.R3 |
| Ticket context | Accepted goals and scenarios available; goals change after review; routine Work Log or phase edit | TBU1.R2, TBU1.R3 |
| Findings | Cross-file behavior gap; no actionable finding; priority and consequence | TBU1.R2, NTB1.R2 |
| Freshness | Change before exit; later code, test, scenario, or goal change; commit of identical content; phase/status/timestamp/log/verify/audit bookkeeping | TBU1.R3, TBU1.R4, NTB1.R3 |
| Coverage | All eligible paths reviewed; named omission; empty diff or missing base; partial result with agent disclosure | TBU1.R4, NTB1.R1, NTB1.R3 |
| Entry points | Shared CLI and supported Claude Code, Codex, Cursor, and OpenCode local flows; advisory surfaces report limits | TBU1.R4, NTB1.R2 |

The project and milestone non-goals exclude per-edit reviews, GitHub PR-review changes, and claims of exhaustive understanding across bounded passes.

## Proof placement

The feature file covers the branch-wide happy path, caller narrowing, cross-file finding, freshness at exit, later code edits, routine bookkeeping, host wiring, omissions, valid exit, partial continuation, and empty inventory. Lower-level tests cover a caller-selected subset of changed files being refused or ignored without narrowing the automatic inventory, with the unselected path still reported; Git path variants (including both rename names and ignored committed paths), working-tree states, missing base, already-merged work, missing or changed ticket context, exact snapshot comparison across passes, a new commit with identical reviewed content after exit staying current, receipt-bound omission sets, sensitive withholding, generated classification, and packet bounds. The identical-content exception applies after implementation exit; the exit check still validates the reviewed head. The Implementation Plan names the exact bookkeeping fields and ticket evidence paths allowed after exit; an unlisted authored path is reviewable by default. Tests must exercise the real entry point for each host whose hook can block and distinguish advisory hosts.

The `branch-review-gate.test.ts` exit matrix must vary committed edits, staged edits, unstaged edits, untracked files, and ticket-goal edits after a clean review; it must also refuse a missing-base review at implementation exit. Its `keeps a saved review current after verification checklist progress` proof separately creates a test file and a scenario file after review, checks that each makes the review stale, then removes each and checks that the review is current again. These two file classes are required freshness cases, not ticket bookkeeping. Its `rejects changed ticket goals until they are reviewed again` proof changes a ticket goal after implementation exit and refuses the verify-to-done transition as stale. The `branch-review.test.ts` Git matrix must cover rename/delete pairs, committed ignored paths, generated and oversized files, missing base, and sensitive-content withholding before reviewer dispatch.

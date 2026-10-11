# Gate audit against current code (v1.1.0, 2026-10-11)

This audit checks the 7 highest-friction gate groups from [report.md](report.md) (#5750) against `main` (`d5885e587`).

## Method

Each group's open retros were reduced to distinct, testable claims. For each claim, the audit read the responsible code (file:line) and checked `git log` for any change made after the newest report. Where it was cheap, the claim was reproduced by piping crafted hook payloads into the template hooks in a scratch sandbox. Reports were treated skeptically, because agents wrote them: some claims are by design, wrong, or caused by the host rather than Safeword.

Every group still has its core problem at HEAD. None of the code behind the "still present" verdicts has changed since the newest report in its group.

## Summary

| #   | Gate group                  | Status        | Core problem still in the code                                                                                                                                                                                                                                                                                                                                           | Smallest fix                                                                                                                                  |
| --- | --------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Rules found only by failing | Still present | `deny()` puts the remedy in `additionalContext`, not in the reason (`templates/hooks/pre-tool-quality.ts:154-166`). Cursor and Codex exit-code mode drop that field. On Claude, the docs don't say whether the model sees it on a deny, and retros report missing remedies. The most-reported case is the jargon block on Bash writes to `ticket.md`/`spec.md` (`:428`). | Append the remedy to `permissionDecisionReason` in `deny()`, and reword the Bash-write message.                                               |
| 2   | Dependency-readiness gate   | Still present | Hashes all of `package.json` (`lib/dependency-readiness.ts:314-335`), so script and version edits read as stale. The remedy `rm -f … && touch` is cwd-relative and is rejected by Codex (`:803`). Nothing auto-installs.                                                                                                                                                 | Hash only the dependency fields. Make the remedy just the install command, since post-tool already stamps the marker.                         |
| 3   | Machine-wide test lock      | Still present | The lock is held through the whole `vitest run` (`scripts/run-vitest-with-build-lock.mjs:776-792`), even though the package snapshot already isolates `dist`. It waits 60s and polls with no queue. The Stop hook's 60s cap reports a timeout as "Tests failed" (`templates/hooks/lib/test-runner.ts:71`).                                                               | Release the lock after `createPackageSnapshot()`, then confirm no other shared resource needs serializing.                                    |
| 4   | Brittle edit guards         | Still present | The Codex `apply_patch` reader merges all hunks into one string (`codex/pre-tool-quality-helpers.ts:136-156`), so multi-hunk ticket edits are denied. The Bash guard denies commands that only read or mention ticket files (`lib/bash-ledger-writes.ts`), even outside the project. The persona gate rejects `` `PE` `` (`lib/jtbd.ts:81`).                             | Split hunks on `@@` into an edits array. Deny only when a write appears near the path. Strip inline markdown from persona text.               |
| 5   | Stop-hook reply format      | Still present | Any tool use in a turn requires a full verdict (`templates/hooks/stop-quality.ts:460-473`), including waiting and status turns. `SAFEWORD.md:237` says short replies may end with a question. Cursor requires the verdict only after edits. A colon instead of an em dash gets no hint, and "no extra context" doesn't name the offending sentence.                      | Require the verdict only after file edits, matching Cursor. Add near-miss hints.                                                              |
| 6   | Review stamps               | Still present | Fingerprints hash the full bytes of `ticket.md` and the ledger (`src/review/job.ts:313-332`), so phase, work-log and RED-tick edits make reviews stale. The scenario-gate check accepts only ticket-local files (`lib/review-receipt.ts:179-182`), but BDD puts features in repo `features/`. Three separate CLI resolvers ignore the Claude plugin cache.               | Drop workflow fields (`phase:`, `status:`, the work log, ledger ticks) in `reviewFingerprintContent` before hashing. Accept `paths.features`. |
| 7   | 400-line commit gate        | Still present | `countLoc()` adds insertions and deletions over the whole repo diff (`templates/hooks/post-tool-quality.ts:135-150`), excluding only Safeword config folders. Generated output, lockfiles, deletions and other sessions' changes are all counted. New untracked files and Bash writes are not counted.                                                                   | Count insertions only. Exclude generated files and lockfiles. Allow edits to files that are already dirty.                                    |

## Closeable retros (fixed or misattributed)

- **Fixed:**
  - Main checkout gating a worktree: #5510, #5252, #5258 (`ad83e1b95`).
  - `phase_anchors` docs: #3191, #3168, #3134, #3152, #1205 (`9601aebc4`).
  - Invalid review kind lists the valid set: #3489.
  - Choice-vs-Action handoff drift: #5390, #5414, #5480, #5528, #5611, #5640, #5648 (v1.1.0: `290d9c446`, `5947171f2`, `db4a4fefa`).
  - Stop review evidence without a ticket, on Claude: #1311, #3221, #5378.
  - Lock busy exit 75 and message: #3216, #4088, #4122, #4378, #4395, #5044 (`52e167046`).
  - Stamp `--help` handling: #4808, #4719, #4539, #4517, #3644, #3326, #3246, #2043 (`b3798f11d`).
  - Receipt exclusions: #5485, #5429 (`00ea87b83`).
  - Principle-trace parser: #3940, #3941, #3985, #4050 (`659a20731`).
- **Wrong or by design:**
  - #5219 (python3 is not gated).
  - #5595 and #4973 (`bun ci` exists on Bun ≥1.3; those runs had Bun 1.2 on PATH).
  - #1351 (Safeword never auto-creates WIP commits).
  - #5712 (does not reproduce at HEAD).
- **Not Safeword (Claude Code harness):** #5359, #5348, #5295, #5254, #4997, #3209, #5676, #4778.

Before closing any of these, check that the reporter's installed version postdates the fixing commit. Several reports are newer than the fix and probably ran against an older installed copy.

## Unverified

- Group 1: whether Claude Code shows PreToolUse `additionalContext` to the model on a deny. The docs are silent. Testing it with a hook that returns both fields would settle it.
- Group 6: the fresh-worktree CLI-not-found report (#5658) needs a no-`node_modules` worktree to reproduce.

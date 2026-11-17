---
id: AHYMS2
slug: keep-approvals-across-bookkeeping
type: task
phase: done
status: done
scope:
  - Ticket identity ignores Work Log journal entries, its heading and phase_anchors
  - Stale planning receipts name changed, added or removed sources
  - Hook-written phase stamp lines never change the identity, wherever they land
out_of_scope:
  - approve-plan prompt recheck (PR 7215)
  - planningSurfaceIdentity reference definitions
  - Review runner and stamp verifier selecting different Safeword versions
done_when:
  - Work Log journal and phase_anchors edits keep planning approvals current
  - Contract edits, the execution-discovery notice and referenced link destinations still stale them
  - Trial N4DYBQ replay shows the 01:29, 01:46 and 04:46 refreshes avoided and the 02:58 cap still stale
created: 2026-11-12T05:47:19.091Z
last_modified: 2026-11-12T05:47:19.091Z
---

# Keep valid approvals when agents update ticket bookkeeping

**Goal:** Ticket Work Log bookkeeping no longer stales planning approvals, while real contract changes still do

**Why:** Issue #5766: phase changes appended a Work Log line that staled every planning approval and forced repeated reviews

**Tracking:** #5766 · PR #7200 · branch `claude/github-issue-5766-3448f4`

## Process note

This ticket was opened after the work was done. The fix was built test-first on the core unit tests but without a Safeword ticket. Plan reviews were Codex quality reviews of `proposal-5766.md`, not stamped phase reviews. The `tdd-review`, `/verify` and `/audit` steps run under this ticket to close that gap. Scenarios were not written before code, and this ticket does not claim they were.

## Root cause

`semanticTicketIdentity` (`packages/cli/src/review/planning-context-identity.ts`) ignored `phase`/`status` but hashed the whole ticket body. `post-tool-work-log.ts` appends `- <time> Phase: X → Y` on every phase edit, so a phase change staled every scenario-gate, plan-implementation and plan-execution approval. Trial N4DYBQ receipts show the ticket digest was the only changed input at 01:29 and 01:46.

## Scope

- In: the ticket identity ignores the `## Work Log` heading, its top-level lists, paragraphs and definitions, plus `phase_anchors`. Stale planning receipts name each changed, added or removed source. The identity strips the trailing run of hook-format phase stamp lines (`- <ISO>Z Phase: X → Y`) from the text before parsing. The hook still appends at end of file, as on main, so removing the stamp restores the prior text exactly, whatever Markdown the ticket ends with. The execution-discovery notice ends with a blank line, so a later note cannot join its quote. New tickets mark the Work Log as progress history.
- Kept bound: frontmatter contract fields and unknown keys, same-kind `review_dispositions`, headings and blockquotes in the Work Log (the execution-discovery notice), sections after the Work Log, and referenced link definitions (first definition wins, including nested ones).
- Accepted limitation (user decision, 2026-11-14): a ticket whose last lines are stamp-shaped text inside an unclosed code fence loses that text from its identity, so editing it does not stale approvals. None of 62,926 local tickets ends inside an unclosed fence or holds stamp-shaped text in a fence. A hook marker would not close it for the 3,527 tickets with unmarked stamps.
- Out: `approve-plan` prompt recheck (PR #7215), `planningSurfaceIdentity` reference definitions (separate task), and the review-runner/stamp-verifier version mismatch.

## Decision for the reviewer

Main's 920BVH treats everything under the Work Log as history, which includes the execution-discovery notice. Here the notice still binds: without it, `approve-plan` approves a current-format Implementation Plan after a discovery without a fresh review. This was proven by a mutation that removed the notice (7 failing tests, approve-plan reporting "Existing approval remains current").

## Proof

- Unit: `tests/review/ticket-journal-identity.test.ts`, `tests/review/stale-planning-sources.test.ts`, `tests/hooks/work-log-stamp.test.ts` (entry placement), `tests/utils/ticket-writer.test.ts` (Work Log comment).
- CLI/status integration: `tests/integration/planning-role-review-identity.test.ts` (real work-log hook, journal note, nested link destination, scenario anchor switch), and `tests/integration/plan-design-approval.test.ts` (discovery notice sequence).
- Trial replay: the pre-fix fingerprint reproduces all five recorded ticket digests. With the fix, the 01:29, 01:46 and 04:46 refreshes stay approved, and the 02:58 precision cap still goes stale.
- Live: a copy of N4DYBQ with real Codex approvals, stamped. A headless Claude Code session with this branch's plugin changed `plan-execution → implement`. The hook appended its line, all three stayed approved, and coding stayed authorized.

## Work Log

- 2026-11-12T05:47:19.091Z Started: Created ticket AHYMS2
- Recorded already-delivered work: commits f6a2025ed..c109fd4f7 on PR #7200; CI green on c109fd4f7. Remaining: tdd-review, /verify, /audit, close.
- tdd-review (scenario-complete): clean. Follow-up gap deferred: `appendWorkLogEntry` appends at end of file, so on a ticket with a `##` section after `## Work Log` the hook's line lands in a bound section and phase changes stale approvals again. The ticket template keeps Work Log last.
- 2026-11-12T05:48:24.669Z Phase: intake → implement
- Refactor: shared `normalizedText` across three heading/frame checks (fa3203194); shared the notice fixture in the journal tests (265b27766).
- Quality review ab466dff was degraded (Codex timed out; not independent). Applied: work-log placement inside the section (c725596ad, resolves the deferred tdd-review gap), notice trailing blank line (6f594b4c0), and a Work Log comment in new tickets (c620b43ee). Declined: bumping the identity `version` (hashed, never shown, so no diagnostic gain); a committed trial-replay test (the data is local-only, and results are on PR #7200).
- Independent Codex re-reviews (cross-agent) found placement errors, each fixed test-first: setext headings (58e11b0df); fence matching plus a class-level fix where the identity drops hook-format phase stamps from every top-level list, so placement no longer affects approvals (9c704b66e); fence-aware location of the Work Log heading (569dabfb9); and closing an unclosed fence before appending (221dfee3f).
- Implement-exit review df1a21e9 found a fifth scanner case (headings inside an HTML `<pre>` block). Class-level fix: removed the hook's Markdown scanning entirely. The hook appends at end of file again (main's behavior), and the identity strips exact stamp lines from the text before parsing. Agreement tests cover HTML blocks, fences, setext and ATX headings, and unclosed fences; disabling the strip fails 9 of them. Cosmetic cost: on a ticket with a section after the Work Log, the stamp sits at end of file. Review e2ec1c78 then flagged the hook-created `## Work Log` on a legacy ticket that ends inside an unclosed fence. The identity now also drops a bare trailing `## Work Log` heading after stripping stamps and normalizes trailing newlines, applied identically on both sides of each comparison (agreement test added).
- Full-coverage implement review 421a4873 found the opposite failure: stripping every stamp-shaped line also hid a changed stamp-shaped example inside the contract. The strip now removes only the trailing run of stamp lines (and a bare trailing hook-created heading), since the hook only appends at end of file. A stamp is counted once real content follows it, and that content is itself a change. Unit and review-status tests cover a stamp-shaped contract example.
- Earlier final re-review 17b53142 raised one error, in `phaseIn` false transition detection from unindented fenced examples. It is unchanged by this ticket and identical on main, and it no longer stales approvals because stamps are ignored. Answered as out of scope and split into a separate task.
- Review e9a7df7e flagged the remaining gap (a stamp-shaped last line inside an unclosed fence). The user accepted it as a documented limitation on 2026-11-14, recorded in Scope and in the `withoutPhaseStamps` comment.
- 2026-11-14T15:08:21.888Z Phase: implement → verify
- 2026-11-14T15:08:41.890Z Phase: verify → done

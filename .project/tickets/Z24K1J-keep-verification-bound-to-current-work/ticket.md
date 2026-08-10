---
id: Z24K1J
slug: keep-verification-bound-to-current-work
type: task
subtype: bug-investigated
phase: verify
status: in_progress
created: 2026-08-08T16:58:54.423Z
last_modified: 2026-08-10T20:53:27.000Z
external_issue: https://github.com/ArcadeAI/safeword/issues/2083
---

# Keep verification bound to the current work

**Goal:** Ensure verify resolves only the ticket relevant to the current PR or worktree context.

**Why:** Stale or unrelated ticket state makes done-gate evidence difficult to trust.

**Type:** Bug

**Scope:** Ticket resolution used by verification when multiple ticket signals exist in a PR worktree. The resolver must prefer evidence tied to the current work and avoid returning stale or unrelated active-ticket state.

**Out of Scope:** Changing ticket lifecycle semantics, verification evidence requirements, or unrelated active-ticket presentation.

**Done When:**

- [x] Verification resolves the ticket associated with the current PR or worktree when unrelated active state is present.
- [x] Verification does not emit a stale or unrelated ticket path when current-work evidence is absent or contradictory.

**Tests:**

- [x] Regression: current-work ticket evidence wins over unrelated active-ticket state.
- [x] Boundary: stale active-ticket state is not returned as the current verification ticket.

## Root Cause

The verify skill's “Find Current Ticket” command enumerates every non-epic `in_progress` ticket and pipes the result through `head -1`. Glob order, not session or PR relevance, therefore decides which ticket is verified. PR #1991 changed `.project/tickets/4DK9H4-test-codex-plugin-migration/ticket.md`, but that ticket was already `done`; the command excluded it and returned an unrelated alphabetically earlier in-progress ticket.

Confirmed with a two-ticket fixture: an unrelated `AAA111` ticket and current-work `ZZZ999` ticket both marked in progress always resolve to `AAA111`. The PR file list independently identifies `4DK9H4` as the ticket tied to #1991.

Ruled out:

- Wrong namespace root: `resolve-namespace-root.ts` resolves the current worktree's `.project` directory.
- Malformed current-ticket status: the PR ticket parses cleanly as `status: done`; excluding it is expected under the old filter but proves status cannot represent PR relevance.
- Most-recent ticket selection: the command never reads `last_modified`; deterministic glob order alone explains the result.

## Work Log

- 2026-08-08T16:58:54.423Z Started: Created ticket Z24K1J
- 2026-08-08T16:59:18.000Z Scoped: Linked GitHub issue #2083 and defined regression boundaries before investigation.
- 2026-08-08T17:07:00.000Z Root cause: Verify globally scans in-progress tickets and selects `head -1`; PR/session relevance is absent from the algorithm. Namespace and parsing alternatives ruled out.
- 2026-08-08T17:07:44.000Z Implemented: Verify now prefers the session-bound ticket, otherwise derives ticket candidates from current branch/worktree changes, continues ticketless when none exist, and fails closed on multiple candidates.
- 2026-08-08T17:07:44.000Z Checked: Explicit session resolution and ambiguous current-work resolution behave as specified; shell syntax, diff hygiene, template parity, and generated Codex catalogue are clean. Focused Vitest is queued behind the repository test lock.
- 2026-08-08T17:29:33.000Z Verify: Focused CLI contract 56/56 passed; relay 167 passed with 1 skipped; builds, scoped formatting/ESLint, full typecheck, parity, and diff hygiene passed.
- 2026-08-08T17:29:33.000Z Evidence limit: Full CLI suite passed 7,029 tests with 40 skipped but reported 8 setup failures in unrelated Python integration lanes because this shared dirty checkout lacks ruff, mypy, deadcode, and import-linter. Phase advanced to verify; status remains in_progress pending user confirmation.
- 2026-08-08T18:46:48.000Z Quality review: Replaced the inline resolver shell with a schema-managed helper and real Git/session fixtures. Review-driven corrections now fail closed on conflicting session/diff evidence, support explicit ticket selection with or without a project argument, reject a missing ticket value, and cover staged or unstaged tickets before the first commit.
- 2026-08-08T18:46:48.000Z Refactor: Centralized ticket selection in `resolve-verify-ticket.ts`; canonical verify guidance and all generated/dogfood surfaces now delegate to it. Final focused gate passes 167 relay tests (1 skipped) and 102 CLI/helper/schema tests.
- 2026-08-08T18:46:48.000Z Audit: Required diff-scope, learning, principle-trace, and domain-doc blocks completed without #2083 findings; dependency boundaries are healthy and configured docs contain no impacted claim. Independent-review quality was degraded because Claude timed out on every coordinator attempt.
- 2026-08-08T18:46:48.000Z Deferred finding: Review repeatedly found that the broader verify one-shot shell can mask an early lane failure with a later successful command. This predates and is outside #2083 ticket resolution; closed issue #487 covered failed plan generation but not cross-lane exit aggregation, so this needs a dedicated follow-up.
- 2026-08-10T20:53:27.000Z Main catch-up: Fast-forwarded through incoming waves to `3977112bc`, preserving the shared worktree in named safety stashes. Catch-up exposed and corrected one #2083 regression where the canonical verify skill had reverted to the global `in_progress | head -1` scan; generated conflicts were resolved from canonical sources and parity returned clean.
- 2026-08-10T20:53:27.000Z Revalidated: Final focused proof passes 102/102 CLI resolver/schema/skill tests and 167 relay tests with 1 skipped. Diff audit passed with no dependency violations across 459 modules and 832 dependencies. Full shared-tree verification remains red only in unrelated active work: 7,588 tests pass, 6 skip, 36 fail; BDD and Python mypy also retain unrelated failures. Builds, ESLint, Prettier, TypeScript typechecks, parity, and reachable dependency scans pass.
- 2026-08-10T20:53:27.000Z Quality/refactor re-pass: Current primary Git/Node/Bun sources support the resolver primitives and shell-free subprocess boundary. Independent review degraded after Claude timed out and repeated only the known out-of-scope aggregate-exit defect. The refactor ledger is exhausted; no further behavior-preserving change is justified in #2083 scope.

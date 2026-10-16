---
id: 0VN2X5
slug: promote-verified-worktree
type: task
phase: implement
status: in_progress
created: 2026-10-16T18:27:20.321Z
last_modified: 2026-10-16T18:27:20.321Z
subtype: bug-investigated
external_issue: https://github.com/ArcadeAI/safeword/issues/5511
scope:
  - Add project pr-ready to check its actual Git worktree and promote the matching PR.
  - Reuse existing ticket and exact-HEAD readiness receipts; add no persistent state.
  - Make the Codex readiness workflow use the checked command from the delivery worktree.
out_of_scope:
  - Rewriting arbitrary shell code or recovering metadata omitted by Codex.
  - Copying or manufacturing ticket, verification, or readiness evidence.
  - Changing the existing raw gh hook contract or solving atomic GitHub head races.
done_when:
  - Verified delivery worktrees can promote despite an unrelated launch checkout.
  - Via project pr-ready, verified launch checkouts cannot authorize an unfinished actual worktree.
  - Missing or stale receipts, mismatched heads, invalid responses, and offline mode never promote.
  - CLI arguments and subdirectory or symlink invocation select one real worktree consistently.
---

# Promote verified PRs from the intended worktree

**Goal:** Check the actual command worktree and matching PR head before Ready promotion, regardless of the chat launch checkout.

**Why:** Codex omits per-command workdir from hooks; runtime enforcement can inspect the actual worktree.

## Work Log

- 2026-10-16T18:27:20.321Z Started: Created ticket 0VN2X5

## Root Cause

Diagnostic work and pinned-host investigation are recorded in sibling ticket
S7F7PP. Codex 0.160.0 supplies the session directory and drops a shell tool's
separate workdir. The same hook payload can mean either checkout; the hook cannot
select safely from that payload alone. An execution-time CLI command observes
the actual cwd and can enforce the existing readiness contract there.

## Decision and investigation

Frame: choose a boundary that observes the same worktree as the actual GitHub
CLI operation. A choice is wrong if another checkout can authorize Ready.

Domains/questions checked:

- Host API: effective workdir remains absent in pinned source. Official docs
  support updatedInput, but transparent rewriting must preserve shell cd,
  prefixes, quoting, and execution modes.
- Execution/Git identity: Node 24.18.1 child_process supports explicit cwd and
  direct argv without a shell. Git rev-parse --show-toplevel identifies the
  actual worktree. Ignore CLAUDE_PROJECT_DIR and reject Git directory overrides.
- Evidence/remote identity: reuse evaluatePrReadiness and compare gh pr view's
  headRefOid with local HEAD. Freeze the returned PR number for promotion.
- Recovery/compatibility: route Codex workflow through the checked command;
  retain existing raw-hook behavior and disclose its upstream limitation.

Options: (1) rewrite hook commands, (2) checked execution-time command, (3) parse
explicit cd/path hints. Choose (2): no shell parser, new dependency, or persistent
state; reuses the typed CLI and existing evidence validator. (1) has a larger
shell/host correctness surface; (3) cannot recover an omitted workdir.

Premortem: correct local evidence could authorize another PR. Compare PR head,
freeze its number, and recheck local HEAD and readiness immediately before Ready.
The gh ready API has no atomic expected-head parameter; disclose that race.

Sources read:

- https://developers.openai.com/codex/hooks
- https://github.com/nodejs/node/blob/v24.18.1/doc/api/child_process.md
- https://git-scm.com/docs/git-rev-parse
- https://cli.github.com/manual/gh_pr_view
- https://cli.github.com/manual/gh_pr_ready

## Test Definitions

Use the real built CLI and real temporary Git worktrees with a fake gh boundary.
Never mutate a live GitHub PR during development.

- From a verified delivery worktree, subdirectory, or symlink, stale launch-root
  environment does not affect the selected checkout or where gh Ready runs.
- With the evidence inverted, an unfinished delivery worktree refuses promotion
  despite valid launch-checkout evidence.
- Missing/stale receipts, different remote heads, malformed/failed PR inspection,
  unenrolled roots, invalid pull selectors, Git directory overrides, and offline
  mode refuse promotion; offline mode makes no GitHub call.
- A commit during PR inspection invalidates the pending promotion. PR selection
  stays tied to the inspected number; already-Ready PRs need no mutation.
- A failed gh Ready returns failure rather than reporting success.
- Guidance tests require the canonical and generated Codex skill to reference
  project pr-ready as the promotion route. No live PR state is changed in tests.
- The command passes undefined sessionId to evaluatePrReadiness: inspected
  readSessionState returns null immediately for that input, so selection comes
  from the receipt rather than another session. Test unrelated state files too.
- Reject GH_REPO and repository-local Git overrides (GIT_DIR, GIT_WORK_TREE,
  GIT_COMMON_DIR, GIT_INDEX_FILE, GIT_CEILING_DIRECTORIES) rather than letting
  them redirect the checked directory; pull selectors accept positive numbers
  only, with no flags. Require state OPEN from PR inspection before promotion.

## Implementation plan

Register one typed mutating project command with declared network effects and
offline rejection. Resolve Git root from invocation.cwd, check enrollment and
existing readiness, inspect PR number/head/draft status, revalidate local HEAD
and receipt, then call gh pr ready with an argv array and explicit root cwd.
Update canonical workflow guidance and regenerate normal delivery surfaces.

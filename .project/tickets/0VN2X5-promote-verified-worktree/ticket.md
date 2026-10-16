---
id: 0VN2X5
slug: promote-verified-worktree
type: task
phase: verify
status: in_progress
created: 2026-10-16T18:27:20.321Z
last_modified: 2026-10-16T19:58:47Z
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

## Implementation evidence

- The standalone real-Git/fake-GitHub reproduction failed before implementation
  with `CLI_ARGUMENT_INVALID` for the missing command, then passed after build.
  Logs: `.project/tmp/5511-runtime-green.log` and the recorded investigation.
- Added the typed command, shared environment-aware HEAD check, offline fixture,
  canonical Codex guidance, CLI reference, and real linked-worktree integration
  tests. No live PR was promoted, demoted, or otherwise changed.
- Focused run: 161/161 tests passed across five matching files. A further explicit
  `--cwd` selection test was added for the documented recovery invocation.
- Root lint/typecheck passed; parity passed all 276 pairs and 11 contracts.
  Package-directory generation followed by the five-surface freshness check
  passed (`.project/tmp/5511-surfaces-package.log`). Generate from the package
  directory: root-directory invocation produced different bundled bytes.
- Independent source review approved: `7de44858-b911-4ca2-b3d5-231302b7d8ec`.
  Generated copies reviewed separately: `da88488c-01d9-48c4-951b-484f5545d8f5`;
  final generated metadata: `6f5a2ddc-94ea-4650-9b79-3ee29f0cbb12`.
  Each used Claude/opus independently of the Codex author. The two oversized
  generated CLI bundles were excluded by the coordinator and checked by normal
  regeneration/freshness instead.
- The combined packet exceeded the coordinator's 1 MiB limit. Its single-receipt
  phase stamp cannot represent these separate approvals; do not claim one
  combined receipt. Keep the independent reviews and generator evidence explicit
  if recording the supported phase-stamp skip for this aggregation limitation.
- Review dispositions: fixed the unsafe online conformance fixture and weak
  refusal assertions. Retained the raw-hook session-root recovery as a valid
  fallback; checked-command guidance is in the readiness skill. The command
  deliberately selects the receipt's completed ticket, not a chat's active
  ticket. Remote head races and uncertain network outcomes remain normal GitHub
  mutation limits; network effects record attempts, never proof of completion.
- At the implementation checkpoint full verification was running. Catalogue
  regeneration advanced source mtimes after its initial build; preserve those
  freshness failures as orchestration errors rather than product regressions.
- Entered verify using the helper's explicit phase-stamp skip for the unsupported
  combined-receipt aggregation. Fresh independent source approval is
  `6a5c9ab1-4f0c-4922-b0c1-a8e21f7f7c4c`; fresh independent generated-copy approval
  is `461ad36d-8327-4a2a-852b-4931ab39fc1c`. These reviews omit the mutable work-log
  context so adding verification notes does not invalidate unchanged source.
- Final full-plan evidence: first CLI pass had 11,024 passing cases, five
  freshness-blocked suites, five freshness failures, and two deadline failures.
  Fresh second CLI pass had 11,109 passing cases, four timeouts, and 14 skips.
  All freshness failures cleared; all four timeout cases and the earlier two
  deadline cases passed in the one-worker rerun (6/6, 19.91 seconds).
- Acceptance passed all 596 scenarios and 11,118 steps, followed by 50 proof-tag
  tests. The duplicate package acceptance pass had three failures caused by the
  agent's overlapping dist rebuild (including MODULE_NOT_FOUND for dist/cli.js).
  Exact-name reruns with a stable build passed all three scenarios and 54 steps.
  An initial path-filter attempt was canceled because Cucumber 13 merges CLI
  paths with configured paths; the successful rerun used exact --name filters.
- Full-plan builds passed for CLI, relay, collector, website, and Go checker;
  all three TypeScript workspaces typechecked. Dependency audits remain nonzero
  on unchanged dependencies: 8 JavaScript findings and 6 Python urllib3 findings;
  Go reports zero affected-code vulnerabilities. No manifest or lockfile changed.
- Final read-only generated-surface, parity, ESLint, CLI-reference, and terminology
  checks passed. Final one-worker smoke, readiness, and CLI-contract verification
  passed all 2,372 cases across 114 files. Full evidence and limits are recorded
  in verify.md. Implementation is complete locally; the ticket stays in verify
  because the full plan was not uniformly green and unchanged audit findings
  remain. No push, PR, issue closure, or live Ready mutation was performed.

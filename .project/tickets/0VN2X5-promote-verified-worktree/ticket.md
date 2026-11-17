---
id: 0VN2X5
slug: promote-verified-worktree
type: task
phase: done
status: done
created: 2026-10-16T18:27:20.321Z
last_modified: 2026-10-17T02:52:00Z
subtype: bug-investigated
external_issue: https://github.com/ArcadeAI/safeword/issues/5511
scope:
  - Add project pr-ready to check its actual Git worktree and promote the matching PR.
  - Reuse existing ticket and exact-HEAD readiness receipts; add no persistent state.
  - Make the Codex readiness workflow use the checked command from the delivery worktree.
  - Complete delivery review and update the vulnerable Python development lock dependency.
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
- A failed gh Ready reports unconfirmed state, names the inspected PR to check
  before retrying, and returns failure rather than reporting success.
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

Test-quality follow-up authorized by the user: keep real CLI/Git integration
scope and fake only the GitHub process boundary. Add a HEAD-change case whose
receipt is refreshed during inspection (specific refusal, no Ready); a valid
delivery with disruptive inherited Git configuration (successful promotion,
no Git/launch override keys reaching GitHub); and a table of one invalid
metadata field per otherwise valid response (invalid-response refusal, no
Ready). Strengthen operational failures with exit status and exact attempted
network effects. Check each addition against current code and a corresponding
disposable-runtime mutation before proceeding; preserve the original audit as
historical evidence and record the repair results separately.

Register one typed mutating project command with declared network effects and
offline rejection. Resolve Git root from invocation.cwd, check enrollment and
existing readiness, inspect PR number/head/draft status, revalidate local HEAD
and receipt, then call gh pr ready with an argv array and explicit root cwd.
Update canonical workflow guidance and regenerate normal delivery surfaces.

## Historical implementation evidence and delivery follow-up

Each entry records its checkpoint. The final delivery entry and verify.md
supersede earlier next actions and dependency counts.

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
- Follow-up test-quality audit requested by the user: recorded three P2 safety
  coverage gaps and one P3 reporting gap in test-quality-audit.md. Baseline and
  restored baseline passed 32/32; nine of eleven bounded guard mutations were
  detected. HEAD-equality and environment-filter mutations survived, with
  separate real-Git/fake-GitHub counterexamples confirming the missing cases.
  Current production code handles those counterexamples correctly. Additional
  optional suite mutations were stopped while queued behind another checkout;
  no unrun evidence is counted. Source and tests remain unchanged; ticket stays
  in verify, with the audit findings open.
- User authorized the suggested improvements. All four audit findings are now
  addressed: twelve new integration cases isolate refreshed-HEAD evidence,
  sanitized Git/launch environments, and invalid metadata fields; six existing
  operational-failure cases now require exit 1 and exact network effects.
  Characterization checks followed each addition. Ten deliberate runtime
  mutation runs covering nine distinct changes all fail the intended checks.
  Final restored-runtime verification passes 44/44 command cases and 174/174
  across five focused files, with zero pending cases. CLI typecheck, targeted
  ESLint, formatting, and diff checks pass. Tests use the normal package-snapshot
  helper; mutation runs held the normal global lock and never overlapped Vitest
  processes. The initial standalone request timed out while queued and is not
  counted as executed CLI evidence. No production source or generated artifact
  changed. The audit report preserves its original findings and records their
  resolution; ticket remains in verify under the existing broad-run limits.
- Delivery follow-up authorized: ran verify, diff audit, refactor, and quality
  review; applied all three bounded refactors and actionable recovery guidance.
  Source CI is fully green at 088d065952cb3ea0678a09a1a221e41cc28eb452 in
  run 38990046582, including 11,131 CLI cases on each Node version, physical
  installation, release gates, and Node 24 acceptance. Final command/skill/catalog
  checks pass 65/65; all 30 observed earlier failures pass unchanged in recovery.
  A later hook/schema run's three explicit deadline failures also pass unchanged
  in 2.78 seconds; the underlying delay cause remains unestablished. Updated the
  vulnerable Python dev lock and preserved the existing JavaScript audit policy.
  Independent Claude/Opus source and changed-target reviews approve without
  blocking errors. PR #5911 remains Draft for normal ticket closure and a fresh
  exact-head CI result; current readiness and merge truth belong to the PR body.
- Main advanced to 31befd189 (#5898) during CI. GitHub reported a merge conflict,
  so the closure head c45740245 received no normal CI run. Reopened verification
  using the independent done-phase review before integrating the new base.
  Main changes RED guidance, its generated rubric, and review fixtures/tests;
  readiness commands and guards are unchanged. Canonical files merged cleanly;
  six generated metadata conflicts were resolved by regenerating all five
  surfaces from both canonical changes. The generator's lifecycle verification
  passed. The combined base still needs targeted regression tests and fresh CI.
- Main integration is now verified at b4b7e2ead in CI run 38992939896: both Node
  versions pass 11,152 CLI cases in 673 files (10 intentional skips), physical
  installation, and release gates; Node 24 acceptance passes 596 scenarios and
  50 proof cases. Local readiness/review regression passes 339 cases, with two
  Linux-only skips on macOS. Typechecks, generated-surface/lifecycle checks,
  parity, and the scoped architecture audit pass. The current Bun walkthrough
  passes. Current verification artifacts preserve the old run limits and the
  network failure of the watcher without misreporting the successful CI result.
  Re-closing this task still requires the independent phase review and a fresh
  documentation-head CI result before Ready and admin merge.

# Verification: Keep the Claude plugin installable and recoverable

## Verify Checklist

**Test Suite:** ✅ 9,993 passed, 14 skipped across the current CLI, retro-relay, and retro-collector suites; 56/56 focused plugin tests and 12/12 Claude release-contract tests pass
**Gherkin:** ✅ Generated verify lane: 1,496 passed, 3 skipped (68,731 steps passed, 4 skipped); dedicated BDD lane: 595/595 scenarios and 11,100/11,100 steps passed; proof tags: 45/45
**Build:** ✅ CLI, retro packages, and website build successfully
**Lint:** ✅ ESLint, Prettier, Gherkin lint, and TypeScript checks pass
**Scenarios:** ⚠️ No ticket-specific `.feature` scenarios were authored; the changed step definitions only preserve existing native-surface review scenarios
**Refactor:** ✅ No change warranted — canonical template duplication is deliberate package data required by the standalone runtime contract, and the dispatcher change remains at its existing integrity boundary
**PR Scope:** ✅ Diff matches the packaging and damaged-cache recovery ticket
**Dep Drift:** ✅ No dependency changes; all package audits report no known vulnerabilities
**Parent Epic:** N/A
**Reconcile:** ✅ Generated Claude and Codex payload checks pass
**Experience:** ⏭️ N/A — internal plugin packaging and recovery plumbing
**Surface Evidence:** ✅ Both bundled CLIs execute real commands; damaged-cache behavior is proven for prompt, PreToolUse, SessionStart, PostToolUse, and Stop paths
**Evidence limits:** ⚠️ The independent quality-review coordinator exhausted Claude Opus, Claude Sonnet, OpenCode, and Codex fallback routes. The final supplemental review is main-thread and non-independent. The aggregate verifier also encountered global test-lock contention on duplicate generated lanes; every unique command completed successfully, including the identical proof test and a final full CLI run with an extended lock budget.

## BDD and TDD Quality Assessment

- **BDD process: inadequate.** The ticket was sized as a task even though it crossed two user-visible failure flows and several production files, so behavior discovery and ticket-owned scenarios were skipped. The project-wide Gherkin corpus is strong regression evidence, but it cannot recover the missing discovery record. Retroactively adding scenarios now would be ceremony rather than evidence, so none were manufactured.
- **TDD test design: strong after review.** The release tests run real bundled CLIs in clean temporary repositories and assert observable `ticket new` and `install` output. Dispatcher tests damage real copied payloads, cover missing/modified/unlisted assets, assert Claude's structured `ask` response, and prove no execution-proof side effect. Lifecycle tests now prove non-blocking warnings and no execution for SessionStart, PostToolUse, and Stop.
- **TDD provenance: incomplete.** The implementation and its first regression tests landed together in `2fda7dde6`; there is no durable RED-before-GREEN commit or machine receipt. The earlier reproduction established the failure interactively, but the repository history cannot independently prove test-first sequencing.

## Quality Review

The review checked the current Claude hook contract and plugin packaging constraints against Claude's official documentation. Exit 2 is a blocking PreToolUse decision; exit 0 with `hookSpecificOutput.permissionDecision: "ask"` is the supported explicit-approval path. Installed plugins are cached and cannot rely on files outside their plugin root, which supports shipping the canonical template tree in each native payload.

The first terminal pass found one proof gap: non-prompt damaged-cache lifecycle behavior was changed but not directly tested. Added SessionStart, PostToolUse, and Stop cases and reran the focused and full CLI suites.

> Supplemental feedback came from the main agent in the same thread. It used
> live worktree content; source integrity was not revalidated.

- Coordinator: `REVIEW_ROUTES_EXHAUSTED`
- Assurance: main-thread, live-worktree supplemental review
- Independence: `none`
- Policy: `prefer complete`
- State: `approved`
- Verdict: `approve`
- Summary: The generators now ship the canonical runtime resources, damaged caches never execute unverified hooks, and executable/security-focused tests cover both payloads and every affected lifecycle branch.
- Findings: none remaining

## Audit Detail

- Diff-scoped architecture audit: no dependency violations across 13 modules and 5 dependencies; generated package-data trees are intentionally excluded from import-root analysis.
- Dead code and duplication: no ticket-scoped finding. The large generated template copies are required payload contents, not source-level duplication to abstract away.
- Documentation: the executable resource contract is recorded in `ARCHITECTURE.md`; no contradictory impacted claim was found in configured documentation.
- Test harness note: the generated verify plan schedules package suites already covered by the root suite, which caused cross-worktree lock contention and a red aggregate exit despite no assertion failure in those lanes. This is an evidence-orchestration limitation, not a product failure in HX3KFQ.

## Affected Surfaces

| Affected surface | Proof | Result |
| --- | --- | --- |
| Claude bundled CLI resources | `claude-plugin-release.release.test.ts` | `ticket new` and `install` pass from the checked-in payload; installed handbook exists |
| Codex bundled CLI resources | `codex-plugin-version.test.ts` | Generated payload contains key resource classes; `ticket new` and `install` pass |
| Claude damaged-cache PreToolUse | `claude-plugin/dispatch.test.ts` | Missing, modified, and unlisted assets return structured `ask`; no unverified result or proof is written |
| Other Claude lifecycle events | `claude-plugin/dispatch.test.ts` | SessionStart, PostToolUse, and Stop warn, return success, execute nothing, and write no proof |
| Native plugin generation | Generator drift and release-contract checks | Checked-in Claude and Codex payloads match their generators |

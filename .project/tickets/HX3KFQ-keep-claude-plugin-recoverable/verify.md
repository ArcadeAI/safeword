# Verification: Keep the Claude plugin installable and recoverable

## Verify Checklist

**Test Suite:** ✅ Final current-head run: 10,002 passed and 14 skipped across CLI, retro-relay, and retro-collector (CLI: 9,651 passed/13 skipped; relay: 198 passed/1 skipped; collector: 153 passed)
**Gherkin:** ✅ Dedicated BDD lane: 595/595 scenarios and 11,100/11,100 steps passed; proof tags: 45/45
**Build:** ✅ CLI, retro packages, and website build successfully
**Lint:** ✅ ESLint, Prettier, Gherkin lint, and TypeScript checks pass
**Scenarios:** ✅ Two post-hoc regression scenarios now bind the native resource and damaged-cache recovery contracts to named executable proof; they improve future protection but do not recreate pre-implementation discovery evidence
**Refactor:** ✅ Script selection and shell tokenization now use shared authorities; the CLI build precondition is pinned in the BDD command contract; the canonical template boundary has one name; damaged-cache verification is separated from protocol output
**PR Scope:** ✅ Diff matches the packaging and damaged-cache recovery ticket
**Dep Drift:** ✅ No dependency changes; all package audits report no known vulnerabilities
**Parent Epic:** N/A
**Reconcile:** ✅ Generated Claude and Codex payload checks pass
**Experience:** ⏭️ N/A — internal plugin packaging and recovery plumbing
**Surface Evidence:** ✅ Both bundled CLIs execute real commands; damaged-cache behavior is proven for prompt, PreToolUse, SessionStart, PostToolUse, and Stop paths
**Evidence limits:** ⚠️ The final independent quality-review dispatch was rejected by the environment's outbound-data policy, so the post-refactor source-backed pass is not independent coverage. Remote GitHub verification was also unavailable because publishing the unpushed branch was not authorized. Historical BDD discovery and RED-first provenance remain unrecoverable. The exact final verifier encountered another worktree's package-test lock only for its standalone proof-tag invocation; that same test had passed in the full suite and its dedicated retry passed 45/45 after the lock cleared. Retro-relay's socket tests require local port/process-lock permissions; their unrestricted run passed 198 tests with 1 skip.

## BDD and TDD Quality Assessment

- **BDD process: historically inadequate; regression contract now strong.** Behavior discovery and ticket-owned scenarios were skipped before implementation, so that provenance cannot be recovered. Two post-hoc scenarios now make the shipped resource and recoverability promises explicit and bind them to normal-suite executable proof. They are useful regression protection, not evidence that BDD drove the original design.
- **TDD test design: strong after review.** The native resource contract copies each complete plugin outside the source checkout, runs real bundled CLIs, and asserts observable `ticket new` and `install` results. Dispatcher tests damage real copied payloads, cover missing/modified/unlisted assets, assert Claude's structured `ask` response, and prove no execution-proof side effect. Lifecycle tests prove non-blocking warnings and no execution for SessionStart, PostToolUse, and Stop. Resolver tests cover exact delegation, non-delegated siblings, shell boundaries, and deceptive argument text.
- **TDD provenance: incomplete.** The implementation and its first regression tests landed together in `2fda7dde6`; there is no durable RED-before-GREEN commit or machine receipt. The earlier reproduction established the failure interactively, but the repository history cannot independently prove test-first sequencing.

## Quality Review

The review checked the current Claude hook contract and plugin packaging constraints against Claude's official documentation. Exit 2 is a blocking PreToolUse decision; exit 0 with `hookSpecificOutput.permissionDecision: "ask"` is the supported explicit-approval path. Installed plugins are cached and cannot rely on files outside their plugin root, which supports shipping the canonical template tree in each native payload.

The first terminal pass found one proof gap: non-prompt damaged-cache lifecycle behavior was changed but not directly tested. Added SessionStart, PostToolUse, and Stop cases and reran the focused and full CLI suites.

The follow-up coordinator again exhausted all independent routes. Its permitted fresh-context
same-agent fallback requested changes for two release-relevant proof gaps: plugin tests still lived
under the source checkout, and delegation tokens could match inside another command's arguments.
Both were corrected. The executable resource proof now copies bundles to an unrelated temporary
root, and command matching requires a shell command boundary; a deceptive `echo bun run ...` case
pins the latter. Focused and release verification pass after both fixes. This supplemental feedback
is not independent review evidence, and the fallback was not rerun after the corrections.

> Supplemental feedback came from a fresh context of the same agent. It used
> live worktree content; source integrity was not revalidated. Host-mandated
> project context may have loaded; this is not packet-only isolation.

- Coordinator: `REVIEW_ROUTES_EXHAUSTED`
- Assurance: fresh-context, live-worktree same-agent supplemental review
- Independence: `none`
- Policy: `prefer`
- State: independent routes exhausted; requested changes implemented and objectively verified
- Verdict: no post-fix independent verdict available
- Findings: both supplemental findings fixed; no unresolved known finding

The final post-refactor coordinator dispatch was blocked before execution by the environment's
outbound-data policy. A local review therefore checked the final implementation against current
primary sources but cannot be represented as an independent verdict. Claude's current plugin
reference confirms that marketplace plugins are copied into a versioned cache and cannot reference
files outside their plugin directory. Claude's current hook reference confirms that an exit-0
`PreToolUse` response may return `hookSpecificOutput.permissionDecision: "ask"`; Bun's current
runtime reference confirms `--cwd` changes the process working directory. No new error-level issue
was found in that local pass.

## Audit Detail

- Full repository architecture audit: 1,260 modules and 4,632 dependencies produced no errors and one pre-existing orphan warning for `.project/tickets/CWGYH0-pr-review-eval/power-analysis.ts`; generated package-data trees are intentionally excluded from import-root analysis.
- Dead code and duplication: no ticket-scoped finding. The large generated template copies are required payload contents, not source-level duplication to abstract away.
- Documentation: the executable resource contract is recorded in `ARCHITECTURE.md`; no contradictory impacted claim was found in configured documentation.
- Test harness: generated verify and BDD plans suppress only workspace lanes explicitly delegated by
  their selected root script. On this repository the plans now contain one JavaScript authority,
  while the independent Go lane remains present.
- Repository baseline (non-blocking and out of ticket scope): Knip reports historical ticket/eval artifacts, two unresolved generator-script imports, unused exports/types, and one stale ignore hint; jscpd reports 28.83% duplication dominated by generated mirrors; the Go experiment checker has formatting/documentation warnings; six development dependencies have newer minor releases. No audit item is caused by or blocks this ticket.

## Affected Surfaces

| Affected surface | Proof | Result |
| --- | --- | --- |
| Claude bundled CLI resources | `plugin-resource-contract.test.ts` | An isolated copy runs `ticket new` and `install`; installed handbook exists |
| Codex bundled CLI resources | `plugin-resource-contract.test.ts` and `codex-plugin-version.test.ts` | An isolated copy runs `ticket new` and `install`; generated payload contains key resource classes |
| Claude damaged-cache PreToolUse | `claude-plugin/dispatch.test.ts` | Missing, modified, and unlisted assets return structured `ask`; no unverified result or proof is written |
| Other Claude lifecycle events | `claude-plugin/dispatch.test.ts` | SessionStart, PostToolUse, and Stop warn, return success, execute nothing, and write no proof |
| Native plugin generation | Generator drift and release-contract checks | Checked-in Claude and Codex payloads match their generators |

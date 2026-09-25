# Verification: Keep the Claude plugin installable and recoverable

## Verify Checklist

**Test Suite:** ✅ Final exact-revision GitHub run: CLI 10,011 passed/47 skipped; retro-relay 199 passed; retro-collector 153 passed. Final local focused runs: dispatcher/resolver 163/163, relay 144/144, and release 77/77.
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
**Evidence limits:** ⚠️ Historical BDD discovery and RED-first provenance remain unrecoverable. The final independent review and exact-revision GitHub run now cover the completed implementation, but they cannot retroactively prove that the original work began behavior-first or test-first.

## BDD and TDD Quality Assessment

- **BDD process: historically inadequate; regression contract now strong.** Behavior discovery and ticket-owned scenarios were skipped before implementation, so that provenance cannot be recovered. Two post-hoc scenarios now make the shipped resource and recoverability promises explicit and bind them to normal-suite executable proof. They are useful regression protection, not evidence that BDD drove the original design.
- **TDD test design: strong after review.** The native resource contract copies each complete plugin outside the source checkout, runs real bundled CLIs, and asserts observable `ticket new` and `install` results. Dispatcher tests damage real copied payloads, cover missing/modified/unlisted assets, assert Claude's structured `ask` response, and prove no execution-proof side effect. Lifecycle tests prove non-blocking warnings and no execution for SessionStart, PostToolUse, and Stop. Resolver tests cover exact delegation, non-delegated siblings, shell boundaries, and deceptive argument text.
- **TDD provenance: incomplete.** The implementation and its first regression tests landed together in `2fda7dde6`; there is no durable RED-before-GREEN commit or machine receipt. The earlier reproduction established the failure interactively, but the repository history cannot independently prove test-first sequencing.

## Quality Review

The review checked the current Claude hook contract and plugin packaging constraints against Claude's official documentation. Exit 2 is a blocking PreToolUse decision; exit 0 with `hookSpecificOutput.permissionDecision: "ask"` is the supported explicit-approval path. Installed plugins are cached and cannot rely on files outside their plugin root, which supports shipping the canonical template tree in each native payload.

The first terminal pass found one proof gap: non-prompt damaged-cache lifecycle behavior was changed but not directly tested. Added SessionStart, PostToolUse, and Stop cases and reran the focused and full CLI suites.

Early review attempts exhausted or were blocked by available routes. Their actionable findings were
implemented: executable plugin tests now run outside the source checkout, delegated commands match
only at shell boundaries, and lifecycle recovery has direct no-execution coverage.

The final external independent review (`588086e6-60b4-4fb1-9fa6-78fb1201a0d8`) reviewed the complete
change and returned **APPROVE** with no error-level findings. It specifically confirmed that the
validator remains fail-closed and that the relay test correction separates machine timing from the
schema proof without weakening production behavior. Its remaining warnings concern pre-existing,
ticket-external relay diagnostics and readiness policy, so they are recorded but do not block this
delivery.

The source-backed review used the current official Claude hook contract. For `PreToolUse`, the
permission precedence is deny, defer, ask, then allow; the degraded response therefore uses an
explicit `ask` and never executes an unverified hook. The plugin cache boundary likewise requires
the standalone payload to contain every runtime resource it consumes.

## Hosted Verification

- Workflow run: <https://github.com/ArcadeAI/safeword/actions/runs/36076647867>
- Exact source revision: `19f5b93c8e9a4171226cdbfecc29e49289e2abd9`
- Result: passed
- CLI: 588 files passed; 10,011 tests passed and 47 skipped
- Retro relay: 9 files and 199 tests passed
- Retro collector: 4 files and 153 tests passed
- Build, generated declarations, repository health, and result publication: passed

The preceding hosted attempt exposed a scheduler-sensitive assertion in the relay measurement test.
The production threshold was not changed. The test now preserves the real duration for a generous
contention bound and normalizes only that timing field when proving producer-to-validator schema
wiring. The corrected exact revision passed remotely.

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

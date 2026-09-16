---
id: 5H7NA3
slug: run-reviews-without-approval-prompts
type: task
subtype: bug-investigated
phase: done
status: done
created: 2026-09-10T23:06:30.082Z
last_modified: 2026-09-16T18:32:00Z
---

# Run trusted review routes without approval prompts

**Goal:** Make configured Safeword reviews and the trusted Arcade/Bosslevel MCP route run without per-call approval prompts.

**Why:** Review and MCP approval prompts interrupt the autonomous Safeword workflow the user explicitly enabled.

## Scope

- Codex quality, scenario, and implementation-plan review dispatches use previously installed
  kind-scoped allow rules without surfacing a host approval request; status polling remains in the
  normal workspace sandbox.
- Generated Codex review skills retain the zero-approval instruction.
- This machine's combined Arcade/Bosslevel MCP server automatically approves its entire tool
  surface, including tools added to that server later; this is the user's accepted trust boundary.
- This machine has narrow allow rules for the exact installed Safeword runtime's
  `quality-review`, `scenario-gate`, and `plan-implementation` dispatches. Their normal arguments
  remain available, while executable RED reviews, `review status`, and arbitrary Bun commands are
  excluded.
- Verification-driven repairs discovered while closing this delivery: centralize test/build command
  resolution in `project test-plan`, fail closed without hiding later lanes or missing-runner
  diagnostics, correctly recognize legacy Python declarations, and preserve exact relay-readiness
  measurement evidence.

## Out of Scope

- Disabling Codex approvals globally.
- Granting automatic approval to unrelated MCP servers.
- Changing the review packet, reviewer selection, or review verdict contract.

## Done When

- Every canonical review-launch surface permits escalation only through a previously installed
  kind-scoped rule, forbids surfaced approval requests, and forbids escalation for executable RED
  reviews and status polls.
- Generated Claude and Codex plugin artifacts carry the source-template behavior.
- The Arcade/Bosslevel MCP server uses `default_tools_approval_mode = "approve"`.
- The exact installed Safeword review dispatcher can reach its reviewer without granting general
  sandbox network access.
- A live dispatch against the installed runtime reaches the external reviewer without surfacing a
  user approval request.
- Focused review parity and generated-plugin checks pass.
- The verification-driven test-plan, Python declaration, and relay-readiness regressions pass with
  template/dogfood parity intact.

## Test Plan

- RED: the canonical review-surface test fails until every review caller preserves the no-prompt
  kind-scoped dispatch rule and the normal-sandbox boundaries for executable RED reviews and status
  polling.
- GREEN: the focused review parity suite and generated Codex plugin check pass.
- End to end: run a bounded packet through the live installed runtime and verify that Codex applies
  the installed rule without surfacing an approval request.
- Manual: inspect the effective Codex config for the Arcade/Bosslevel server approval mode and
  sandboxed-network settings without exposing secrets.

## Root Cause

### Independent reviewer routes still require a named egress recipient

The installed allow rule matches the Safeword command, but that command does not identify the
external recipient in its visible arguments. Codex's approval boundary therefore cannot bind the
rule to the actual disclosure. On 2026-09-13 it rejected a bounded `quality-review` launch before
Safeword ran, stating that the transcript had not explicitly authorized sending the source file to
the specific destination. When the same reviewer CLIs were run inside the ordinary workspace
sandbox, Claude waited without receiving an API response and Codex reported network-resolution
failures; Codex also attempted to write its profile state database. Those exits explain the later
`process_failed` route evidence, but they are consequences of launching networked reviewers without
an approved egress boundary, not reviewer verdicts.

Confirmed: both installed CLIs advertise every required headless-review flag, so CLI capability
drift is ruled out. Both installed profiles report authenticated, so missing login is ruled out.
Giving Codex a private writable temporary profile removed the state-database error and reached its
network attempt, ruling out the database write as the primary route failure. The Arcade/Bosslevel
MCP catalog was also queried for a bounded AI code-review tool and has none; its closest GitHub tool
can only submit a review already produced elsewhere. A capability-gap report was filed with the
gateway. The surviving cause is the mismatch between a version-scoped command allow rule and the
host's recipient-specific disclosure policy. A durable fix must name the actual provider and obtain
one standing authorization for that provider, or use a Bosslevel-native reviewer when one exists;
Safeword instructions cannot override the host's disclosure decision.

The closing verification exposed an acceptance-fixture timing defect. Successful fake reviewers
and deliberately non-responsive reviewers shared the same five-second total attempt budget, even
though capability probing and review execution consume that budget together. Under the accumulated
load of the repeated full acceptance lane, an otherwise immediate fake reviewer could spend the
entire budget waiting to be scheduled and be misclassified as `probe_timed_out`.

Confirmed by the full run: the first 1,499-scenario pass was green, while the immediately repeated
lane failed two adjacent instant-review cases at the capability boundary. Both cases passed together
in an isolated rerun (2/2 scenarios, 90/90 steps in 5.9 seconds). A deterministic production
regression was therefore ruled out. Cross-scenario data leakage was also ruled out: each scenario
uses a fresh world, project directory, executable directory, and an `After` cleanup. The surviving
cause is an underfunded fixture deadline under accumulated host load. Successful-review fixtures now
receive scheduling headroom; scenarios whose subject is a short timeout set that deadline explicitly.

## Work Log

- 2026-09-10T23:06:30.082Z Started: Created ticket 5H7NA3
- 2026-09-10T23:08:00Z Scoped: User requires zero approval prompts for Safeword reviews and
  every Arcade/Bosslevel MCP call; unrelated Codex protections remain in place.
- 2026-09-10T23:24:00Z Implemented: Added and execpolicy-tested an exact installed-runtime allow
  rule for `review run`; confirmed it does not match `review status` or arbitrary Bun scripts.
- 2026-09-10T23:25:00Z Configured: Set the combined Arcade/Bosslevel MCP server's default tool
  approval mode to `approve`.
- 2026-09-10T23:26:00Z Verified: Focused review surface suite passes 44/44; Claude and Codex
  generated-plugin checks are current; a sandboxed missing-ID status probe reported no network
  effects.
- 2026-09-10T23:31:00Z Restart check: Codex replaced the cachebuster build with stable `0.83.1`,
  changing the immutable runtime path. Refreshed the exact-command rule and installed review
  examples for that live path; execpolicy matches dispatch only and excludes status/arbitrary Bun.
- 2026-09-10T23:32:00Z Pending activation: The running Codex process loaded rules before the path
  refresh, so a real dispatch still reached auto-review and was denied. One final restart is needed
  to load the refreshed stable-path rule; no one-off payload approval was requested.
- 2026-09-11T04:34:09Z Verified after restart: A bounded live dispatch through the installed
  `0.83.1` runtime reached Claude and returned a typed `changes_requested` verdict without
  surfacing any user approval. The rule remains deliberately fixed to the installed executable and
  `review run` subcommand while allowing normal review arguments; status and arbitrary Bun commands
  remain outside the rule. Arcade/Bosslevel automatic tool approval also persisted across restart.
- 2026-09-11T04:43:43Z Narrowed after adversarial review: Confirmed that `executable-red` accepts
  an exact command to execute, so a rule ending at `review run` was broader than intended. Replaced
  it with separate rules for the three non-executing review kinds and added an explicit
  normal-sandbox requirement for executable RED reviews. Execpolicy now allows all three ordinary
  review kinds and rejects executable RED, status, and arbitrary Bun commands. Focused parity passes
  44/44 and both generated-plugin checks are current.
- 2026-09-11T23:37:16Z Verified narrowed rules after restart: A bounded `quality-review` dispatch
  matched the loaded kind-scoped rule, reached Claude, and returned a typed verdict without a user
  approval prompt. A separate `review status` probe ran without escalation, returned
  `REVIEW_JOB_NOT_FOUND` for the synthetic ID, and reported no network or file effects. The effective
  Codex config still sets the combined Arcade/Bosslevel server to automatic approval and contains no
  general sandbox network-access override; the session sandbox remains network-restricted.
- 2026-09-11T23:50:08Z Closing verification: Focused review parity remains green at 44/44,
  generated plugins are current, type checking passes across the monorepo, and the live approval
  boundary is green. Full repository verification is locally limited: relay tests cannot bind
  `127.0.0.1` in the Codex sandbox (`EPERM`), and the website build lacks the optional native
  `@bruits/satteri-darwin-arm64` package. These failures are outside this ticket's diff and do not
  contradict the bounded live proof.
- 2026-09-12T02:41:00Z Full verification rerun: After making Sätteri an explicit website runtime
  dependency and keeping it external during prerender, the previously blocked lanes completed.
  Relay, collector, and CLI tests are green (9,972 passed / 17 expected skips), 1,496 acceptance
  scenarios passed / 3 skipped, the 595-scenario build contract and 45 BDD proof checks passed, and
  all CLI, service, and nine-page website builds completed. This later rerun supersedes the local
  limitations recorded at 2026-09-11T23:50:08Z.
- 2026-09-12T04:05:00Z Independent quality review: Claude Opus review
  `a18209be-ff36-47b2-a8e0-4f368d172eb0` approved the core design with no blocking findings.
  Applied every useful nonblocking suggestion: added a real installed-Codex execpolicy tripwire,
  exercised the rubric generator through its entry point, simplified generated-file reconciliation,
  narrowed the Sätteri Knip exception, relaxed its compatible version range, and hardened inline-code
  principle proof parsing.
- 2026-09-12T05:45:14Z Final verification after review fixes: Refreshed the deterministic Cursor
  lifecycle fixtures and dogfood parity copies, then completed a clean full run. Both 9,610-test CLI
  passes, relay 198/1 skipped, collector 153, the full 1,496/3-skipped acceptance execution, the
  dedicated 595/595 acceptance contract, BDD proof 45/45, all builds and type checks, and every
  available dependency audit passed. The installed-Codex approval-boundary live tripwire passed 1/1.
- 2026-09-12T06:03:08Z Final quality-review improvements: Independent Claude Opus review
  `25a24b1b-100f-49f1-be66-7dbe206fe3f6` approved with no blocking findings. Implemented every
  suggested cleanup: explicit generator test output, no-op/current reconciliation reporting,
  stronger full-argv live policy assertions, documented and tested Claude skill namespacing,
  version-derived fixtures, and two historical Markdown table repairs. The affected contract tests
  pass 30/30, the installed-Codex live boundary passes 1/1, lint/typecheck are clean, and generated
  Claude/Codex artifacts are current.
- 2026-09-12T07:42:53Z Terminal review and cleanup: Reviews
  `f34021b4-8b8b-4990-960d-ac61f5f09f07`, `a81690be-65d0-47b7-a338-764d53b6ccb6`,
  `d5b884a0-65d0-476a-a2d7-a2063f02840a`, and
  `9d627a5a-0bfb-4f71-9855-282796f68eb1` drove further bounded corrections. Terminal independent
  review `c62341ad-6aaa-4e69-b833-74d13c134520` approved the result. Its concrete warnings were
  resolved with typed route-configuration failures, genuinely read-only plugin checks, unconditional
  Codex manifest-version validation, complete RED-only argument rejection, prompt-denial preservation,
  malformed dispatcher handling, and live allow-rule coverage for normal argument variants. Focused
  regressions pass 97/97, review wiring passes 122/122, the installed-Codex boundary passes 1/1,
  lint/typecheck/format/Markdown checks are clean, and every generated artifact is current.
- 2026-09-12T15:51:15Z Full verification follow-up: Fixed stale generated/reference fixtures and a
  real Claude lifecycle defect where a partially failed prompt event could write false execution
  proof. The restarted full run passed all unit suites, builds, typechecks, audits, and its first
  1,499-scenario acceptance pass, then exposed an underfunded review-fixture deadline in the repeated
  acceptance lane. Root cause and ruled-out alternatives are recorded above; fixture budgets were
  separated by intended behavior before restarting verification.
- 2026-09-12T16:35:00Z Full repository audit: Ran every repository-scope audit block after the clean
  verification run. Config reconciliation, principle traces, domain references, architecture, docs,
  learning metadata, and the 20-file test-quality sample are clean. Fixed the Go experiment grader's
  formatter/linter findings and updated the three low-risk outdated development tools (ESLint, Knip,
  and lint-staged); lint, typecheck, Go checks, and the dependency audit are green. Knip's remaining
  archive/experiment/API findings and jscpd's generated-surface clones are the documented repository
  baseline, not deletions safe to infer from static discovery.
- 2026-09-12T16:48:00Z Full refactor pass: Re-scouted the complete branch after verification and
  audit. Extracted the four remaining rubric-generator declarations into one parameterized helper,
  removing repeated path resolution, source loading, module rendering, and reconciliation wiring
  without changing their public entry points or output bytes. All four generated rubrics remain
  current, package typecheck passes, and the focused generator/release contracts pass 35/35.
- 2026-09-13T20:57:38Z Standing authorization verified: After the user explicitly authorized
  bounded, secret-screened Safeword packets to Claude through Anthropic and fallback Codex through
  OpenAI, quality review `8b23287b-d7d6-4dbd-bbe5-a5fd0f8d9f99` crossed the host boundary without
  a user approval prompt and returned an independent Claude Opus verdict. The same review found one
  blocking legacy Python-manifest false positive plus bounded cleanup opportunities; all actionable
  findings entered the review-fix loop.
- 2026-09-13T22:05:00Z Review-fix verification: Independent review
  `07c5e9de-4f26-4d17-b1ff-a608d76795d8` caught pinned `setup.cfg` continuations and uv batch-order
  gaps. Replaced substring parsing with declaration-aware legacy parsing, inherited uv workspace
  declarations, deferred shared-lock validation until all installs settle, and strengthened the
  shell/BDD fixtures. Focused Python and shell tests pass 77/77 with one opt-in skip; the decision
  brief feature passes 87/87 scenarios; lint, Gherkin lint, and typecheck are clean.
- 2026-09-13T22:32:00Z Independent quality loop: Review
  `c3dc1249-cf58-4c03-9f5f-11d0a1587915` identified one remaining false-green shell lane and six
  test-quality weaknesses. Unavailable shell runners now fail visibly, multiline setup.py examples
  cannot masquerade as dependencies, Ruff inheritance is asserted, TDD wording matches its ledger,
  linear-work instrumentation has a floor and monotonic check, and acceptance fixtures mutate only
  temporary copies. Focused regressions pass 99/99 with one opt-in skip, the feature passes 87/87
  scenarios (3,984/3,984 steps), both generated plugins are current, and lint/typecheck are clean.
- 2026-09-16T18:04:00Z Closing review fixes: Independent Claude Opus review
  `c88f5e48-a553-4aca-a8c6-9c227a5c7f19` approved with no error-severity finding. Confirmed the
  verify resolver-failure and no-duplicate-BDD concerns already have behavioral tests. Fixed the one
  real parser mismatch so whole-line `setup.cfg` comments preserve dependency continuations, and
  added a direct done-gate decision test proving an unavailable required runner blocks completion.
  The parser suite passes 66 tests with one intentional skip; both done-gate decision tests pass.
- 2026-09-16T18:15:00Z Terminal review fixes: Independent Claude Opus review
  `f3ea06f2-38cf-4638-8d96-0d81a95bb985` approved with no release-relevant defect. Closed its
  concrete warnings by supporting `:` in `setup.cfg`, preserving missing-runner diagnostics after
  output truncation, documenting the fail-closed bunx fallback, and asserting relay throughput
  against its deadline/latency budget. The expanded focused suite passes 267 tests with one
  intentional skip; build, typecheck, lint, Gherkin lint, parity, and 13/13 scenarios are green.
- 2026-09-16T18:24:00Z Final hardening: Independent Claude Opus review
  `57a0465f-cc78-48e7-bb04-c757a6121de7` approved with no error-severity defect. Bounded preserved
  diagnostics inside the output cap, disabled update chatter for the JSON resolver subprocess,
  widened and bounded the relay-throughput assertion, documented mixed-manager rollback intent, and
  pinned executable JavaScript fixtures to npm. The final focused suite passes 268 tests with one
  intentional skip; all 13 scenarios and 601 steps plus build/static/parity checks pass.

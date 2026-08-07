# Impl Plan: Route ready PRs with a safe advisory review

**Status:** implemented

## Approach

The riskiest assumption is that one base-branch workflow can inspect every
changed text artifact and publish a useful receipt while structurally removing
GitHub write authority from model inspection and all untrusted-code execution.
The within-workflow model-secret boundary is independently lint-enforced rather
than physically unavailable. The cheapest proof is the fork scenario: a
workflow-contract test must show no checkout/execution step, no write permission
on inspection, no model secret on publication, and a strict JSON-only handoff
before any provider integration is built.

## Implementation outcome

The shipped MVP follows the planned split-privilege shape with a default-off
router and reusable worker, typed `review-pr inspect|invalidate|publish` CLI
stages, a strict JSON-only handoff, deterministic route/receipt reducers, and an
OpenAI Responses adapter. The inspection job has read-only GitHub permissions
and the model environment; publication has ordinary issue-comment authority but
no model secret or checkout. The public handler and GitHub boundary are exercised
through real entry points with only network/provider edges substituted.

Deterministic evidence is recorded in the PR-review Vitest suite and all 60
feature scenarios (2,336 steps). Independent cross-agent quality review approved
the implementation after budget accounting and production binary classification
were reconciled. The disposable GitHub/runtime and selected live Flux checks
remain release evidence, not local deterministic proof.

### Proof plan

| Behavior | Primary proof | Supporting proof |
| --- | --- | --- |
| Eligible exact-head review after configured prerequisites settle | Workflow integration test exposes a deterministic run ID: explicit-empty configuration publishes from the original run, while a pending PR-boundary run publishes the sole `prerequisites_pending` non-route receipt and exits before model; a later scheduled sweep uses a new run ID, samples the same exact SHA after successful settlement, and updates that receipt with the review | Single-sample prerequisite reducer matrix covers every check-run status/conclusion and commit-status state, plus unconfigured, explicitly empty, pending, never-appearing identity, and head change |
| Ineligible, duplicate, and concurrent triggers | Workflow-contract test proves both direct-event and scheduled-matrix callers pass the same normalized PR input; the reusable worker evaluates workflow-level `pr-review-${PR}` concurrency around all jobs, and a started same-SHA queued call records `suppressed` before model invocation | Required pre-release disposable-repository smoke verifies real event-vs-sweep serialization and GitHub's one-running/one-pending replacement behavior; publisher reconciliation remains the deterministic uniqueness backstop |
| Recognized and unfamiliar text receive visible coverage | Integration test with a fake GitHub client/provider proves each concrete text path is integrity-reviewed; a mixed clean-text+binary fixture marks binary skipped without an unknown and may remain `looks_ready`, while binary-only produces zero reviewable evidence and `incomplete` | Evidence-budget/parser unit tests distinguish per-file skip, unreadable-text unknown, and change-set-level zero-evidence state |
| A current PR has zero reviewable text evidence | Route-matrix unit case proves `incomplete` / `needs_human`, never `looks_ready` | Evidence integration cases for binary-only, unreadable, and over-budget changes |
| Flux access regression routes human | Guarded live eval | Deterministic fake-provider scenario for the same finding |
| Conservative route states | Unit table over every run-state/finding/unknown/head combination proves `stale` > `failed` > `incomplete` > `complete` and consumes a validated consequential flag rather than model-selected routing | Result-schema property/boundary tests |
| Every new SHA forces fresh review; mid-run change becomes stale | Integration tests with injected head progression prove the same marker-owned comment is updated and exactly one receipt remains | Freshness reducer unit tests |
| Receipt uniqueness survives a race | Publisher integration test injects two bot-authored exact-marker comments, proves the oldest is updated and the duplicate is deleted, and proves user-authored/lookalike comments remain untouched | Real-concurrency smoke remains supporting evidence rather than the sole correctness guard |
| Ready-to-draft transition removes a positive route | Workflow integration test starts with a `looks_ready` marker receipt, triggers `converted_to_draft`, and proves the same comment becomes `not_ready (draft)` with no route before prerequisite/model work | Workflow-contract test proves the cancellation input changes the same reusable worker's per-PR group policy |
| Ineligible scheduled candidate cannot publish | Worker integration test changes PR state to draft, closed, or merged after discovery and proves an existing receipt becomes route-free `not_ready`, an absent receipt stays absent, and prerequisite/model clients are untouched | Entry reducer cases for open, draft, closed, and merged |
| Receipt evidence, unknown usage, and actionable findings | Renderer snapshot/semantic tests | Strict artifact parser tests |
| Prerequisite non-run vs review failure remain distinct | Renderer semantic test proves `prerequisite_failed` has no advisory route while `review_failed` routes human | Discriminated-union parser and route matrix |
| Missing prerequisite configuration gives an NTB next action | Receipt renderer integration test proves `prerequisites_unconfigured` names `prReview.requiredChecks` and emits no route | `safeword status` diagnostic test uses the same message contract |
| Fork data-only privilege separation | Workflow-contract integration test proves a positive receipt plus exact read-only inspection permissions and no checkout/exec step; missing or empty inspection/publication audits block publication with zero GitHub writes | The publisher audit identifies validated serialized advisory evidence as its sole input; endpoint sentinels prove no fork payload/executable artifact and no review, merge, status, check, or content-write call |
| Model credentials cannot enter the handoff | Producer contract test injects a sentinel API key/header and proves it appears nowhere in the sole bounded JSON artifact, captured logs, job outputs, or error strings; workflow lint forbids inspection job outputs and permits only the named upload/download artifact channel | Strict schema forbids provider headers/transport fields; sanitizer unit tests cover every free-text field and artifact metadata |
| Adversarial PR text cannot expand authority or override deterministic human-routing evidence | Integration test compares hostile title/body against a no-injection control with the same deterministic concern and proves route plus receipt authority fields are byte-identical and any model-declared route is ignored | Guarded live eval measures model finding suppression, which remains a model-quality residual rather than a structural guarantee |
| Receipt cannot affect merge eligibility | Publisher integration test allowing only issue-comment endpoints | Guarded disposable-repository smoke |

The live GitHub smoke requires an explicitly configured disposable repository
because workflow files must exist on its default branch. It may be skipped in
ordinary developer CI, but it is a release gate for enabling/shipping the
workflow. The release job fails closed when the fixture is unconfigured or any
smoke assertion is skipped: environment-secret scoping, event-vs-sweep serialization, pending-run
replacement, and merge-neutral issue-comment behavior must all pass at runtime.
Deterministic workflow, schema, reconciliation, and endpoint tests remain
required on every run.

### Affected-surface proof

- **Safeword CLI:** a wiring test invokes the real `review-pr` command with real
  config/result parsers and fake network/provider adapters; unit-only collaborator
  mocks do not count as entry-point proof.
- **GitHub pull request conversation:** workflow-contract and publisher tests
  prove event/permissions/endpoints/marker updates; the pre-release disposable
  smoke proves runtime secret scoping, serialization, and ordinary-comment
  rendering without review/check side effects.

### Environment mapping

- TypeScript pack: strict boundary parsing, result unions, native fetch, and
  Vitest apply across every deterministic scenario.
- GitHub Actions YAML: schema registration, template/dogfood parity, permissions,
  triggers, concurrency, and forbidden-step contract tests.
- Gherkin: live-model and live-GitHub scenarios stay explicitly tagged outside
  deterministic CI.

### Build order

0. **GitHub syntax spike:** validate the worker job using
   `environment: { name: safeword-pr-review-model, deployment: false }` against
   the current GitHub workflow schema/actionlint fixture. In the same minimal
   fixture, validate that a reusable workflow accepts typed PR/cancellation
   inputs in workflow-level `concurrency`, and validate that a calling job accepts
   `uses`, matrix `strategy`, `permissions`, `with`, and `secrets` together. Do
   this before building the pair. If matrix reusable calls fail validation, the
   bounded fallback is a metadata-only scheduled dispatcher with `actions:write`
   invoking the same worker through `workflow_dispatch`; publisher reconciliation
   still owns receipt uniqueness. That fallback must use only the workflow-
   dispatch endpoint at a pinned default-branch worker, pass the same typed
   PR/cancellation inputs, retain worker-level concurrency, and pass the same
   event-vs-sweep runtime smoke; the router may have only `actions:write`,
   `pull-requests:read`, and `contents:read`, with no secrets or checkout. A
   slice-0 failure records the selected fallback in the design before slice 1;
   it cannot silently degrade. If environment syntax fails despite the current
   official docs, stop and reassess the secret boundary rather than silently
   falling back to a repository secret. Record environment protection rules as
   operationally incompatible.
1. **Privilege skeleton first:** add failing workflow-contract tests for explicit
   `opened`, `reopened`, `synchronize`, `ready_for_review`, and
   `converted_to_draft` activity types, per-job permissions, no
   checkout/execution, environment-secret separation, JSON artifact, and
   ordinary-comment-only publication. Prove direct-event and scheduled-matrix
   callers pass the same normalized PR/cancellation inputs and the reusable
   worker applies one workflow-level concurrency group; add the router/worker
   template/schema entries only until those tests pass.
2. **Contracts and route core:** add schema-v1 types/parsers, route/freshness
   reducers, distinct non-run/review-failure states, configured prerequisite
   identities, the prerequisite single-sample reducer, config parsing, caps, and
   their complete unit matrices.
3. **Evidence-to-model slice:** add read-only GitHub evidence acquisition,
   provider interface, explicit OpenAI Responses adapter, prompt, and the real
   CLI inspection wiring test. Before provider work, use the disposable fixture
   to prove the base-repository token can read full blobs for a fork head SHA;
   if it cannot, record those artifacts as unknown/incomplete rather than adding
   checkout. Then run the deterministic unfamiliar-artifact test.
4. **Publisher slice:** validate the artifact and identity again, re-check the
   head/state, reconcile bot-authored exact-marker duplicates, render/update the
   canonical issue comment, and prove the issue-comment-only endpoint allow-list,
   lookalike-comment protection, closed/merged exit, and stale downgrade.
5. **Workflow end to end:** wire router → serialized reusable worker → invalidate
   → single prerequisite sample → pending receipt or inspect → publish, plus a
   five-minute scheduled ready-PR discovery sweep; prove pending publishes no
   route and exits before model, the later sweep updates the same receipt after
   settlement, ready-to-draft removes a positive route, and started queued
   same-SHA/new-head calls recheck receipt/head before converging dogfood
   templates through setup.
6. **Evaluation and docs:** run the selected Flux eval, optionally run the
   disposable GitHub smoke, then update README and website CLI/config docs.

## Decisions

| Decision | Choice | Alternatives considered | Rejected because |
| --- | --- | --- | --- |
| MVP scope | Full fresh advisory review and one ordinary receipt; no execution, inline comments, or reuse | Current all-in-one plan; deterministic triage only | Full plan couples three security/state clusters; deterministic-only misses #1909's unfamiliar-artifact value |
| Prerequisite identity | `prReview.requiredChecks` is the MVP source of truth as `{ context, appId? }[]`; an explicit empty list means none, while a missing value is `prerequisites_unconfigured` and cannot review | Discover classic branch protection; discover rulesets; silently treat inaccessible requirements as none | Classic protection requires Administration-read, which violates least privilege; rulesets Metadata-read does not cover classic protection; silent fallback could review before real prerequisites settle |
| Prerequisite settlement | PR-boundary and scheduled-sweep jobs each sample configured check-run/status identities once for the exact SHA. Pending exits immediately and is reconsidered by the next five-minute sweep; success reviews; terminal failure publishes a non-run receipt. Check-run `success`, `neutral`, and `skipped` pass; `failure`, `cancelled`, `timed_out`, `action_required`, `stale`, and `startup_failure` fail; non-completed or null-conclusion checks remain pending. Commit-status `success` passes, `failure`/`error` fail, and `pending` or a missing configured context remain pending | Held-runner polling; `check_run` / `check_suite` / `status` events; `workflow_run` bundle | Held polling can starve the checks it waits for; GitHub suppresses check events for suites created by Actions; status events do not cover check runs; one named workflow completion does not establish every configured prerequisite settled. The sweep adds at most five minutes of review latency without holding runner capacity |
| Privileged workflow | A thin trigger router handles `pull_request_target` plus schedule and calls one reusable split-job worker; the model key is an environment secret available only to the worker's inspection job through `environment: { name: safeword-pr-review-model, deployment: false }`. Contract tests validate GitHub's schema and forbid that environment/secret in write-capable jobs | #1917's independent workflow pair; repository secret; one write-capable process; external credential broker | GitHub's current [workflow syntax](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#jobsjob_idenvironment) says: “Set `deployment` to `false` to use an environment's secrets and variables without creating a deployment object.” Setup requires no wait timer, required reviewers, or custom deployment protection rule; runtime scoping is a pre-release smoke gate |
| Receipt/concurrency ownership | Direct-event and scheduled-matrix callers normalize PR number and pass typed inputs to one reusable worker, whose workflow-level `pr-review-${PR}` group wraps all jobs. Ordinary calls disable cancellation; `converted_to_draft` enables it, rewrites an existing positive receipt to `not_ready (draft)`, and exits before prerequisite/model work | Caller-job locks; inner-job locks; PR+SHA groups; transactional database | One reusable workflow-level input expression covers both event shapes and all writers; publisher reconciliation independently restores uniqueness. If matrix reusable calls are unsupported, the fallback dispatcher has a strict endpoint/permission allow-list, calls the same `workflow_dispatch` worker inputs/concurrency, and must pass the same runtime smoke |
| Re-evaluation cadence | One sample per run plus a five-minute scheduled sweep; no sleeping runner and no fabricated pending-run disposition | Held-runner polling; check-event wakeups; manual retry | Held polling can deadlock a saturated runner pool; check events are suppressed for Actions-created suites; manual retry is not automatic. The sweep's bounded discovery/matrix path is the smallest reliable wakeup available |
| Never-settling prerequisite | Remain `prerequisites_pending`, name the missing identity and configuration action in the sole receipt, skip model work, and reconsider on each sweep | Guess success; terminal timeout; stop sweeping silently | Guessing violates the prerequisite contract; a universal timeout can bypass intentionally slow/manual checks; silently stopping strands the receipt. Cost/volume thresholds trigger a later backoff design |
| Freshness | Re-review every new SHA and re-check immediately before publish | Materiality classifier and freshness bridge | Classification is an optimization with its own evidence contract, not required for safe value |
| Publication | Reconcile to one bot-authored marker-owned ordinary issue comment; delete only exact-marker bot duplicates | Check run, review/approval, status; concurrency-only uniqueness | GitHub counts neutral/skipped checks as successful; review/check surfaces can affect policy. Publisher reconciliation makes uniqueness idempotent even if concurrency fails |
| Model boundary | Explicit OpenAI Responses adapter, configured model, strict JSON Schema, no tools, native fetch | SDK dependency; reviewer CLI; inferred provider | One endpoint does not justify a dependency; runner CLI bootstrap/auth is not present; inference hides customer policy |
| Handoff | Strict bounded schema-v1 JSON artifact, validated by producer and publisher | Free-form markdown or executable bundle | Publisher must receive evidence only and reject identity/size/state mismatches |

Evidence: GitHub's secure-use guidance forbids untrusted checkout in privileged
triggers; workflow syntax supports job-level permissions; required-check docs
treat `neutral` and `skipped` as successful; issue comments are distinct from
review comments; check events are suppressed for suites created by Actions
(third-party CI events may still arrive, but are not a universal wakeup);
environment secrets are limited to jobs that reference that environment; and
OpenAI Responses supports strict JSON Schema output and no-tool operation. See
links in `design.md`.

Prompt injection has two distinct boundaries. Structure prevents PR text from
granting capabilities or overriding deterministic non-model route evidence, and
the route reducer ignores any route proposed by the model. The consequential
flag itself originates in validated model output, so a model can suppress a
model-only finding; the guarded hostile-text evaluation measures that residual
and receipt/README copy must never call content findings structurally
unsuppressable.

## Design alignment

| Principle | Consequence | Proof | Conflict |
| --- | --- | --- | --- |
| Optimize for the NTB without constraining the TBU | One plain route and next action lead; exact evidence/usage/unknowns remain in the receipt | `packages/cli/tests/pr-review/review-pr-publication.test.ts` | |
| 1. Structure enforces; instructions suggest | Job permissions and absent checkout make write/execution authority unavailable to inspection; strict parsing, endpoint allow-list, and secret-reference lint independently observe the remaining boundaries | `packages/cli/tests/pr-review/workflow-contract.test.ts` | |
| 2. Fire at boundaries, not every turn | Review starts at PR readiness/head boundaries or the bounded five-minute pending-state sweep and publishes one marker-owned receipt | `packages/cli/tests/pr-review/workflow-contract.test.ts` | |
| 3. Add, never replace | Default-off schema-managed workflow is reconciled without replacing customer workflows/config | `packages/cli/tests/reconcile.test.ts` | |
| 5. Clarity before correctness | One result vocabulary and route reducer drive CLI, workflow, receipt, and tests | `packages/cli/tests/pr-review/review-pr-wiring.test.ts` | |

Architecture decisions honored:

- Schema as single source of truth and reconciliation over copy.
- Typed CLI Execution and Discovery.
- Release privilege-separation precedent.
- Advisory PR Review as a Split-Privilege Evidence Pipeline, revised to the
  phased HXT3GW → Z7M7Y3 → 436EQW delivery.

## Known deviations

- The MVP publishes receipt findings with stable `path:line` locations rather
  than GitHub inline review comments. Z7M7Y3 adds exact-SHA inline publication
  after the result schema is proven.
- The provider boundary initially has one OpenAI adapter. Cross-vendor/model
  selection and efficacy policy remain in #1910-#1915.
- The workflow deliberately performs no customer-code execution; all displayed
  model remedies remain unverified until 436EQW.
- A real GitHub runtime smoke needs a disposable fixture and may be skipped in
  developer CI, but it must pass before the workflow is enabled or released.
- Job-level GitHub permissions are structural, and secret separation uses an
  environment-scoped secret unavailable to jobs that do not reference the model
  environment. A workflow-contract lint must also fail a future edit that adds
  that environment or secret reference to a write-capable job; GitHub cannot
  prevent an authorized maintainer from weakening workflow configuration itself.
- Per-PR queued serialization may delay a new-head review behind an obsolete run.
  Every prerequisite, inspection, and pre-publication boundary rechecks the head
  so the obsolete run terminates stale as quickly as practical; correctness of
  the sole current receipt wins over parallel revision throughput in the MVP.
- Scheduled workflows may be delayed by GitHub under load; pending prerequisites
  therefore remain visible in the sole non-route receipt until a later sweep
  observes a terminal state.
- GitHub evidence acquisition currently uses the pull-files API's changed hunks,
  not full blobs. A missing patch fails closed as unreadable text except for a
  conservative recognized-binary extension list, which is recorded as skipped.
  Full-blob fork access and runtime compatibility remain in YC6JCC's release
  smoke rather than expanding inspection authority here.
- The shipped prerequisite identity is exact check/status `context` only; the
  planned optional GitHub App ID discriminator is deferred until a real
  same-context collision requires it. Missing or ambiguous contexts still fail
  closed.
- The shipped evidence cap is the cumulative `maxTotalBytes` boundary. Per-file
  and file-count caps were not needed for the bounded MVP; omitted/over-budget
  evidence remains explicit and cannot produce `looks_ready`.
- A provider failure is terminal for the current SHA, so the scheduled sweep
  does not retry that same revision. This preserves conservative routing and
  bounded cost; a new SHA always gets a fresh attempt.

## Doc impact

- `README.md`: default-off reviewer, one-receipt UX, evidence boundary, and
  explicit non-approval/non-execution language.
- `packages/website/src/content/docs/reference/cli.mdx`: `review-pr` stages,
  result states, diagnostics, and exit behavior.
- `packages/website/src/content/docs/reference/configuration.mdx`: enablement,
  provider/model, environment-scoped secret and environment name, evidence caps,
  required-check identity configuration (including explicit empty vs missing),
  prerequisite sweep cadence/pending behavior, fork safety, the always-re-review
  MVP freshness policy, and the fact that pending/terminal prerequisite states
  produce a non-route receipt while draft transition updates only an existing
  receipt.

These are build-order slice 6 and must match the shipped parser/workflow names.

## Implementation safeguards

- Deterministic sweep scenarios inject prerequisite observations and invoke the
  sweep entry point synchronously; they never sleep or depend on GitHub cron.
- Remove the feature-level `@wip` at the first RED and prove the deterministic CI
  selector includes the feature before counting scenario results.

## Assessment triggers

- GitHub changes `pull_request_target`, job permissions, required-check
  conclusions, queued concurrency, artifacts, or issue-comment semantics.
- Evidence caps route an unacceptable share of real PRs to incomplete.
- Scheduled discovery volume approaches matrix or API limits, or p95 terminal
  settlement-to-review latency exceeds the five-minute target; shard or persist
  the poll-then-requeue sweep before liveness degrades.
- Never-settling prerequisite volume makes repeated sweeps materially costly;
  add observable backoff without weakening the conservative pending state.
- Repeated model cost/noise materially harms adoption; start Z7M7Y3 rather than
  weakening the MVP freshness rule in place.
- A second provider ships or #1910-#1915 selects vendor/model policy.
- Any execution or verified-remedy requirement appears; stop and route it to
  436EQW rather than expanding this workflow's authority.

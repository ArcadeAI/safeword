# Design: Route ready PRs with a safe advisory review

**Related:** [spec.md](./spec.md) | [test-definitions.md](./test-definitions.md)

## Architecture

Ship a default-off, schema-managed workflow pair: a thin trigger router handles
`pull_request_target` boundaries and a five-minute scheduled sweep, while every
selected PR calls one reusable split-privilege worker. The caller passes a typed
PR input; the reusable workflow owns the per-PR concurrency group around all of
its jobs. No job checks out pull-request code. Inside the worker, a metadata-only job first marks any old
receipt stale, a read-only inspection job fetches changed text through GitHub's
API and calls the configured model, and a publisher with no model secret
validates a bounded result before updating one ordinary issue comment. Every new
head is fully reviewed; there is no materiality classifier.

```text
router: ready/synchronize/reopen or scheduled ready-PR sweep
        |
        v
call reusable worker      [input: PR]
        |
        v
worker concurrency        [pr-review-${inputs.PR}]
        |
        v
invalidate old receipt  [issues:write; no model; no PR artifacts]
        |
        v
inspect exact head       [contents/pulls:read; model-environment secret; no write; no checkout]
        |
        v
strict advisory result   [bounded JSON artifact]
        |
        v
publish current receipt  [issues:write; no model; no checkout; re-check head]
```

Both the direct-event caller and scheduled matrix caller pass the normalized PR
number and cancellation intent as typed reusable-workflow inputs. The reusable
workflow applies workflow-level `group: pr-review-${{ inputs.pull_number }}`
around invalidation, inspection, and publication. Draft calls set conditional
cancellation; ordinary calls do not. GitHub may replace an intermediate pending
run, so the MVP does not invent a `coalesced` disposition for a job whose steps
never execute. Any same-SHA run that does start after the current run exits
before model invocation and records `suppressed`. A new SHA also waits; the
running obsolete revision rechecks the head at each boundary, publishes stale,
and releases the group before the latest queued revision reviews. Concurrency is
coordination, while exact-head checks prove freshness.

## Components

### Component 1: Review contracts and route core

**What:** Defines one discriminated result model, strict boundary parsers, and
pure eligibility/freshness/route reducers.

**Where:** `packages/cli/src/pr-review/contracts.ts`, `route.ts`, `config.ts`

```typescript
type RunState = 'complete' | 'incomplete' | 'failed' | 'stale';
type AdvisoryRoute = 'looks_ready' | 'needs_human';

interface AdvisoryResultV1 {
  schemaVersion: 1;
  repository: string;
  pullNumber: number;
  reviewedSha: string;
  observedHeadSha: string;
  runState: RunState;
  route: AdvisoryRoute;
  findings: AdvisoryFinding[];
  reviewers: EvidenceItem[];
  checks: EvidenceItem[];
  skippedChecks: EvidenceItem[];
  unknowns: string[];
  usage: { inputTokens: number; outputTokens: number } | null;
  counts: { published: number; suppressed: number };
}
```

The boundary output is a discriminated union. `kind: 'not_run'` carries a null
route and one of `not_ready`, `prerequisites_unconfigured`, or
`prerequisite_failed`; `kind: 'reviewed'` carries
`AdvisoryResultV1`, whose `failed` state is rendered as `review_failed`. This
keeps a failed prerequisite visibly distinct from a reviewer/provider/tool
failure that routes to a human.

`looks_ready` is valid only for `complete`, exact-head results with zero
consequential findings and zero unknowns. All other terminal evidence routes to
`needs_human`. Missing usage remains `null`, never zero.

### Component 2: Evidence and model inspection

**What:** Reads PR metadata/files as data, enforces evidence budgets, calls one
provider adapter, and converts structured model output into `AdvisoryResultV1`.

**Where:** `packages/cli/src/pr-review/github.ts`, `evidence.ts`, `provider.ts`,
`providers/openai.ts`, `inspect.ts`, `prompt.ts`

The GitHub client exposes only GET endpoints during inspection. It fetches the
exact head, changed-file metadata, patches, and text blobs without checkout.
Every readable changed text artifact is included regardless of extension.
An individual binary/non-text artifact is recorded as skipped and does not by
itself become an unknown or block `looks_ready` when the change set also has
complete, clean text evidence. Unreadable expected text, truncated evidence, or
over-budget text becomes a recorded unknown and therefore cannot yield
`looks_ready`. If the entire current change set produces zero reviewable text
evidence—including a binary-only change set—the attempt is `incomplete` and
routes `needs_human`; an empty integrity input can never be treated as clean.

The initial OpenAI adapter calls `/v1/responses` with a configured model, no
tools, `store: false`, and strict JSON Schema output. The provider interface is
small enough for later vendors but does not implement vendor selection policy.
The returned route is ignored; the deterministic route core derives it from
validated findings, unknowns, completion, and freshness.

The model cannot gain authority or override a deterministic concern through PR
text. It can still fail to report a model-only finding after prompt injection;
that is an explicitly measured live-evaluation risk, not a structural guarantee.
Even a `looks ready` receipt therefore says the advisory review can miss issues,
does not replace human review, and is not safe-to-merge evidence—copy tested from
the NTB perspective rather than left only in technical documentation.

### Component 3: Publication, CLI, and distribution

**What:** Composes explicit CLI stages, validates the serialized handoff, updates
one marker-owned ordinary issue comment, and distributes the workflow/config.

**Where:** `packages/cli/src/commands/review-pr.ts`,
`packages/cli/src/pr-review/publish.ts`,
`packages/cli/templates/workflows/pr-review.yml`,
`packages/cli/templates/workflows/pr-review-worker.yml`,
`packages/cli/src/schema.ts`

The public command exposes stage-specific operations used by workflow jobs:

- `review-pr invalidate` reads only PR identity/current SHA and marks an existing
  receipt stale.
- `review-pr inspect` emits the bounded schema-v1 result and never writes GitHub.
- `review-pr publish` accepts only a result file, re-checks the current head, and
  calls only list/create/update/delete issue-comment endpoints. Delete is limited
  to bot-authored comments carrying the exact Safeword marker after the oldest
  such comment is selected as canonical.

The receipt renderer gives each finding `path:line`, evidence, consequence, and
one next action. It never creates review comments, reviews, statuses, checks, or
approvals. A stable hidden marker lets publication update in place.

## Data Model

`AdvisoryFinding` carries `severity`, `path`, optional `line`, `evidence`,
`consequence`, `nextAction`, and optional `unverifiedRemedy`. It has no
`verified` field in the MVP. The serialized artifact rejects unknown keys,
oversized strings/arrays, repository or PR mismatch, malformed SHAs, and routes
inconsistent with deterministic evidence.

Configuration is default-off and explicit:

```typescript
interface PrReviewConfig {
  enabled: boolean;
  provider: 'openai';
  model: string;
  maxFiles: number;
  maxBytesPerFile: number;
  maxTotalBytes: number;
  requiredChecks?: Array<{ context: string; appId?: number }>;
}
```

The MVP sweep cadence is five minutes, GitHub's minimum scheduled-workflow
interval. It is fixed in the schema-managed workflow rather than pretending a
runtime config value can rewrite cron syntax. Each run samples prerequisite
state once and exits; it never sleeps while holding a runner.

`requiredChecks` is authoritative in the MVP. An explicit empty array means the
repository intentionally has no prerequisite checks and settles immediately.
An omitted value produces a `prerequisites_unconfigured` non-run receipt; it
never silently means none. That receipt gives the exact
`prReview.requiredChecks` configuration to add, and `safeword status` surfaces
the same diagnostic at setup time. This avoids Administration-read access
required for classic branch-protection discovery while still supporting
app-bound check identities.

The prerequisite reducer mirrors GitHub required-check semantics:

| Source | Pass | Fail | Pending |
| --- | --- | --- | --- |
| Check run | `success`, `neutral`, `skipped` | `failure`, `cancelled`, `timed_out`, `action_required`, `stale`, `startup_failure` | any non-completed status or null conclusion |
| Commit status | `success` | `failure`, `error` | `pending` or missing configured context |

The API key uses one documented secret name stored in the
`safeword-pr-review-model` GitHub environment. Only the inspection job references
that environment through the current GitHub YAML shape
`environment: { name: safeword-pr-review-model, deployment: false }`;
environment secrets are unavailable to the publisher job. Contract tests reject
the model environment or secret in any write-capable job. No secret value
appears in config, artifacts, logs, or receipt output. Workflow validation uses
the current GitHub schema, whose documented environment syntax explicitly
supports `deployment: false`; the model environment must not use an incompatible
custom deployment protection rule.

Verified 2026-08-05 against GitHub's workflow-syntax and deployment docs: “Set
`deployment` to `false` to use an environment's secrets and variables without
creating a deployment object.” The exact syntax is shown under
`jobs.<job_id>.environment`; slice 0 still schema-validates it to catch toolchain
lag rather than relying on prose alone.

Artifact schemas are strict within a version. A future incompatible or additive
shape receives a new schema version and parser; an older publisher refuses an
unknown version conservatively instead of silently dropping fields. The hidden
receipt marker records its schema version so upgrades and rollback remain
observable.

## Component Interaction

1. `pull_request_target` explicitly handles `opened`, `reopened`, `synchronize`,
   `ready_for_review`, and `converted_to_draft`. Draft exit therefore fires even
   without a new commit. Draft entry conditionally cancels the in-flight per-PR
   run, updates an existing marker-owned receipt to `not_ready (draft)` with no
   advisory route, and exits
   before prerequisite sampling or model work. It does not create a new receipt
   when none exists.
2. The invalidator updates only the marker-owned receipt for the prior SHA.
3. A PR-boundary run samples authoritative required checks once for the exact
   SHA. If any remain pending, it creates or updates the sole receipt with
   `prerequisites_pending`, publishes no route, and exits before model work.
4. A scheduled discovery job every five minutes lists ready open PRs without a
   current terminal receipt and dispatches bounded per-PR matrix jobs. Each job
   rechecks the exact head and samples matching check-run and commit-status APIs
   once. Failure updates the ordinary receipt with a `not_run` reason and no
   advisory route; success proceeds. An explicitly empty required-check list
   settles immediately; missing configuration publishes
   `prerequisites_unconfigured`. Draft PRs do not publish a receipt.
5. Evidence acquisition re-checks the head, reads changed artifacts through the
   API, and invokes the strict provider adapter.
6. The route core creates a bounded result artifact.
7. Publication validates identity/schema, re-fetches the head, downgrades a
   mismatch to stale, and updates the sole marker-owned ordinary comment in
   place while holding the same per-PR workflow concurrency group as every
   other receipt writer. The receipt marks each reviewed artifact path with an
   integrity-review coverage result and any skip reason, so a listed path alone
   cannot falsely imply technology-neutral coverage.
8. Before any scheduled worker work, PR state is revalidated. Draft, closed, or
   merged candidates skip prerequisite/model work, rewrite an existing receipt
   to a route-free not-ready state, and create none when absent.
9. Every publication reconciles bot-authored exact-marker comments: update the
   oldest canonical comment and delete duplicates. This preserves the one-receipt
   invariant even if GitHub concurrency or a historical workflow revision races.

When conditions overlap, the route core applies one deterministic run-state
precedence: `stale` > `failed` > `incomplete` > `complete`. A validated
`consequential` flag is evidence consumed by that reducer, never a route chosen
by model prose.

Non-run publication has one visible boundary: every ready revision with pending,
missing, or failed prerequisites creates or updates the marker-owned receipt with
no advisory route. An always-draft PR creates none; a ready-to-draft transition
rewrites only an existing receipt to `not_ready (draft)`. Scheduled
re-evaluation is idempotent and never holds a runner while waiting for another
check.

A configured identity that never appears remains pending indefinitely, matching
the conservative merge-protection posture rather than guessing success. Its
receipt names the absent context/app identity and the exact configuration key to
verify. The sweep continues without model calls; assessment thresholds bound
when this MVP policy must be revisited for cost.

## Key Decisions

### One fully fresh review per SHA

**Why:** It removes the materiality classifier and freshness bridge from the
trust boundary. The later optimization is additive because `reviewedSha` and
`observedHeadSha` are already explicit.

**Trade-off:** More model cost and repeated findings until Z7M7Y3.

### One router/reusable-worker pair with job-level capability separation

**Why:** Caller-job concurrency serializes the entire reusable worker for both
event and scheduled paths, while worker job permissions make capability absence
inspectable. GitHub warns privileged triggers not to check out untrusted code;
this design performs no checkout anywhere.

**Trade-off:** The publisher must treat even its same-worker artifact as
untrusted and validate it again. GitHub permissions structurally remove write
authority from inspection. The model credential is an environment secret
available only to jobs referencing the model environment; a contract lint also
keeps that environment and secret absent from every write-capable job.

### Per-PR queued serialization owns the per-PR receipt

**Why:** The receipt is one shared mutable comment, so its workflow lock uses the
same PR-level ownership boundary. This prevents a stale revision from writing
after a newer revision.

**Trade-off:** A new head waits behind an obsolete run. Frequent exact-head
checks shorten that wait, and the MVP chooses receipt correctness over parallel
revision throughput.

### Ordinary issue comment as the sole publication surface

**Why:** GitHub treats neutral and skipped check conclusions as successful, so a
check receipt could accidentally become a merge signal. An ordinary issue
comment is distinct from review and check surfaces.

**Trade-off:** MVP findings are `path:line` entries in the receipt, not inline
annotations. Z7M7Y3 adds exact-SHA review comments later.

### Explicit OpenAI adapter behind a narrow provider boundary

**Why:** The Responses API supports strict JSON Schema output and disabling
tools. Native `fetch` avoids adding an SDK dependency for one endpoint.

**Trade-off:** Automatic provider/model selection remains outside #1909.

## Implementation Notes

- Never interpolate PR title/body/ref into generated shell source.
- Never use `actions/checkout`, run package managers, restore untrusted caches,
  or deserialize executable formats in this workflow.
- Prerequisite re-evaluation excludes the advisory workflow itself and binds all
  observations to the exact expected SHA. Tests prove unconfigured, explicitly
  no-required-checks, every check-run and commit-status conclusion, pending exit,
  scheduled re-entry, and head-change exits.
- Provider transport headers and errors never enter the domain result. Before
  serialization, every free-text field is scanned with the same exact-value
  secret redaction boundary used by the sentinel contract test; an encountered
  credential becomes a generic redaction marker and forces `incomplete`.
- Direct-event and scheduled-matrix callers pass the same normalized PR input;
  the reusable worker owns one workflow-level concurrency expression around all
  jobs. Contract tests evaluate distinct inputs to distinct group strings. A
  started queued run rechecks the current head and receipt before any provider
  call. GitHub-cancelled pending runs have no Safeword disposition because their
  steps never ran.
- Test reducer and head-change ordering with injected gates/promises. Validate
  actual GitHub pending-run replacement in the required pre-release disposable-
  repository smoke rather than pretending a local scheduler reproduces it.
- Live `.flux` evaluation is opt-in and cannot gate deterministic CI.

## References

- https://docs.github.com/en/actions/reference/security/secure-use
- https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax
- https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/control-deployments#using-environments-without-deployments
- https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/troubleshooting-required-status-checks
- https://docs.github.com/en/rest/guides/working-with-comments
- https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/control-deployments
- https://platform.openai.com/docs/api-reference/responses
- Draft implementation evidence: `origin/codex/pr-review-technology-neutral`

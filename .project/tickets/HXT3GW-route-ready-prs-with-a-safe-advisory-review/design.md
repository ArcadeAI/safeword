# Design: Route ready PRs with a safe advisory review

**Related:** [spec.md](./spec.md) | [test-definitions.md](./test-definitions.md)

## Architecture

Ship one default-off, schema-managed `pull_request_target` workflow whose jobs
have disjoint capabilities. No job checks out pull-request code. A metadata-only
job first marks any old receipt stale, a read-only inspection job fetches changed
text through GitHub's API and calls the configured model, and a publisher with no
model secret validates a bounded result before updating one ordinary issue
comment. Every new head is fully reviewed; there is no materiality classifier.

```text
ready/synchronize/reopen
        |
        v
invalidate old receipt  [issues:write; no model; no PR artifacts]
        |
        v
inspect exact head       [contents/pulls:read; model secret; no write; no checkout]
        |
        v
strict advisory result   [bounded JSON artifact]
        |
        v
publish current receipt  [issues:write; no model; no checkout; re-check head]
```

Workflow-level per-PR concurrency uses cancellation so a newer head displaces an
older run. Publication still re-reads the PR head and converts a mismatch to
`stale`; concurrency is coordination, not proof of freshness.

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
Unreadable, binary-only, truncated, or over-budget evidence becomes a recorded
unknown and therefore cannot yield `looks_ready`.

The initial OpenAI adapter calls `/v1/responses` with a configured model, no
tools, `store: false`, and strict JSON Schema output. The provider interface is
small enough for later vendors but does not implement vendor selection policy.
The returned route is ignored; the deterministic route core derives it from
validated findings, unknowns, completion, and freshness.

### Component 3: Publication, CLI, and distribution

**What:** Composes explicit CLI stages, validates the serialized handoff, updates
one marker-owned ordinary issue comment, and distributes the workflow/config.

**Where:** `packages/cli/src/commands/review-pr.ts`,
`packages/cli/src/pr-review/publish.ts`,
`packages/cli/templates/workflows/pr-review.yml`, `packages/cli/src/schema.ts`

The public command exposes stage-specific operations used by workflow jobs:

- `review-pr invalidate` reads only PR identity/current SHA and marks an existing
  receipt stale.
- `review-pr inspect` emits the bounded schema-v1 result and never writes GitHub.
- `review-pr publish` accepts only a result file, re-checks the current head, and
  calls only list/create/update issue-comment endpoints.

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
  prerequisitePollSeconds: number;
  prerequisiteTimeoutSeconds: number;
}
```

The API key uses one documented secret name. No secret value appears in config,
artifacts, logs, or receipt output.

## Component Interaction

1. A ready/reopened/synchronized PR starts the base-branch workflow.
2. The invalidator updates only the marker-owned receipt for the prior SHA.
3. Inspection waits for authoritative required prerequisites on the current SHA.
4. Failed/pending-timeout prerequisites publish a conservative terminal result
   without model review; successful prerequisites proceed.
5. Evidence acquisition re-checks the head, reads changed artifacts through the
   API, and invokes the strict provider adapter.
6. The route core creates a bounded result artifact.
7. Publication validates identity/schema, re-fetches the head, downgrades a
   mismatch to stale, and updates the one ordinary comment.

## Key Decisions

### One fully fresh review per SHA

**Why:** It removes the materiality classifier and freshness bridge from the
trust boundary. The later optimization is additive because `reviewedSha` and
`observedHeadSha` are already explicit.

**Trade-off:** More model cost and repeated findings until Z7M7Y3.

### One workflow with job-level capability separation

**Why:** Job permissions make capability absence inspectable while one workflow
keeps artifact handoff and concurrency simple. GitHub warns privileged triggers
not to check out untrusted code; this design performs no checkout anywhere.

**Trade-off:** The publisher must treat even its same-workflow artifact as
untrusted and validate it again.

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
- Prerequisite polling excludes the advisory workflow itself and binds all
  observations to the exact expected SHA.
- Test concurrency and head-change ordering with injected gates/promises, not
  wall-clock races.
- Live `.flux` evaluation is opt-in and cannot gate deterministic CI.

## References

- https://docs.github.com/en/actions/reference/security/secure-use
- https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax
- https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/troubleshooting-required-status-checks
- https://docs.github.com/en/rest/guides/working-with-comments
- https://platform.openai.com/docs/api-reference/responses
- Draft implementation evidence: `origin/codex/pr-review-technology-neutral`

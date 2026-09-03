# Design: OpenCode independent review fallback

**Related:** [Feature spec](./spec.md) | [Test definitions](./test-definitions.md)

## Architecture

Extend the existing host-owned review coordinator rather than creating an
OpenCode-specific review system. The coordinator will ask a route-plan function
for the preferred independent reviewer, the next independent reviewer, and the
same-author degraded reviewer. Every route continues through the existing
packet sealing, deadline, executable trust, mutation detection, and typed result
projection.

OpenCode-specific behavior stays at the process boundary in `review/runtime.ts`:
one-shot `opencode run --format json --pure`, prompt input over stdin, an inline
deny-all permission policy, and a parser that accepts exactly one completed text
event containing the closed review result. OpenCode's current JSON stream and
permission defaults make exit code alone insufficient, so missing, malformed,
or oversized output remains `invalid_output`.

```text
review command
    → resolve author runtime
    → preferred independent reviewer (+ eligible alternate model)
    → next independent reviewer
    → same-author degraded reviewer (policy-controlled)
    → typed result + provenance + packet/source integrity checks
```

## Components

### Component 1: Review route plan

**What:** Return the ordered independent and degraded routes for a recognized author.

**Where:** `packages/cli/src/review/policy.ts`

```typescript
interface ReviewRoutePlan {
  author: ReviewAgent;
  preferred: ReviewAgent;
  independentFallback: ReviewAgent;
  degradedFallback: ReviewAgent;
}

function reviewRoutePlan(author: ReviewAuthor): ReviewRoutePlan | undefined;
```

**Dependencies:** Review-agent types only.

**Tests:** Preferred-pairing, retry, OpenCode fallback, OpenCode-author routing,
unsupported-author, and same-author-independence scenarios.

### Component 2: Headless OpenCode adapter

**What:** Probe, launch, constrain, and parse OpenCode under the shared reviewer contract.

**Where:** `packages/cli/src/review/runtime.ts` and `packages/cli/src/review/environment.ts`

```typescript
function reviewerArguments(
  reviewer: ReviewAgent,
  model?: string,
  schemaPath?: string,
): string[];

function parseReviewerOutput(
  reviewer: ReviewAgent,
  stdout: string,
): UnverifiedReviewerOutput;
```

**Dependencies:** Existing child-process, deadline, output-bound, executable-trust,
and result-schema helpers. No new package.

**Tests:** Complete/malformed/empty/oversized event streams, provenance,
permission environment, process failure, timeout, and mutation scenarios.

### Component 3: Coordinator route execution

**What:** Run the second independent reviewer after the preferred reviewer's
eligible routes fail, before any degraded fallback.

**Where:** `packages/cli/src/review/coordinator.ts`

**Dependencies:** Route plan, packet preparation, runtime adapter, and result projection.

**Tests:** Integration tests through `runReview`, with real config and packet
collaborators and only reviewer subprocesses faked.

### Component 4: Runtime identity

**What:** Recognize `SAFEWORD_AGENT_RUNTIME=opencode` as a first-class author runtime.

**Where:** `packages/cli/templates/hooks/lib/run-identity.ts`

**Dependencies:** Existing shared runtime identity contract.

**Tests:** Runtime normalization and real review-command wiring for OpenCode-authored work.

## Data Model

No persisted data changes. `ReviewAgent`, `ReviewAuthor`, reviewer-output schema,
network-effect targets, and runtime identity gain the literal `opencode`.
Existing result fields remain unchanged. Closed reviewer and review-stamp identity
enums gain `opencode` so validated provenance can be persisted end to end.

## Component Interaction

The command resolves author identity, obtains a route plan, and prepares a fresh
sealed packet for each attempt. The preferred reviewer retains its optional
alternate-model retry. A funded independent fallback then receives a fresh
packet and must return matching reviewer/dispatch provenance. Only after that
route fails may the coordinator call the author's runtime as degraded review.

## User Flow

1. A builder requests the normal Safeword review command.
2. Safeword tries the existing preferred reviewer first.
3. If its eligible attempts fail and budget remains, Safeword announces and runs OpenCode.
4. A valid OpenCode result satisfies either `prefer` or `require` as cross-agent evidence.
5. If OpenCode also fails, Safeword preserves the existing degraded or blocked policy outcome.

For OpenCode-authored work, step 2 uses Claude and step 3 uses Codex. OpenCode
self-review may provide degraded feedback but never independent evidence.

## Key Decisions

- **Ordered route plan:** one explicit route plan replaces pair-only branching.
  This keeps ordering reviewable and prevents ad hoc fallback recursion. Trade-off:
  the coordinator must carry one more route's failure metadata.
- **Native one-shot CLI:** use `opencode run` rather than a server or SDK. It is
  the documented automation entry point and matches existing executable trust
  and process cleanup. Trade-off: JSON-event parsing is OpenCode-specific.
- **Deny-all plus isolated packet:** pass `--pure` and `OPENCODE_PERMISSION="deny"`
  while running in the disposable packet workspace. Trade-off: the reviewer
  cannot use even read tools; all review material must remain in the prompt.
- **Living architecture update:** revise the existing “Host-owned cross-agent
  adversarial review coordinator” decision in place under `ARCHITECTURE.md`'s
  accepted-decision policy. Its “Cursor joins the pairing” reassessment example
  is the closest analogue for adding OpenCode; this fixed additive route does
  not need a separate ADR.

## Implementation Notes

- `opencode run` reads stdin when no positional message is supplied in pinned
  1.18.23; the relevant source lines are unchanged in checked 1.18.25.
- Parse completed `text` events only; ignore diagnostics and non-result events.
- `--pure` disables external plugins; the filtered environment supplies only
  OpenCode authentication/config variables needed by the chosen provider plus
  fixed Safeword permission controls.
- Preserve terminal failures and the single shared deadline: a terminal route
  failure or unfundable next route reports exhaustion instead of silently
  starting more work.
- OpenCode gets one independent attempt. Safeword does not choose its provider
  model, so it neither retries nor claims an alternate OpenCode model.
- Record an OpenCode model tag only when the runtime emits a verifiable value;
  an absent model is valid for cross-agent review but fails opt-in
  `crossModelReview` closed.
- No TypeScript-specific skill pack is installed; repository Vitest conventions
  and the shared testing skill govern implementation.

## References

- OpenCode 1.18.23 CLI: https://github.com/anomalyco/opencode/blob/v1.18.23/packages/web/src/content/docs/cli.mdx
- OpenCode 1.18.23 permissions: https://github.com/anomalyco/opencode/blob/v1.18.23/packages/web/src/content/docs/permissions.mdx
- OpenCode 1.18.23 run source: https://github.com/anomalyco/opencode/blob/v1.18.23/packages/opencode/src/cli/cmd/run.ts
- OpenCode MIT license: https://github.com/anomalyco/opencode/blob/v1.18.23/LICENSE
- Existing decision: `ARCHITECTURE.md` → “Host-owned cross-agent adversarial review coordinator”

## Open Questions

None.

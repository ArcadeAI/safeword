# Spec: Prove cross-provider review before scaling spend

## Intent

Prove that the paid benchmark can genuinely use OpenAI GPT-5.6 Terra for review before scaling spend. The old corpus is intentionally diagnostic and its legacy author provenance is preserved rather than relabeled: success means the machinery and output are trustworthy enough for the next development checkpoint, not that reviewer quality or the future Claude-author/Terra-review design is confirmed.

## Intake Brief

- **Requested by:** Repository owner directing the #1910 evaluation.
- **Cost of inaction:** More paid runs could falsely claim cross-provider review while the repository-reading loop still calls Anthropic, wasting money and invalidating evidence.
- **Reversibility:** The code and development outputs are a two-way door and remain non-confirmatory. The live proof also creates a bounded permanent public authorization/accounting trail and annotated adapter and harness tags so later audits can reproduce what was paid for; those durable evidence anchors are intentionally not reversible.

## References

- [CWGYH0 benchmark recovery](../CWGYH0-pr-review-eval/ticket.md)
- [GPT-5.6 Terra model](https://developers.openai.com/api/docs/models/gpt-5.6-terra)
- [OpenAI API pricing](https://developers.openai.com/api/docs/pricing)

## Personas

- Safeword Maintainer (SWM)

## Surfaces

Affected:

- Internal PR-review evaluation harness — `skip: ticket-local research surface, not reusable product runtime`
- GitHub Actions Execution Sandbox — `skip: the private pinned-adapter qualification remains an explicit manual proof and installs no product workflow or release gate`

Unaffected:

- Safeword CLI and installed agent workflows — no published behavior changes.

## Vocabulary

- **Review attempt:** One execution of a buggy/fixed benchmark work item. Any infrastructure retry is another attempt even though each attempt may contain multiple provider turns.
- **Provider turn:** Any paid model request made while executing a review attempt, including repository-reading and finding-verification turns. Every turn in this development canary must use the frozen Terra route.
- **Observed cost stop:** A post-attempt stop. The completed attempt that crosses the amount is retained and reported; the next attempt is blocked.
- **Context pricing tier:** Each provider turn selects its own tier from retained total `input_tokens`, calculated as uncached plus cached plus cache-write tokens: short-context through 272,000 and long-context above 272,000. Frozen standard rates per million tokens are short-context `$2.50` uncached input, `$0.25` cached input, `$3.125` cache-write input, and `$15.00` total output; long-context rates are `$5.00`, `$0.50`, `$6.25`, and `$22.50` respectively. Retained `output_tokens` already includes reasoning tokens and is charged once. Attempt cost sums every retained turn cost exactly once. Cache-write usage is read only from the OpenAI-native detailed-usage field; an absent field normalizes to zero, while Anthropic-shaped usage makes the route invalid.
- **Cost arithmetic:** Every component and cumulative total is represented as an integer number of picodollars (one trillionth of a US dollar). All frozen per-token rates convert exactly to integer picodollars, and equality or at-or-above `$15` compares those integers, never binary floating point.
- **Diagnostic-only:** Evidence that may validate execution mechanics but cannot produce confirmatory estimates or unlock confirmatory spend.
- **Decision reason:** `eligible` only when every applicable pre-call guard passes; otherwise the complete deterministic set of `attempt-stop`, `cost-stop`, `incomplete-attempt-accounting`, `incomplete-cost-accounting`, `missing-authorization`, and `dispatch-contention` reasons is reported. Every feature phrase `with reason`, `with reasons`, or `reports` means that exact exhaustive set. A limit's stop reason is evaluated only when that limit's durable accounting is complete; incomplete accounting reports its own reason and fails closed. A paid request without prior durable intent is incomplete attempt accounting. Durable intent followed by a provider request without a durable completion/cost record is incomplete cost accounting. A concurrent process that loses the exclusive dispatch lock reports `dispatch-contention`.
- **Attempt ledger consistency:** The stored started-attempt count equals the number of unique durable intent records and matching immutable upstream start receipts; intent identifiers and sequence numbers cannot repeat and each retained provider request references exactly one earlier intent. Local and upstream heads must agree before dispatch.
- **Rejection scenario:** `@rejection` marks malformed or untrustworthy evidence. Reaching an ordinary attempt or cost boundary is expected control flow and is not tagged as rejection.
- **Trusted corpus anchor:** Corpus role is resolved from the independently trusted registration keyed by a digest recomputed from the corpus content actually reviewed, never from an artifact-supplied digest, path, or mutable local role/anchor fields. Missing, foreign, or self-issued anchors fail closed.
- **Provenance field:** Every retained result has `corpus_author_provenance` copied exactly from the trusted registration; the legacy development registration is never rewritten as Claude-authored.
- **Execution mode:** The local attempt and cost journals are ticket-scoped and survive process/run restarts, while immutable upstream start/completion receipts provide the monotonic head that local deletion cannot reset. `same process` means another decision without a restart; `resumed process` reloads and reconciles both channels after a restart. Explicit initialization is allowed only by an unused one-time authorization in the trusted upstream registration; it consumes that authorization upstream and creates both zero journals plus a matching local marker before any paid execution. Before each attempt, the parent posts and verifies one sequenced upstream start receipt before writing local intent and dispatching. After the attempt, it posts and verifies one completion receipt bound to the raw-response digest and exact aggregate native usage/cost. A start without a completion is incomplete cost accounting; a local/upstream mismatch is incomplete attempt and/or cost accounting. Once consumed, no local deletion, planting, forgery, mismatch, or partial state can reauthorize initialization or reduce the upstream head. Live execution is single-writer. A durable lock rejects concurrent dispatch; the contention proof exercises that guard without making a live provider request.
- **Live authorization:** The explicit authorization is not a local boolean. It is the unique unedited allowlisted-maintainer upstream authorization plus its unique initialization, per-attempt start, and per-attempt completion receipts and matching immutable local marker, all bound to the canonical repository, recomputed corpus digest and registration, annotated adapter and harness tags and commits, GPT-5.6 Terra/default route, ten-attempt cap, $15 stop, and one output identity. Missing, edited, duplicated, stale, replayed-to-another-output or repository, or mismatched evidence reports `missing-authorization` and cannot dispatch. The authorization permits at most one initialization receipt and ten start/completion receipt pairs for that output identity.
- **Route-invalid cost:** Native standard-tier Terra usage remains priceable with the frozen table even if another evidence defect invalidates the route. Non-Terra, non-standard-tier, or non-native usage is retained but makes cost accounting incomplete; the harness never invents a price and starts no later attempt.
- **Paid canary execution:** `@paid-canary` is excluded from default and CI test selection. It runs only after explicit maintainer authorization from clean checkouts of the authorized harness and adapter commits, with SDK/HTTP automatic retries disabled. It records and verifies the upstream start receipt and local intent before its first request, and any retry is a new controller-owned attempt. It cannot be rerun once the durable attempt or cost guards block it. Every non-`@paid-canary` scenario uses isolated fixtures, issues no provider request, and cannot mutate the real canary ledger; authorization-guard scenarios may evaluate that pure pre-dispatch guard without dispatching.
- **Fixture authorization:** The live authorization guard is categorically inapplicable to non-authorization fixture scenarios because they cannot dispatch. It is evaluated only by the live paid canary and the acceptance scenario explicitly covering weak or replayed authorization.

## Jobs To Be Done

### prove-cross-provider-review-before-scaling-spend.SWM1 — Trust the first cross-provider checkpoint

**Persona:** Safeword Maintainer (SWM)

> When I am about to scale a paid reviewer benchmark, I want a bounded development checkpoint to preserve what is actually known about corpus authorship, prove which provider reviewed each example, and account for every attempt, so I can stop before wasting money or mistaking broken machinery for model quality.

#### prove-cross-provider-review-before-scaling-spend.SWM1.R1 — The recorded provider identity matches the provider that performed every paid turn

#### prove-cross-provider-review-before-scaling-spend.SWM1.R2 — Durable attempt and cost evidence bounds every new paid attempt

#### prove-cross-provider-review-before-scaling-spend.SWM1.R3 — Development evidence remains permanently separate from confirmatory evidence

## Rave Moment

skip: internal research plumbing; the value is trustworthy evidence, not a persona-facing delight moment.

## Outcomes

- A raw-response audit can prove Terra performed every paid provider turn without making an unsupported claim about who authored the old corpus.
- Any paid route-invalid attempt still consumes the durable ten-attempt cap.
- Priceable native Terra usage from a route-invalid attempt still contributes to observed spend; foreign or non-native usage makes cost accounting incomplete and blocks later spend.
- Resume cannot start attempt eleven, start at or above $15, or continue with incomplete cost evidence.
- A completed attempt that reaches or crosses the cost stop is retained and reported without another call.
- No development artifact can pass a confirmatory guard.

## Open Questions

None.

# Spec: Always return the best available review

## Intent

Review should degrade in assurance, not disappear. Safe Word already coordinates
bounded headless reviewers, but an environment such as Claude Code Cloud may
have no opposite-agent CLI. This feature adds a capability-driven ladder above
the existing coordinator so the main agent always receives review findings
while the result remains honest about independence.

## References

- `reliable-reviews-for-real-packets` (DR6M6N) — existing typed headless
  coordinator, reused unchanged.
- PR #2003 — delivery branch for the coordinator and this follow-on behavior.

## Personas

- Technical Builder (TBU) — wants the strongest available review without a
  missing tool stopping useful feedback.
- Non-Technical Builder (NTB) — needs the assurance level and policy outcome in
  plain language because they cannot audit the diff themselves.

## Surfaces

Affected:

- Claude Code
- Claude Code Cloud
- OpenAI Codex
- OpenAI Codex Cloud
- Cursor
- Cursor Cloud Agents

## Jobs To Be Done

### review-with-the-best-available-agent.TBU1 — Attempt the strongest available review route

**Persona:** Technical Builder (TBU)

> When I ask for a review, I want Safe Word to attempt the strongest reviewer
> the current environment can provide and continue through supported fallbacks,
> so missing local tools do not end the review workflow without useful feedback.

#### review-with-the-best-available-agent.TBU1.R1 — Every available independent reviewer is preferred over every degraded route

#### review-with-the-best-available-agent.TBU1.R2 — After independent routes are exhausted, same-agent headless review is preferred because its process and result boundary are enforceable

#### review-with-the-best-available-agent.TBU1.R3 — Without a usable headless reviewer, a host-native fresh-context reviewer provides a degraded review, including in a single-agent cloud environment

#### review-with-the-best-available-agent.TBU1.R4 — When no delegated reviewer can complete, the main thread returns one valid bounded self-review or preserves exhaustion

#### review-with-the-best-available-agent.TBU1.R5 — Shipped host contracts frame repository text as untrusted data and omit diagnostics and secrets

#### review-with-the-best-available-agent.TBU1.R6 — Only typed route exhaustion enters the host-owned degraded ladder

### review-with-the-best-available-agent.NTB1 — Know what assurance the completed review provides

**Persona:** Non-Technical Builder (NTB)

> When Safe Word falls back to another kind of review, I want the result to say
> how trustworthy it is and whether my policy was satisfied, so I can act on the
> findings without confusing any review with an independent one.

#### review-with-the-best-available-agent.NTB1.R1 — Every completed review explains its assurance level in plain language

#### review-with-the-best-available-agent.NTB1.R2 — Degraded findings may complete `prefer`, but only an independent reviewer satisfies `require`

#### review-with-the-best-available-agent.NTB1.R3 — A degraded review preserves whether the reviewer approved or requested changes

## Outcomes

- Local sessions use every compatible opposite reviewer before degradation.
- Same-agent headless review precedes host-native delegation.
- Claude Code Cloud can use a fresh-context Claude reviewer without an external
  agent CLI.
- Complete delegation failure still produces one structured main-thread review.
- Completed reviewer verdicts, source-mutation failures, and required-policy
  failures retain their coordinator outcome instead of being converted into
  degraded success. Individual reviewer process, timeout, authentication, and
  invalid-output failures remain route failures; after all CLI routes fail, the
  coordinator converts them to `REVIEW_ROUTES_EXHAUSTED`.
- Every result distinguishes independent, separate-process degraded,
  fresh-context degraded, and self-review assurance.
- `require` remains fail-closed without discarding useful degraded findings.
- An independent review satisfies `require`; a degraded review does not.
- A degraded `changes_requested` verdict returns findings and remains action
  required instead of being converted into approval.
- Host fallback is best-effort and additive: its assurance preserves the
  exhaustion disclosure and unsatisfied independence verdict where applicable,
  and host findings never create independent evidence.

## Constraints

- Reuse the existing coordinator and its typed `REVIEW_ROUTES_EXHAUSTED` result;
  do not duplicate packet, timeout, schema, provenance, or process logic.
- The CLI coordinator owns opposite-agent, alternate-model, and same-agent
  headless routes. The host fallback owns only fresh-context in-session review
  and main-thread self-review after typed exhaustion.
- Under `require`, completed same-agent headless findings produce
  `REVIEW_INDEPENDENCE_REQUIRED` and do not enter host fallback. When every CLI
  route fails without findings, the coordinator produces
  `REVIEW_ROUTES_EXHAUSTED`; host fallback may return findings while preserving
  the unsatisfied independence verdict.
- A fallback advances once and never starts the coordinator or ladder again.
- Invalid terminal self-review output is discarded and the original typed
  exhaustion result is returned unchanged; there is no recursive fallback.
- Shipped host contracts frame the accepted packet and fixed rubric as untrusted
  review inputs, not host instructions. They omit failed-route raw output and
  credentials; the model-mediated containment limit is disclosed.
- The repository-owned reviewer contract and agent definition are
  branch-controlled control-plane instructions outside the accepted packet.
  Their hostile-material rule is model-mediated, not a structural sandbox, and
  a review cannot independently validate its own rubric when either file is an
  accepted target.
- The portable coordinator skill retains `allowed-tools: '*'` because host
  agent-tool names differ. Claude's named reviewer has a structural read-only
  tool list; Cursor tool denial and generic Codex subagent no-write behavior are
  instructional rather than structurally verified.
- Host-mandated project context may load in a fresh reviewer, so fresh-context
  assurance always discloses that possibility rather than claiming packet-only
  isolation. Host reviewers read accepted paths from the live worktree, so the
  assurance also says source integrity was not revalidated.
- "Bounded" means one attempt per degraded route with no recursion. A host
  timeout while waiting for the fresh-context reviewer is an invocation failure
  and advances once to terminal self-review. The terminal pass is the foreground
  agent itself, so its lifetime is governed by the host session rather than a
  second in-workflow timer.
- Claude Code Cloud is the specified host-native cloud case. Codex and Cursor cloud
  use a host-native reviewer only when that capability is present; otherwise the
  ladder reaches bounded main-thread self-review.
- There is no separate off switch after a requested review reaches typed route
  exhaustion. The existing `crossAgentReview: off` power-user override prevents
  the coordinator from starting and therefore cannot produce route exhaustion;
  it remains authoritative. Once the coordinator does return
  `REVIEW_ROUTES_EXHAUSTED`, `require` controls whether degraded findings satisfy
  policy, not whether the bounded fallback attempts to acquire them.

## Rave Moment

skip: table-stakes — the value is that review remains available and honest when
the preferred tooling is absent.

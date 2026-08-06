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
- Safeword CLI

## Jobs To Be Done

### review-with-the-best-available-agent.TBU1 — Always obtain the strongest available review

**Persona:** Technical Builder (TBU)

> When I ask for a review, I want Safe Word to use the strongest reviewer the
> current environment can provide and keep falling back until I receive useful
> findings, so missing local tools never leave the main agent without a review.

#### review-with-the-best-available-agent.TBU1.R1 — Every available independent reviewer is preferred over every degraded route

#### review-with-the-best-available-agent.TBU1.R2 — After independent routes are exhausted, same-agent headless review is preferred because its process and result boundary are enforceable

#### review-with-the-best-available-agent.TBU1.R3 — Without a usable headless reviewer, a host-native fresh-context reviewer provides a degraded review, including in a single-agent cloud environment

#### review-with-the-best-available-agent.TBU1.R4 — When no delegated reviewer can complete, the main thread performs one bounded structured self-review

#### review-with-the-best-available-agent.TBU1.R5 — Review material stays data: diagnostics, secrets, and repository text never become reviewer instructions

### review-with-the-best-available-agent.NTB1 — Know what assurance the completed review provides

**Persona:** Non-Technical Builder (NTB)

> When Safe Word falls back to another kind of review, I want the result to say
> how trustworthy it is and whether my policy was satisfied, so I can act on the
> findings without confusing any review with an independent one.

#### review-with-the-best-available-agent.NTB1.R1 — Every completed review explains its assurance level in plain language

#### review-with-the-best-available-agent.NTB1.R2 — Degraded findings may complete `prefer`, but only an independent reviewer satisfies `require`

## Outcomes

- Local sessions use every compatible opposite reviewer before degradation.
- Same-agent headless review precedes host-native delegation.
- Claude Code Cloud can use a fresh-context Claude reviewer without an external
  agent CLI.
- Complete delegation failure still produces one structured main-thread review.
- Every result distinguishes independent, separate-process degraded,
  fresh-context degraded, and self-review assurance.
- `require` remains fail-closed without discarding useful degraded findings.
- An independent review satisfies `require`; a degraded review does not.

## Constraints

- Reuse the existing coordinator and its typed `REVIEW_ROUTES_EXHAUSTED` result;
  do not duplicate packet, timeout, schema, provenance, or process logic.
- A fallback advances once and never starts the coordinator or ladder again.
- The accepted packet and fixed rubric are untrusted review inputs, never host
  instructions. Failed-route raw output and credentials are not forwarded.
- Host-mandated project context may load in a fresh reviewer and must be
  disclosed rather than described as packet-only isolation.
- Claude Code Cloud is the proved host-native cloud case. Codex and Cursor cloud
  use a host-native reviewer only when that capability is present; otherwise the
  ladder reaches bounded main-thread self-review.

## Rave Moment

skip: table-stakes — the value is that review remains available and honest when
the preferred tooling is absent.

# Spec: Keep independent reviews reliable for real ticket packets

## Intent

Cross-agent review already works on toy inputs and fails closed on real ones. A
one-file packet completes; a five-file ticket packet is killed at a fixed
120-second deadline, and the Codex fallback that should have covered for it is
rejected because Safe Word never tells Codex what shape the result must take.
This feature makes the coordinator survive realistic bounded packets, hands the
fallback reviewer the exact result contract, and — when nothing works — says why
in language a non-coder can act on.

## Intake Brief

- **Requested by:** Safe Word maintainer, from issue #1922 (observed while
  quality-reviewing local ticket `ZE5RRG`; investigation recorded as `ZDK1VW`).
- **Cost of inaction:** the flagship independence guarantee is unusable on real
  ticket-sized work. Every realistic quality review reports "no independent
  check ran," so builders learn to skip or disable the gate — which silently
  removes the one control an NTB has over an agent's own self-assessment.
- **Reversibility:** two-way door. All changes sit behind an existing internal
  runtime boundary (`packages/cli/src/review/`); the public result envelope
  gains explanatory text but no removed or renamed fields.

## References

- Issue [#1922](https://github.com/ArcadeAI/safeword/issues/1922)
- Prior feature: `QZAFT2-cross-agent-adversarial-reviews` (the coordinator this
  feature hardens), `packages/cli/features/cross-agent-adversarial-reviews.feature`
- Empirically confirmed during intake: Codex 0.146.0 accepts
  `--output-schema <FILE>` for the exact review contract and returns output that
  the existing strict parser accepts unchanged.

## Personas

- Technical Builder (TBU) — runs the review and reads the diff.
- Non-Technical Builder (NTB) — cannot audit the diff, so the independent review
  is their only assurance; a failed review must be explained, not logged.
- Safeword Maintainer (SWM) — owns the reviewer runtime boundary.

## Surfaces

Affected:

- Claude Code — the preferred reviewer route and a fallback author runtime.
- OpenAI Codex — the fallback reviewer whose typed-output boundary is unwired.

Unaffected:

- Cursor — never selected as a reviewer runtime (unchanged out-of-scope routing).
- Claude Code Cloud — same coordinator code path; no cloud-specific behavior
  changes, and reviewer installation/authentication stays out of scope.

## Vocabulary

- **Review packet** — the bounded, read-only set of logical files handed to a
  reviewer for one dispatch.
- **Review budget** — the total wall-clock time a review dispatch may take
  before it is stopped and classified as a timeout.
- **Candidate** — one executable on `PATH` that might be a usable reviewer CLI.
- **Result contract** — the exact JSON shape a reviewer result must have:
  fixed fields, and severities limited to `info` / `warning` / `error`.

## Jobs To Be Done

### reliable-reviews-for-real-packets.TBU1 — Get a real ticket-sized review to finish

**Persona:** Technical Builder (TBU)

> When I ask for an independent review of a real ticket's worth of changes, I
> want the review to be given enough time to finish, so I can get an actual
> verdict instead of a timeout on work that was only ever slow, not stuck.

#### reliable-reviews-for-real-packets.TBU1.R1 — A review's time budget scales with the size of the packet it must read, up to a documented maximum

#### reliable-reviews-for-real-packets.TBU1.R2 — A reviewer that never finishes is still stopped inside that maximum and reported as a timeout

#### reliable-reviews-for-real-packets.TBU1.R3 — One slow or stale reviewer executable cannot consume every other installed candidate's opportunity

### reliable-reviews-for-real-packets.TBU2 — Trust the fallback reviewer to return a usable result

**Persona:** Technical Builder (TBU)

> When the preferred reviewer is unavailable, I want the fallback reviewer to be
> told exactly what a valid result looks like, so its honest review isn't thrown
> away over a formatting mismatch nobody told it about.

#### reliable-reviews-for-real-packets.TBU2.R1 — A reviewer that supports typed output is given the exact result contract the check will enforce

#### reliable-reviews-for-real-packets.TBU2.R2 — A reviewer executable that cannot honor the result contract is skipped rather than tried and rejected

#### reliable-reviews-for-real-packets.TBU2.R3 — A result that violates the contract is still rejected, whatever produced it

### reliable-reviews-for-real-packets.TBU3 — Keep a real second opinion when the first checker can't finish

**Persona:** Technical Builder (TBU)

> When the reviewer agent can't complete my review at all, I want one more
> attempt at a genuinely independent check before Safe Word settles for the
> author reviewing its own work, so a slow or unavailable model doesn't quietly
> cost me the second opinion entirely.

#### reliable-reviews-for-real-packets.TBU3.R1 — An exhausted reviewer agent is retried on a configured alternate model before the author's own runtime is used

#### reliable-reviews-for-real-packets.TBU3.R2 — A review completed by the reviewer agent on its alternate model is still a full cross-agent check, and the result names the model that actually reviewed

#### reliable-reviews-for-real-packets.TBU3.R3 — With no alternate model configured, routing is exactly what it is today, and Safe Word never supplies a model name of its own

#### reliable-reviews-for-real-packets.TBU3.R4 — Each attempted route gets its own bounded budget, so an exhausted first attempt cannot leave the retry with no time to run

### reliable-reviews-for-real-packets.NTB1 — Understand why no independent check happened

**Persona:** Non-Technical Builder (NTB)

> When every review route fails, I want each route's failure explained in plain
> language with one thing to do next, so I know whether to retry, fix something,
> or stop trusting this run's result.

#### reliable-reviews-for-real-packets.NTB1.R1 — When both routes fail, the explanation names each route's own cause, not one generic failure

#### reliable-reviews-for-real-packets.NTB1.R2 — An explanation never carries raw reviewer output, diagnostic noise, or credentials

#### reliable-reviews-for-real-packets.NTB1.R3 — A review that ran but was not independent still never satisfies a required cross-agent check

## Rave Moment

skip: table-stakes — this restores a guarantee the previous feature already
promised; finishing a review that used to time out is relief, not awe.

## Outcomes

- A representative five-file, ~58 KB packet whose reviewer answers near 111
  seconds returns a verdict instead of a timeout.
- A reviewer that never answers is killed inside a documented bounded maximum
  and still classified as a timeout.
- With two installed candidates, a slow first one leaves the second a real
  chance to run.
- Codex is invoked with the exact result contract and its conforming output is
  accepted without loosening allowed fields or severities.
- When the reviewer agent is exhausted and an alternate model is configured, the
  retry runs on that model and still reports a full cross-agent check.
- With no alternate model configured, routing and output are unchanged.
- An exhausted-route message names both causes — for example, "the preferred
  reviewer ran out of time" and "the fallback reviewer's answer wasn't in the
  required format" — and exposes nothing else.

## Open Questions

None — the deadline model, per-candidate allocation, and schema delivery
mechanism are builder-choice details settled in plan-implementation.

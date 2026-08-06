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
  reviewer for one dispatch. It is **accepted** only while its file contents stay
  within the existing 1 MiB limit — an unchanged bound. Size plays no part in the
  deadline.
- **Attempt deadline** — the wall-clock time a single review attempt may take
  before it is stopped and classified as a timeout: **300 seconds**, flat, for
  every packet. Field evidence sets it: across 91 real review runs, successful
  reviews completed in 47 seconds at the median and 75 at the slowest, so 300
  is four times the observed ceiling. Packet size is deliberately not an input —
  duration tracks how much the reviewer writes, not how much it reads.
- **Probe budget** — the time a single capability check on one candidate may
  take: **5 seconds**, drawn from that candidate's own share. Whatever a
  skipped or failed candidate leaves unused returns to the route, so the next
  candidate's share is recalculated from the time that actually remains.
- **Cleanup budget** — the time allowed to stop a reviewer and its descendants
  after an attempt ends: on POSIX, **250 milliseconds** after `SIGTERM` and up to
  another **250 milliseconds** after `SIGKILL`; on Windows, **1 second** for
  `taskkill`. The run then continues regardless. Reviewers are launched in their
  own process group so descendants are included.
- **Run bound** — **540 seconds**, and never more: the point after which no reviewer work is
  started or allowed to continue. The number comes from the caller, not from
  route arithmetic — every invocation is an agent running the command through a
  tool whose hard ceiling is 600 seconds, so a run that could outlast that would
  be killed mid-flight with nothing to show. Valid output received when the
  reviewer exits before the bound is still checked; output received during
  cleanup is late and cannot change the result.

  Stated precisely: this is an absolute deadline shared by **reviewer work** and
  starts after packet preparation. Capability probes, contract-file handling,
  and earlier cleanups consume its remaining time; they do not extend every
  route's allowance. Synchronous integrity checks and packet cleanup are not
  interrupted by the deadline, and one process-tree cleanup already in progress
  may finish after it — up to 50 ms on POSIX or 1 second on Windows. At the
  largest legal packet (64 files, 1 MiB), measured preparation and integrity
  overhead was 18 ms per route. That measurement supports the 60-second reserve
  below the caller's ceiling, but is not presented as a hard filesystem-latency
  bound or a whole-command deadline.
- **Route** — one independent way of getting a review: the reviewer agent on its
  default model, the reviewer agent on its configured alternate model, and last
  the author's own runtime. Each route gets its own attempt budget.
- **Candidate** — one executable on `PATH` that might be a usable reviewer CLI.
- **Candidate share** — a route's remaining deadline divided by the candidates
  it has not yet tried, recalculated before each one. A candidate that fails
  fast returns its unused time to the route, so later candidates get more, not
  less. A share covers that candidate's capability probe, its launch, and its
  review attempt; cleanup sits outside it and is bounded separately. The
  120-second floor applies to starting a whole **route**, not to a share within
  one — a route with several candidates deliberately gives each a smaller slice
  rather than letting the first consume them all.
- **Model name grammar** — an accepted alternate model value is 1 to 200
  characters drawn only from ASCII letters, digits, `.`, `_`, `:`, `/`, and `-`,
  and does not begin with `-`. That covers real model identifiers
  (`claude-sonnet-4-5-20250929`, `gpt-5-codex`, `vendor/model:tag`) while
  excluding whitespace, control characters, shell metacharacters, and
  option-like values. Anything else is treated as no model configured. The value
  is passed as its own argument and never through a shell, so the grammar is a
  second line of defence rather than the only one.
- **Result contract** — the exact JSON shape a **reviewer answer** must have:
  six fixed fields, and severities limited to `info` / `warning` / `error`.
- **Reviewer answer** — what a reviewer returns; bound by the result contract.
- **Review result** — Safe Word's own reported envelope. It wraps the reviewer
  answer with routing facts Safe Word itself knows — which agent reviewed, on
  which model, how independent the check was. Routing facts live here precisely
  so the reviewer answer contract stays closed.

## Jobs To Be Done

### reliable-reviews-for-real-packets.TBU1 — Get a real ticket-sized review to finish

**Persona:** Technical Builder (TBU)

> When I ask for an independent review of a real ticket's worth of changes, I
> want the review to be given enough time to finish, so I can get an actual
> verdict instead of a timeout on work that was only ever slow, not stuck.

#### reliable-reviews-for-real-packets.TBU1.R1 — Every review attempt gets the same documented deadline, set well above the slowest review anyone has observed

#### reliable-reviews-for-real-packets.TBU1.R2 — A reviewer that never finishes is still stopped at its deadline and reported as a timeout

#### reliable-reviews-for-real-packets.TBU1.R3 — A route's budget is split across its untried candidates, so one slow or stale executable cannot consume every other candidate's opportunity

#### reliable-reviews-for-real-packets.TBU1.R4 — However a reviewer ends, Safe Word stops it and the descendants its platform lets it reach, never waits on what the system will not kill, never claims to have stopped what escaped, and never uses a late answer

### reliable-reviews-for-real-packets.TBU2 — Trust the fallback reviewer to return a usable result

**Persona:** Technical Builder (TBU)

> When the preferred reviewer is unavailable, I want the fallback reviewer to be
> told exactly what a valid result looks like, so its honest review isn't thrown
> away over a formatting mismatch nobody told it about.

#### reliable-reviews-for-real-packets.TBU2.R1 — A reviewer that supports typed output is given the exact result contract the check will enforce

#### reliable-reviews-for-real-packets.TBU2.R2 — A reviewer executable that cannot honour the result contract never costs a later candidate its turn — skipped before launch when that is knowable, failed fast when it is not

#### reliable-reviews-for-real-packets.TBU2.R3 — A result that violates the contract is still rejected, whatever produced it

### reliable-reviews-for-real-packets.TBU3 — Keep a real second opinion when the first checker can't finish

**Persona:** Technical Builder (TBU)

> When the reviewer agent can't complete my review at all, I want one more
> attempt at a genuinely independent check before Safe Word settles for the
> author reviewing its own work, so a slow or unavailable model doesn't quietly
> cost me the second opinion entirely.

#### reliable-reviews-for-real-packets.TBU3.R1 — An exhausted reviewer agent is retried on a configured alternate model before the author's own runtime is used

#### reliable-reviews-for-real-packets.TBU3.R2 — A review completed by the reviewer agent on its alternate model is still a full cross-agent check, and Safe Word's own review result names the model that reviewed without widening the reviewer answer contract

#### reliable-reviews-for-real-packets.TBU3.R3 — With no alternate model configured, routing is exactly what it is today, and Safe Word never supplies a model name of its own

#### reliable-reviews-for-real-packets.TBU3.R4 — Each attempted route gets its own attempt budget, so an exhausted first route cannot leave the retry with no time to run

#### reliable-reviews-for-real-packets.TBU3.R5 — Every route is tried in a fixed order; the run bound stops any route whose reviewer has not exited with valid output before its deadline

#### reliable-reviews-for-real-packets.TBU3.R6 — The public review command carries all of this end to end, and the required-review policy decides on what it reports

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

## Constraints carried into implementation

Raised by the independent scenario review as test-design requirements rather
than behaviours. They bind the proofs, not the spec, so they are recorded here
and honoured in plan-implementation:

- Deadline arithmetic (attempt budget, candidate share, and run bound) is proved
  as pure values at its boundaries. Process effects use shortened configured
  deadlines against real child processes, poll for the observable outcome, and
  make no production-duration claim from elapsed test time.
- Process-liveness assertions use stable process-group handles, not raw PIDs,
  so PID reuse cannot make a leak look clean.
- The size fixture asserts exact byte counts against the same serialized packet
  the reviewer is sent, not a separately computed size.

## Open Questions

None — the deadline model, per-candidate allocation, and schema delivery
mechanism are builder-choice details settled in plan-implementation.

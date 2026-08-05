# Impl Plan: Keep independent reviews reliable for real ticket packets

**Status:** implemented

## Approach

**Riskiest assumption:** that asking the *same reviewer agent* to review again on
a different model still counts as a genuinely independent check — and may
therefore satisfy `crossAgentReview: require`. Everything else here is plumbing;
this one changes what "independent" means. If it is wrong, the alternate-model
route must be labelled degraded like the author fallback, and slices 5–7 change
shape.

**Cheapest proof:** slice 1 runs the whole path for real in one authoring
direction — a configured model is read, validated, passed as an actual argument
to a fake reviewer that honours it, and the public command reports
`independence: cross-agent` with the `require` policy accepting it. Thin on
every axis except depth, so the assumption is proved by the production path
rather than by a fixture that manufactures routing metadata. If the answer is
wrong, it is wrong on slice 1, before any timing work exists.

Slice 8 then widens that same vertical test to the other authoring direction and
to the capabilities added in between; it does not introduce the wiring for the
first time.

### What independence means here, and what it does not

The previous framing was circular — it proved the coordinator labels a route
cross-agent and that policy trusts the label. So state the invariant and its
trust inputs plainly:

**Invariant.** A check is independent when the *reviewer runtime is not the
author runtime*. Nothing else is claimed.

**Trust inputs.** Independence is derived, not asserted: from which executable
was actually invoked, and from the reviewer's own `reviewer_agent` field
verified against the assigned reviewer by the existing provenance check. The
coordinator's `independence` value is an *output* of that derivation. Tests
assert against the derived provenance and the invoked executable — never against
the label the coordinator wrote.

**What this does not establish.** It does not establish that the alternate model
is as capable as the author's. `PRINCIPLES.md`'s review tier says a judgment
reviewer should be *never weaker* than the author, and this design cannot
enforce that: Z4Q24Q settled that "no weaker" cannot be checked provider-neutrally
without a hardcoded model-tier table, so the gate enforces *different* only.
Choosing a sensibly-capable alternate model stays the builder's call. That is a
real limit, not an oversight — it is recorded in Known deviations and documented
at the configuration key, where the builder making the choice will see it.

### Proof plan

| Scenario group | Owner | Primary proof | Why that scope | Supporting proof |
| --- | --- | --- | --- | --- |
| TBU3.R1–R2 alternate-model route, independence | `coordinator.ts` | integration | asserted against derived provenance and the invoked executable, never the coordinator label | unit on route ordering |
| TBU3.R3 no model configured, grammar | `policy.ts` | unit | pure config parsing | integration that no model argument is passed |
| TBU3.R4–R5 per-route budgets, ordering, run bound | `runtime.ts` | integration | needs real spawn + controlled clock | unit on budget arithmetic |
| TBU3.R6 public command end to end | CLI entry | E2E via `runCli` | the entry point is the thing under test | begins at slice 1 in one direction, widened at slice 8 |
| TBU1.R1 attempt deadline | `runtime.ts` | unit | pure function of configuration, no packet input | boundary units for the clamp and for meaningless values |
| TBU1.R2 stop on expiry | `runtime.ts` | integration | requires a real child process | — |
| TBU1.R3 candidate shares | `runtime.ts` | integration | allocation is observable only across spawns | unit on share arithmetic |
| TBU1.R4 cleanup, late answers | supervisor | integration | stop effects are OS behaviour | virtual-clock unit for the cleanup deadline; platform-gated OS test for stop effects |
| TBU2.R1 contract delivery | `runtime.ts` | unit | schema is a value | integration asserting `--output-schema` is passed |
| TBU2.R2 capability gating | adapter | integration | probe is a subprocess | unit per capability state |
| TBU2.R3 contract rejection | `parseReviewerOutput` | unit | pure validation | — |
| NTB1.R1–R3 explanations, policy | `coordinator.ts` | integration | message assembly + policy together | E2E for the human-readable rendering |

Surface coverage: **Claude Code** and **OpenAI Codex** are both proved by the
`TBU3.R6` E2E outline, which runs both authoring directions through the public
command. No per-surface skip is needed.

### Test-determinism constraints

Carried from the scenario review (recorded in `spec.md`):

- process-liveness is observed through the process actually disappearing, not
  through a fixed wait;
- the size fixture is gone with the size-derived budget it existed to prove.

**How timing is actually proved — a deviation from the plan.** The plan called
for an injected clock everywhere. What shipped instead: the deadline *arithmetic*
is a pure function proved by unit tests at its boundaries, and the deadline
*behaviour* is proved by shrinking the real deadline through configuration
(`SAFEWORD_REVIEW_TIMEOUT_MS`, `SAFEWORD_REVIEW_RUN_BOUND_MS`) so a route
finishes in under a second of real time.

That is weaker than a virtual clock in one specific way — these tests can be
disturbed by a heavily loaded machine — and stronger in another: the same
configuration path a builder uses is the one under test, so nothing is proved
against a seam that only exists for tests. One full-suite run did show a single
timing failure under concurrent load that did not reproduce in isolation across
six subsequent runs. Recorded rather than hidden; if it recurs, the injected
clock is the fix.

Stop *effects* — signalling, process-tree termination, pipe closure — are proved
by polling until the descendant process is genuinely gone, with no timing claim
attached.

**Ties are arbitrated by state, not by callback order.** A clock alone cannot
make "the answer wins at the same instant" deterministic — whichever callback
fires first would decide. So each attempt carries one completion state, settled
once and never re-settled: a complete, parsed answer sets it to *answered*; a
deadline sets it to *timed out* **only if the state is still unsettled**. Both
callback orderings are driven in tests, for the attempt deadline and the run
bound, and both must reach the same verdict.

**Supervisor states carry the cleanup proofs.** Each guarantee maps to one
observable state rather than to elapsed time: *stopping* (signal sent),
*stopped* (the child's own exit event fired), *abandoned* (the cleanup deadline
passed while still stopping). "Nothing left when the next candidate starts"
means the previous attempt reached *stopped* or *abandoned*; late-answer
suppression means output arriving in either of those states is discarded because
the completion state is already settled; honest reporting of an escaped
descendant means *abandoned* is reported as such rather than as *stopped*.

**Compatibility.** With no alternate model configured, route selection is
unchanged and no model argument is ever passed — that is the whole claim, and
the ticket's done-when now says exactly that. Budgets, candidate shares,
capability skipping, cleanup and explanations do change; that is the feature.
Where Safe Word chose no model, `reviewer_model` is omitted rather than null, so
"no model was chosen" stays distinguishable from "a model was chosen and lost".

**Capability and contract delivery are per runtime.** Claude advertises
`--json-schema` and receives the contract inline; Codex advertises
`--output-schema` and receives it as a file. Same adapter shape — advertise,
deliver, enforce — so neither runtime's candidates are skipped for lacking the
other's flag.

### Build order

Reordered after mining 91 real review runs from parallel agent sessions. The
Codex contract bug is deterministic — every one of the 13 fallback attempts in
those logs failed `invalid_output` — while the timeout is a heavy tail. Fix the
certain failure first.

1. **Alternate-model route** — shipped. Config, grammar, argument wiring,
   routing and the public command, proved end to end in one direction.
   `TBU3.R1`, `R2`, `R3`.
2. **Codex typed output.** Temp contract file, `--output-schema`, capability
   states, skipping candidates that cannot honour the contract. Converts 13 of
   the 15 observed failures from "no independent check" into a usable review.
   `TBU2.R1`–`R3`.
3. **The flat attempt deadline.** Replace `timeoutMilliseconds()` with the
   300-second default and the honoured override, clamped to the run bound.
   `TBU1.R1`, `R2`.
4. **Per-route budgets and the run bound.** Each route gets its own deadline;
   540 seconds stops routes that have not answered. `TBU3.R4`, `R5`.
5. **Candidate shares.** Split a route's deadline across untried candidates
   against the 120-second floor, recalculating from what remains. `TBU1.R3`.
6. **Process supervision, cleanup, late answers.** `TBU1.R4`.
7. **Explanations and envelope.** Per-failure-class remedies, three-route
   causes, `reviewer_model`. `NTB1.R1`–`R3`.
8. **Public wiring completed.** Widen slice 1's vertical test to both authoring
   directions. `TBU3.R6`.

### Process supervision across platforms

Killing a process group is POSIX-specific, and both affected surfaces run on
macOS, Linux, and Windows. So cleanup goes behind a small supervisor with two
implementations:

| Platform | Launch | Stop | Descendants |
| --- | --- | --- | --- |
| macOS, Linux | `spawn(..., { detached: true })`, own process group | `process.kill(-pgid, 'SIGTERM')`, then `SIGKILL` at the cleanup deadline | covered while they stay in the group |
| Windows | ordinary spawn, child handle retained | `taskkill /PID <pid> /T /F` via the same bounded cleanup | covered by the `/T` tree terminate |

`taskkill` is chosen because it ships with Windows and needs no dependency;
Node exposes no job-object API. **Liveness is never queried by PID** — the
supervisor holds the child handle and treats the process as finished only when
its own `exit`/`close` event fires, so PID reuse cannot make a leaked process
look clean. If `taskkill` is unavailable, the supervisor kills the child it
holds and reports the descendants as not-stopped rather than claiming success.

**Honest support promise.** CI is Linux-only, so the POSIX path gets real
OS-level proof and Windows gets a unit-level assertion that the correct
termination command is issued with the right arguments — its actual OS effect is
unverified here. That asymmetry is recorded in Known deviations rather than
papered over with a platform-gated test that silently never runs. Neither
platform promises a descendant that deliberately escapes its group or tree —
the explicit non-promise `TBU1.R4` already carries.

### Capability states

A help probe establishes only that a flag is *advertised*. Writing a file and
forming an argument establishes only that Safe Word can construct an
invocation — neither proves the candidate will accept the contract. Only
launching it does. So there are two states, honestly named:

| State | How it is established | Classification |
| --- | --- | --- |
| unusable | probe failed, hung, was unreadable, or the flag is absent | `not_installed` for that candidate; skipped without launching a review |
| advertised | the flag appears in help output | earns one review attempt |

A candidate that advertises the flag but then rejects it fails at launch —
non-zero exit, before any model work — and is classified `process_failed`. It
costs a fraction of its share rather than the whole thing, and the remainder
returns to the route, so the next candidate is unharmed. That is exactly what
the `TBU2.R2` scenario requires: the candidate does not produce a review, and
the next candidate's share is recalculated from the time that actually remains.

No separate negotiation step is introduced. Inventing one would mean launching
the executable twice to learn what one launch already tells us.

### Temporary contract file lifecycle

**Two cleanup owners, never one.** A dispatch contains many attempts, so tying
the contract file to attempt cleanup would delete it before a later candidate
runs. Ownership is split:

| Owner | Lifetime | Removes |
| --- | --- | --- |
| attempt cleanup | one candidate's launch → stop | that reviewer's processes and pipes |
| dispatch cleanup | whole review run | the contract file and the temp root |

Attempt cleanup never touches the contract file. The file is written once at
dispatch start with a unique name and owner-only permissions, in the temp root
the packet already uses, and removed once when the run ends — on every exit
path including crash and launch failure. A test asserts the second and third
candidates still find the file present and unchanged after an earlier attempt
timed out. Its path never reaches an explanation, which `NTB1.R2` already
forbids for executable paths and launch arguments.

### Worst-case timing arithmetic

The run bound must survive the worst legal sequence, so the reserve is spent
deliberately rather than assumed:

- attempts: 3 routes × 300 s = 900 s — the whole of the three attempt budgets.
- probes: bounded *inside* each candidate's share, so they add nothing.
- candidate cleanups: 8 candidates × 3 routes × 5 s = 120 s worst case.
- route transitions: 3 × negligible, budgeted at 5 s each = 15 s.
- reserve: 300 s. Spend: 135 s. Headroom: 165 s.

Invariant to hold in code and prove at the boundary: no sequence of probes,
launches, candidate cleanups and route transitions pushes review work past
20 minutes, and the command still returns within one further cleanup window.

## Decisions

| Decision | Choice | Alternatives considered | Rejected because |
| --- | --- | --- | --- |
| Attempt deadline | flat 300 s, and the run bound capped rather than merely defaulted | size-derived curve; inactivity timeout; adaptive from history | 91 real runs show duration tracking output length, not packet size, so the curve modelled noise; Codex emits nothing for the 71 s it spends generating, so an inactivity timeout degenerates into the total timeout with a worse failure mode; adaptive needs history this command does not keep |
| Retry route | reviewer agent on a configured alternate model | retry same model; add Cursor as a third agent | same model on the same budget reproduces the timeout; Cursor as reviewer is out of scope per QZAFT2 |
| Model configuration | `.safeword/config.json` plus a `SAFEWORD_REVIEW_*` env override, no default | ship a default model per agent | Z4Q24Q forbids shipped model names — they rot each release and bind us to one vendor |
| Contract delivery to Codex | temp file passed as `--output-schema` | inline schema in the prompt only | Codex takes a file path, not inline JSON; verified against 0.146.0 during intake |
| Capability adapters | one adapter shape per runtime — Claude inline `--json-schema`, Codex `--output-schema` file | one shared required-flag list | a shared list skips capable candidates of the other runtime for lacking a flag they never had |
| Test clock boundary | every deadline virtual, including cleanup; one untimed OS test for stop effects | all-virtual; all-real; real timers for short boundaries | all-virtual cannot prove signalling; all-real makes 300-second boundaries cost 300 seconds; real short timers reintroduce the flakiness the constraint forbids |
| Run bound | 540 s | 20 min from route arithmetic | every caller invokes this through a tool capped at 600 s, so a longer bound is killed mid-flight rather than honoured |
| Candidate allocation | route budget ÷ untried candidates, recalculated each turn | whole route budget per candidate | a hanging first candidate consumes everything — the defect this ticket exists to fix |
| Process handling | a supervisor abstraction with POSIX group and Windows tree implementations | kill the child pid only; POSIX process groups everywhere | a bare pid kill leaves the reviewer's own children running, and process groups do not exist on Windows, which both affected surfaces support |
| Clock | injected into the runtime | real timers with generous test tolerances | wall-clock tests at these durations are slow and flaky |

## Design alignment

| Principle | Consequence | Proof | Conflict |
| --- | --- | --- | --- |
| Optimize for the NTB without constraining the TBU | every exhausted route names its own cause in plain words with one next step (NTB1.R1); the TBU keeps the raw classification in JSON | `packages/cli/features/reliable-reviews-for-real-packets.feature` | |
| 3. Add, never replace | the result envelope gains `reviewer_model` and keeps every existing field; an unconfigured project keeps unchanged route selection and is never given a model (TBU3.R3) | `packages/cli/features/reliable-reviews-for-real-packets.feature` | |
| 5. Clarity before correctness | explanations are built only from Safe Word's own failure classification, never from reviewer output, so they stay readable and leak nothing (NTB1.R2) | `packages/cli/features/reliable-reviews-for-real-packets.feature` | |
| 1. Structure enforces; instructions suggest | bounds are enforced by the runtime — attempt deadline, run bound, cleanup budget — rather than asked of the reviewer (TBU1.R2, TBU3.R5) | `packages/cli/features/reliable-reviews-for-real-packets.feature` | |

Architecture decisions honored: this extends the coordinator shipped by
`QZAFT2-cross-agent-adversarial-reviews` without changing its trust boundaries —
packet bounds, reviewer isolation, provenance verification, and strict parsing
all stay as recorded there.

## Known deviations

**The reviewer agent may now be invoked twice in one run.** QZAFT2's model
assumed one attempt per agent. Independence is unchanged — both attempts are the
non-author agent — but worst-case run duration grows from one attempt to three.
Accepted deliberately, bounded by the run bound, recorded here rather than
buried in timing code.

**"Never weaker than the author" is not enforced.** `PRINCIPLES.md`'s review
tier prefers a reviewer no weaker than the author. Safe Word cannot check that
without a hardcoded model-tier table, which Z4Q24Q ruled out as provider-specific
and release-fragile. A builder who configures a weak alternate model gets a
genuinely independent but less capable second opinion. Mitigated by documenting
the expectation at the configuration key; not mitigated by enforcement.

**Windows cleanup is unproven at the OS level.** CI runs Linux only. The POSIX
implementation is proved against real processes; the Windows one is proved only
to issue the right command. Rather than claim parity, the promise is narrowed:
descendant cleanup is verified on POSIX and best-effort on Windows.

## Doc impact

The configured `docs.sources` cover `README.md` and the website docs. The
customer-visible changes are the new alternate-model configuration key and the
documented timing bounds. Folded into the build order as a task at slice 8.

## What changed during implementation

- **Build order was reordered before any code shipped.** Mining 91 real review
  runs from parallel agent sessions showed the Codex contract bug failing 13 of
  13 attempts deterministically while the timeout was a heavy tail, so contract
  delivery moved ahead of the timing work.
- **The size-derived budget was abandoned entirely.** The same evidence showed
  duration tracking output length rather than packet size; a flat deadline
  replaced the curve, and the run bound was resized from route arithmetic
  (20 minutes) to the 600-second ceiling of the tool every caller uses.
- **The candidate-share floor was removed.** It contradicted the approved
  scenario; the floor now governs starting a route, not dividing one.
- **Four defects were caught by live reviews of this ticket's own commits**,
  once the Codex route was repaired: an env-precedence bug, an unclassified
  crash path when the contract file could not be written, surviving reviewer
  descendants, and a discarded alternate-model failure. A fifth — an uncapped
  run-bound override — came from the whole-ticket review.

## Assessment triggers

- A reviewer CLI gains native typed-output negotiation, making the capability
  probe redundant.
- Observed review latency shifts enough that 3 ms/byte no longer fits — the
  derivation is one function and one table of examples.
- A third reviewer agent becomes eligible, which would turn the fixed route list
  into a configured one and force the run bound to be recomputed.
- Safe Word gains persisted run history, which would make an adaptive budget
  practical where it is not today.
- The caller's ceiling changes: the run bound is derived from the 600-second
  tool limit, so a different invocation path would justify revisiting it.
- A route grows several candidates that fail differently — only the last
  candidate's failure is reported today, which can mislead.

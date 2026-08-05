# Impl Plan: Keep independent reviews reliable for real ticket packets

**Status:** planned

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

The reasoning: independence in this system means *the reviewer is not the
author*. A different model of the reviewer agent is still not the author, so it
carries the same independence the default model does. The author's own runtime
is the only degraded case, and it stays degraded.

### Proof plan

| Scenario group | Owner | Primary proof | Why that scope | Supporting proof |
| --- | --- | --- | --- | --- |
| TBU3.R1–R2 alternate-model route, independence | `coordinator.ts` | integration | routing and policy semantics span coordinator + runtime | unit on route ordering |
| TBU3.R3 no model configured, grammar | `policy.ts` | unit | pure config parsing | integration that no model argument is passed |
| TBU3.R4–R5 per-route budgets, ordering, run bound | `runtime.ts` | integration | needs real spawn + controlled clock | unit on budget arithmetic |
| TBU3.R6 public command end to end | CLI entry | E2E via `runCli` | the entry point is the thing under test | begins at slice 1 in one direction, widened at slice 8 |
| TBU1.R1 budget derivation | `runtime.ts` | unit | pure function of packet bytes | integration for the 111-second case |
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

- every timing boundary is proved on an injected clock, never real elapsed time;
- process-liveness assertions use process-group handles, not raw PIDs;
- the size fixture asserts exact byte counts against the same serialized packet
  the reviewer is sent.

**Where the fake clock stops.** *Every* deadline decision — attempt budget,
probe, cleanup, run bound — is proved on the injected clock, including the
5-second cleanup boundary. No timing assertion uses real elapsed time.

What a clock cannot simulate is OS behaviour: signalling, process-tree
termination, pipe closure, liveness. Those get a separate integration test that
makes **no timing claims at all** — it asserts that stopping a reviewer stops
its descendants and closes its pipes, and says nothing about when. The two
concerns never mix: *when* we decide to stop is virtual and exact, *whether the
stop worked* is real and untimed.

**Compatibility, stated precisely.** A project that configures no alternate
model gets unchanged *route selection* and no model argument on any invocation.
It does not get byte-identical behaviour overall — budgets, candidate shares,
capability skipping, cleanup and explanations all change by design. On any route
where Safe Word chose no model, `reviewer_model` is omitted from the envelope
rather than null, so consumers can distinguish "no model was chosen" from "a
model was chosen and lost".

**Capability and contract delivery are per runtime.** Claude already advertises
`--json-schema` and receives the contract inline; Codex advertises
`--output-schema` and receives it as a file. Both are the same adapter shape —
advertise, deliver, enforce — so neither runtime's candidates get skipped for
lacking the other's flag.

### Build order

1. **One thin vertical slice, end to end.** Config read → grammar → route list
   (reviewer/default → reviewer/alternate → author) → the model passed as a real
   argument → coordinator labelling → a public-command test in one authoring
   direction. Deliberately minimal on every axis except *going all the way
   through*, so the riskiest assumption is proved by the production path rather
   than by a fixture that manufactures routing metadata. `TBU3.R1`, `R2`, `R3`,
   partial `R6`.
2. **Per-route budgets and the run bound.** Each route gets its own attempt
   budget; the bound stops routes that have not answered. `TBU3.R4`, `R5`.
3. **Budget derivation.** Replace `timeoutMilliseconds()` with the packet-size
   function, clamps, and the honoured override. `TBU1.R1`, `R2`.
4. **Candidate shares.** Split a route's budget across untried candidates,
   recalculating from what remains. `TBU1.R3`.
5. **Codex typed output.** Temp contract file, `--output-schema`, capability
   states, skipping candidates that cannot honour the contract. `TBU2.R1`–`R3`.
6. **Process supervision, cleanup, late answers.** The supervisor abstraction
   below, its two platform implementations, and late-answer suppression.
   `TBU1.R4`.
7. **Explanations and envelope.** Per-failure-class remedies, three-route
   causes, `reviewer_model` on the envelope. `NTB1.R1`–`R3`.
8. **Public wiring completed.** Expand slice 1's vertical test to both authoring
   directions and every capability now present. `TBU3.R6`.

### Process supervision across platforms

Killing a process group is POSIX-specific, and both affected surfaces run on
macOS, Linux, and Windows. So cleanup goes behind a small supervisor with two
implementations:

| Platform | Launch | Stop | Descendants |
| --- | --- | --- | --- |
| macOS, Linux | detached, own process group | signal the group, then force it | covered while they stay in the group |
| Windows | own job-style child handle | terminate the child tree | covered by the tree terminate |

Both implementations answer the same two questions — *is anything still
running?* and *stop it* — so the runtime never branches on platform. Proofs are
platform-gated: the group/tree behaviour is proved on the host that can run it,
and the abstraction's contract is proved everywhere. What neither platform
promises is a descendant that deliberately escapes — that stays the explicit
non-promise `TBU1.R4` already carries.

### Capability states

A help probe establishes only that a flag is *advertised*. The adapter therefore
distinguishes three states, and only the last one earns a review attempt:

| State | How it is established | Classification |
| --- | --- | --- |
| unknown | probe failed, hung, or was unreadable | skip, next candidate |
| advertised only | flag appears in help output | skip unless delivery succeeds |
| contract delivered | the contract was written and accepted as an argument | try the review |

Delivery is validated before the attempt starts — the file is written and the
argument is formed — so a candidate that cannot receive the contract is skipped
without consuming a review attempt.

### Temporary contract file lifecycle

Created per dispatch with a unique name and owner-only permissions, in the same
temp root the packet already uses. Removed on every exit path — success,
timeout, crash, launch failure — via the same cleanup that stops the reviewer.
Its path is never included in any explanation, which `NTB1.R2` already forbids
for executable paths and launch arguments.

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
| Attempt budget | 60 s + 3 ms/byte, clamped to 120–300 s | fixed 300 s; adaptive from observed latency | fixed 300 s makes every genuine hang wait five minutes; adaptive needs persisted history this command does not have |
| Retry route | reviewer agent on a configured alternate model | retry same model; add Cursor as a third agent | same model on the same budget reproduces the timeout; Cursor as reviewer is out of scope per QZAFT2 |
| Model configuration | `.safeword/config.json` plus a `SAFEWORD_REVIEW_*` env override, no default | ship a default model per agent | Z4Q24Q forbids shipped model names — they rot each release and bind us to one vendor |
| Contract delivery to Codex | temp file passed as `--output-schema` | inline schema in the prompt only | Codex takes a file path, not inline JSON; verified against 0.146.0 during intake |
| Capability adapters | one adapter shape per runtime — Claude inline `--json-schema`, Codex `--output-schema` file | one shared required-flag list | a shared list skips capable candidates of the other runtime for lacking a flag they never had |
| Test clock boundary | every deadline virtual, including cleanup; one untimed OS test for stop effects | all-virtual; all-real; real timers for short boundaries | all-virtual cannot prove signalling; all-real makes 300-second boundaries cost 300 seconds; real short timers reintroduce the flakiness the constraint forbids |
| Budget input | byte length of the serialized packet | sum of file content bytes | the reviewer reads the serialized packet, so that is what costs it time |
| Candidate allocation | route budget ÷ untried candidates, recalculated each turn | whole route budget per candidate | a hanging first candidate consumes everything — the defect this ticket exists to fix |
| Process handling | a supervisor abstraction with POSIX group and Windows tree implementations | kill the child pid only; POSIX process groups everywhere | a bare pid kill leaves the reviewer's own children running, and process groups do not exist on Windows, which both affected surfaces support |
| Clock | injected into the runtime | real timers with generous test tolerances | wall-clock tests at these durations are slow and flaky |

## Design alignment

| Principle | Consequence | Proof | Conflict |
| --- | --- | --- | --- |
| Optimize for the NTB without constraining the TBU | every exhausted route names its own cause in plain words with one next step; the TBU keeps the raw classification in JSON | `packages/cli/features/reliable-reviews-for-real-packets.feature` NTB1.R1 | |
| 3. Add, never replace | the result envelope gains `reviewer_model` and keeps every existing field; the alternate model is opt-in, so an unconfigured project keeps unchanged route selection and is never given a model | `packages/cli/features/reliable-reviews-for-real-packets.feature` TBU3.R3 | |
| 5. Clarity before correctness | explanations are built only from Safe Word's own failure classification, never from reviewer output, so they stay readable and leak nothing | `packages/cli/features/reliable-reviews-for-real-packets.feature` NTB1.R2 | |
| 1. Structure enforces; instructions suggest | bounds are enforced by the runtime — attempt budget, run bound, cleanup budget — rather than asked of the reviewer | `packages/cli/features/reliable-reviews-for-real-packets.feature` TBU1.R2, TBU3.R5 | |

Architecture decisions honored: this extends the coordinator shipped by
`QZAFT2-cross-agent-adversarial-reviews` without changing its trust boundaries —
packet bounds, reviewer isolation, provenance verification, and strict parsing
all stay as recorded there.

## Known deviations

The alternate-model route means the reviewer agent may be invoked twice in one
run. QZAFT2's model assumed one attempt per agent. The independence guarantee is
unchanged — both attempts are the non-author agent — but the worst-case run
duration grows from one attempt to three. Accepted deliberately, bounded by the
20-minute run bound, and recorded here rather than hidden in the timing code.

## Doc impact

The configured `docs.sources` cover `README.md` and the website docs. The
customer-visible changes are the new alternate-model configuration key and the
documented timing bounds. Folded into the build order as a task at slice 8.

## Assessment triggers

- A reviewer CLI gains native typed-output negotiation, making the capability
  probe redundant.
- Observed review latency shifts enough that 3 ms/byte no longer fits — the
  derivation is one function and one table of examples.
- A third reviewer agent becomes eligible, which would turn the fixed route list
  into a configured one and force the run bound to be recomputed.
- Safe Word gains persisted run history, which would make an adaptive budget
  practical where it is not today.

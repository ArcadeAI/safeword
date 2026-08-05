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

## Assessment triggers

- A reviewer CLI gains native typed-output negotiation, making the capability
  probe redundant.
- Observed review latency shifts enough that 3 ms/byte no longer fits — the
  derivation is one function and one table of examples.
- A third reviewer agent becomes eligible, which would turn the fixed route list
  into a configured one and force the run bound to be recomputed.
- Safe Word gains persisted run history, which would make an adaptive budget
  practical where it is not today.

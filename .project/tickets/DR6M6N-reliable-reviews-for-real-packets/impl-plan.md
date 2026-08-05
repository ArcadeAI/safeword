# Impl Plan: Keep independent reviews reliable for real ticket packets

**Status:** planned

## Approach

**Riskiest assumption:** that asking the *same reviewer agent* to review again on
a different model still counts as a genuinely independent check — and may
therefore satisfy `crossAgentReview: require`. Everything else here is plumbing;
this one changes what "independent" means. If it is wrong, the alternate-model
route must be labelled degraded like the author fallback, and slices 5–7 change
shape.

**Cheapest proof:** the coordinator's own labelling — an alternate-model route
returns `independence: cross-agent` and the `require` policy accepts it — as an
integration test against a fake reviewer that honours a model argument. That is
slice 1, so a wrong answer about what independence *means* fails before any of
the timing work is built.

That slice-1 proof is deliberately narrow: it settles the semantics, not the
plumbing. It cannot show the route is operational, because configuration,
argument wiring and capability gating do not exist yet. The decisive
end-to-end proof — `TBU3.R6` through the public command, both authoring
directions — lands at slice 8, once every part it depends on is real.

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
| TBU3.R6 public command end to end | CLI entry | E2E via `runCli` | the entry point is the thing under test | — |
| TBU1.R1 budget derivation | `runtime.ts` | unit | pure function of packet bytes | integration for the 111-second case |
| TBU1.R2 stop on expiry | `runtime.ts` | integration | requires a real child process | — |
| TBU1.R3 candidate shares | `runtime.ts` | integration | allocation is observable only across spawns | unit on share arithmetic |
| TBU1.R4 cleanup, late answers | `runtime.ts` | integration | process-group behaviour is not mockable | — |
| TBU2.R1 contract delivery | `runtime.ts` | unit | schema is a value | integration asserting `--output-schema` is passed |
| TBU2.R2 capability gating | `runtime.ts` | integration | probe is a subprocess | — |
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

**Where the fake clock stops.** Budget arithmetic and deadline decisions run on
the injected clock, so a 300-second boundary costs no real time. But signals,
process groups, pipe closure and liveness are OS behaviour a fake clock cannot
simulate — so those are proved against real short-lived subprocesses with real
timers on sub-second budgets. The split is: *when* a deadline fires is virtual;
*what happens* when it fires is real. One real-time smoke test covers
process-group signalling and a descendant holding output open, at budgets small
enough to stay fast.

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

1. **Routes with per-route budgets, including the alternate model.** Introduce
   an explicit route list in `coordinator.ts` (reviewer/default →
   reviewer/alternate → author), each with its own attempt budget. Proves the
   riskiest assumption. `TBU3.R1`, `R2`, `R4`, `R5`.
2. **Alternate-model configuration and grammar.** `policy.ts` reads the
   configured model; grammar rejects anything unusable; nothing ships a default.
   `TBU3.R3`.
3. **Budget derivation.** Replace `timeoutMilliseconds()` with a packet-size
   function plus clamps and the honoured override. `TBU1.R1`, `R2`.
4. **Candidate shares.** Split a route's budget across untried candidates,
   recalculating from what remains. `TBU1.R3`.
5. **Codex typed output.** Write the contract to a temp file, pass
   `--output-schema`, add it to Codex's required capabilities so incapable
   candidates are skipped. `TBU2.R1`, `R2`, `R3`.
6. **Process groups, cleanup, late answers.** Launch detached into a group, kill
   the group, bound the wait, ignore anything arriving after a stop. `TBU1.R4`.
7. **Explanations and envelope.** Per-failure-class remedies, three-route
   causes, `reviewer_model` added to the result envelope. `NTB1.R1`–`R3`.
8. **Public wiring.** E2E through the review command, both directions.
   `TBU3.R6`.

## Decisions

| Decision | Choice | Alternatives considered | Rejected because |
| --- | --- | --- | --- |
| Attempt budget | 60 s + 3 ms/byte, clamped to 120–300 s | fixed 300 s; adaptive from observed latency | fixed 300 s makes every genuine hang wait five minutes; adaptive needs persisted history this command does not have |
| Retry route | reviewer agent on a configured alternate model | retry same model; add Cursor as a third agent | same model on the same budget reproduces the timeout; Cursor as reviewer is out of scope per QZAFT2 |
| Model configuration | `.safeword/config.json` plus a `SAFEWORD_REVIEW_*` env override, no default | ship a default model per agent | Z4Q24Q forbids shipped model names — they rot each release and bind us to one vendor |
| Contract delivery to Codex | temp file passed as `--output-schema` | inline schema in the prompt only | Codex takes a file path, not inline JSON; verified against 0.146.0 during intake |
| Capability adapters | one adapter shape per runtime — Claude inline `--json-schema`, Codex `--output-schema` file | one shared required-flag list | a shared list skips capable candidates of the other runtime for lacking a flag they never had |
| Test clock boundary | virtual for when deadlines fire, real subprocesses for what happens when they do | all-virtual; all-real | all-virtual cannot prove signalling or process groups; all-real makes 300-second boundaries cost 300 seconds |
| Budget input | byte length of the serialized packet | sum of file content bytes | the reviewer reads the serialized packet, so that is what costs it time |
| Candidate allocation | route budget ÷ untried candidates, recalculated each turn | whole route budget per candidate | a hanging first candidate consumes everything — the defect this ticket exists to fix |
| Process handling | launch detached in its own group, kill the group | kill the child pid only | a reviewer's own children survive a bare pid kill |
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

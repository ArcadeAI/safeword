# Impl Plan: Keep quality reviews observable and actionable

**Status:** planned
**Planned on:** 2026-08-12

## Approach

The riskiest assumption is that the installed `run-review.ts` wrapper can opt a
JSON invocation into the existing CLI progress reporter without changing the
public argv or stdout contract. Prove that first as a walking skeleton through
the real wrapper → real CLI registration → real coordinator, substituting only
a reviewer executable that stays active beyond the real 100 ms delay. The
existing reporter is not TTY-gated: its emit adapter writes unconditionally to
stderr, including when the wrapper's stderr is a pipe. JSON silence currently
comes from `executeDefinition` in `register.ts` not constructing a reporter;
the signal changes only that predicate.

Build four independently green slices with focused rollback commits. Reverting
the vertical first slice removes the whole opt-in path; installed wrappers pick
up either the change or rollback only after reinstall.

1. **Vertical walking skeleton.** Land the minimum complete path together: a
   best-effort descriptor sink as the sole reporter writer, unconditional signal
   consumption/deletion, quiet precedence, managed-only preparation filtering,
   the private-signal wrapper environment, and generated wrapper parity. The exact
   generated artifact that ships must run a real CLI/coordinator fixture,
   expose `Requesting an independent Claude review…` before child exit, expose
   no terminal result before exit,
   then preserve the result and status. A separate
   wrapper-level old-CLI fixture proves the no-new-argv invariant.
   The descriptor sink is the sole fd 2 writer for all reporter modes. It uses a
   synchronous descriptor write inside `try/catch`; unit and CLI tests assert
   write attempted, failure contained, and approved/action-required callers
   continue exactly. Failed and
   EBADF writes do not latch the sink off: the heartbeat still attempts its
   write without a fallback diagnostic. No
   process-wide error listener is added.
2. **Lifecycle and mode policy.** Complete signal partitions and injectable
   clock/interval/sink dependencies. Pin delayed
   line, heartbeat, completion ordering, human modes, suspended-clock coalescing,
   route-reset, transitions, and result statuses in `policy.test.ts` and
   `review-wiring.test.ts`. Existing `SAFEWORD_REVIEW_TIMEOUT_MS`,
   `SAFEWORD_REVIEW_RUN_BOUND_MS`, and fake `Date.now()` seams control attempt
   deadlines and route funding. A suspended-clock test jumps the injected clock
   to 95 seconds without executing intermediate callbacks, invokes only the one
   overdue heartbeat, and proves re-arming at 125 seconds. A separate ordinary
   cadence test advances through 30/60/90 seconds normally. Accepted JSON
   review fixtures disable runtime warnings and deprecations; the command path
   has no other fd 2 writer, so exact stderr equality is intentional.
3. **Reviewer isolation and route regressions.** Extend the slice-1 real-wrapper
   test to record exactly one reviewer launch and prove its environment lacks
   the signal. Add a separate environment-builder unit test whose input
   still contains the signal, so CLI deletion cannot make allowlisting vacuous.
   Revalidate exact coordinator-owned primary,
   alternate, and fallback messages; reviewer byte non-disclosure; route
   funding; failure taxonomy; output bounds; recovery; and statuses through the
   existing runtime/wiring suites.
4. **Installed surfaces and docs.** Through generated Claude Code and Codex
   workflow entry points, prove exact target/context/JSON arguments and wrapper
   stdout/stderr/status passthrough, including status 2. Update
   `packages/website/src/content/docs/reference/hooks-and-skills.mdx` with
   observable behavior only—never the private signal. Record one dogfood run
   where progress is visible before the result; host buffering stays outside
   the deterministic CLI contract and remains an assessment trigger.

### Acceptance proof levels and seams

| Scenario group | Proof level | Controlled seam |
| --- | --- | --- |
| Real wrapper opt-in, live stream separation, signal scoping | Slice-1 generated-wrapper subprocess reaches real CLI/coordinator and an environment-recording reviewer | Reviewer executable only; real 100 ms delay |
| Older CLI compatibility | Wrapper subprocess fixture rejects unknown argv and ignores unknown environment | Resolved CLI fixture; proves no-new-argv invariant |
| Exact signal partitions, quiet/human policy, completion boundaries, packet-preparation silence, clock jumps, route resets/transitions | In-process public CLI registration | Consume helper; injected clock/interval/sink/reviewer runtime; timeout/run-bound env and fake `Date.now()` |
| Progress write containment | Focused sink unit plus in-process public CLI | Synchronous descriptor writer with throwing and closed-fd fixtures |
| Reviewer output non-disclosure and allowlist defense | In-process CLI/coordinator plus focused environment-builder unit | Reviewer executable; source environment supplied directly to builder |
| Claude Code and Codex generated workflows | Installed-surface integration/catalogue parity | Wrapper fixture with exact argv, stdout, stderr, and statuses 0/2 |

## Decisions

### Implementation Inspiration

<!-- prettier-ignore -->
| Reference | Checked on | Source version | Target version | Evidence of fit | Principle to borrow | Mismatch / license / security boundary |
| --- | --- | --- | --- | --- | --- | --- |
| [Git clone progress](https://git-scm.com/docs/git-clone) | 2026-08-12 | Current Git documentation | Safeword 0.76.x | Git keeps progress on stderr and quiet suppresses it, preserving the primary output channel | Long-running machine-oriented commands may use a separate caller-controlled progress stream | Git exposes a public flag; Safeword needs only a private managed-wrapper opt-in and reuses no source |
| [Node.js process.env](https://nodejs.org/api/process.html#processenv) | 2026-08-12 | Node.js 24-compatible API | Bun runtime with Node compatibility | The API explicitly supports deleting an environment property in the current process | Consume and delete the private signal before descendant processes can inherit it | Environment variables are inherited by spawned children unless their environment is replaced; defense-in-depth allowlisting remains required |
| [Node.js child_process](https://nodejs.org/api/child_process.html#child_processspawncommand-args-options) | 2026-08-12 | Node.js 24-compatible API | Bun runtime with Node compatibility | Child environment and stdio are explicit spawn options | Scope the opt-in to the wrapper's CLI child while inheriting stdout/stderr byte-for-byte | Safeword uses Bun's compatible implementation; integration tests, not documentation alone, prove parity |

**Decision impact:** changed: managed JSON review invocations become observable without adding a public option or result protocol.
**Decision informed:** Scope managed JSON progress through a consumed private environment signal

### Recorded Decisions

| Decision | Choice | Alternatives considered | Rejected because |
| --- | --- | --- | --- |
| Scope managed JSON progress through a consumed private environment signal | `run-review.ts` sets exact value `1`; the tested registration helper reads and deletes it before dispatch | Hidden flag; documented public flag; wrapper-owned progress | The ticket excludes a public option; older CLIs ignore unknown environment variables but reject unknown arguments; wrapper-owned progress cannot know coordinator stages or cancellation |
| Reuse the existing progress reporter for managed route work | Filter preparation starts only on the managed JSON path; keep its delay, heartbeat, transitions, and cancellation; leave ordinary human timing unchanged | Remove preparation progress globally; new reporter or event protocol | Global removal widens scope; a second reporter duplicates policy and increases drift |
| Isolate progress-write failures from process lifecycle | Use a synchronous descriptor writer under `try/catch`; contain rejected promises only within injected sink adapters; attach no process-wide stream listener | Write through `process.stderr`; listener lifetime management; buffer into stdout/result data | Descriptor writes turn production failures into locally owned synchronous errors; stream listeners either miss late errors or swallow unrelated ones; stdout/result changes break the machine contract |
| Preserve existing human mode and make suspended-clock behavior explicit | Human mode retains preparation progress and quiet suppression; a missed heartbeat burst coalesces to one line and re-arms from that emission | Replay every missed interval; apply managed filtering globally | Bursts are not rate-limited; global filtering changes direct public CLI timing |
| Keep durable/background review out of this change | Preserve the current synchronous coordinator and budgets | Persisted jobs and status collection | Durable execution is a separate active design with storage, lifecycle, and stale-source semantics; mixing it here would enlarge and destabilize the small observability fix |

## Design alignment

| Principle | Consequence | Proof | Conflict |
| --- | --- | --- | --- |
| Optimize for the NTB without constraining the TBU | Managed workflows become observable while direct JSON automation remains byte-compatible; advanced callers retain human mode today, while a supported machine-progress API remains an explicit future trigger | `packages/cli/tests/review/surface-parity.test.ts` | explicit-conflict |
| 1. Structure enforces; instructions suggest | The CLI enforces stream separation and signal deletion; skills conventionally invoke the wrapper opt-in | `packages/cli/tests/cli-protocol/review-wiring.test.ts` | explicit-conflict |
| 2. Fire at boundaries, not every turn | Progress begins only after review route work becomes active and stops at terminal completion | `packages/cli/tests/cli-protocol/policy.test.ts` | |
| 5. Correct and safe; then clear; then simple | Reuse one reporter and one private signal; add no public flag, dependency, or result schema | `packages/cli/tests/cli-protocol/policy.test.ts` | |

This honors the `ARCHITECTURE.md` decisions **Host-owned cross-agent
adversarial review coordinator** and **Predictable Safeword CLI: one typed
protocol, explicit effects, preview-bound mutation**: the coordinator remains
the sole review authority and the schema-1 result stays the sole stdout machine
artifact.

## Known deviations

- **Optimize for the NTB without constraining the TBU:** External or inherited
  use of `SAFEWORD_REVIEW_PROGRESS=1` enables stderr
  progress for direct JSON review. This is unsupported, leaves stdout intact,
  and is accepted to avoid a public option or older-CLI argv break.
- **1. Structure enforces; instructions suggest:** The private signal is an
  enforceable wrapper/CLI boundary but cannot prevent an external process from
  setting the unsupported value itself; CLI consumption and reviewer
  allowlisting contain its reach.
- A broken progress descriptor is deliberately silent: the slice-4 dogfood run
  is the only post-ship detector. Emitting a fallback diagnostic would violate
  the best-effort side-channel contract.
- Wrapper CLI-unavailability and reserved exit behavior remain unchanged and
  out of scope; the stale historical `SWM1.R3` work-log reference is not a
  current Rule.

## Doc impact

- Update `packages/website/src/content/docs/reference/hooks-and-skills.mdx` to
  document that Safeword-managed review workflows show bounded progress on
  stderr while direct JSON callers remain silent. Describe behavior only: do
  not name the private signal, present it as caller-settable configuration, or
  imply direct JSON callers have a supported opt-in.
- `README.md`: skip because it does not document the review coordinator's stream
  contract; duplicating the reference would add drift.

## Assessment triggers

- A host introduces a supported structured progress/event channel for managed
  CLI work.
- Durable background review lands and changes the synchronous wrapper boundary.
- A third review-capable surface (for example Cursor) adopts required independent
  review workflows.
- Bun diverges from the tested Node-compatible environment or stdio behavior.
- External consumers request a supported streaming progress protocol rather than
  the current private managed-workflow behavior.
- Claude Code or Codex stops surfacing inherited stderr before child completion.

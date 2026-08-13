# Spec: Keep quality reviews observable and actionable

<!-- safeword:inspiration-contract:v1 -->

## Intent

Keep required independent reviews trustworthy during long or degraded runs: the caller can see bounded progress, machine output remains parseable, and terminal failures identify the failed boundary and a concrete recovery.

## Intake Brief

- **Requested by:** Repository maintainer after repeated dogfood review runs appeared silent and exhausted every route.
- **Cost of inaction:** Safeword can make a healthy long review look stuck, encourage unsafe manual retries or bypasses, and collapse distinct reviewer failures into an unactionable result.
- **Reversibility:** Two-way door. Progress is enabled only by Safeword's managed review wrapper and the richer failure data is additive; both can be removed without a data migration. Already-installed files require a normal Safeword reinstall to receive either the change or a rollback.

## References

- [GitHub issue #2386](https://github.com/ArcadeAI/safeword/issues/2386) — installed reviewer discovery and failure classification
- [GitHub issue #2455](https://github.com/ArcadeAI/safeword/issues/2455) — route exhaustion after silent waits
- [GitHub issue #2456](https://github.com/ArcadeAI/safeword/issues/2456) — opaque async review progress
- Ticket `3FK4DC-reliable-independent-review`, delivered on main by PR #2591, owns #2386 failure classification. This ticket revalidates that landed baseline; it does not independently redesign the same failure path.

## Personas

- Technical Builder (TBU)
- Safeword Maintainer (SWM)

## Surfaces

Affected:

- Safeword CLI
- Claude Code
- OpenAI Codex

Unaffected:

- Cursor — no current independent-review adapter or required review skill invocation to change.

## Vocabulary

- **Progress stream:** bounded human-readable lifecycle updates written separately from the final JSON result.
- **Review route:** one coordinator attempt through a preferred or fallback reviewer.
- **Managed review wrapper:** Safeword's installed `run-review.ts`, which resolves and launches the Safeword CLI that provides the `review run` command while inheriting its stdout and stderr as separate operating-system streams.
- **Review-capable Safeword CLI:** A resolved candidate whose `review run --help` probe exits successfully within the wrapper's existing 10-second probe cap.
- **Reviewer agent process:** The Claude or Codex child launched and isolated by the Safeword coordinator; distinct from the Safeword CLI process launched by the wrapper.
- **Reviewer-work budget:** elapsed time from the first reviewer-route assessment through the funded route sequence; packet preparation happens before it and bounded process cleanup happens after it.
- **Alternate reviewer model:** an optional configured model for retrying the assigned reviewer before Safeword uses the author's runtime as a degraded fallback.

## Product Inspiration

<!-- prettier-ignore -->
| Reference | Checked on | Source version / edition | Customer-value evidence | Principle to borrow | Non-copy boundary | Decision impact |
| --- | --- | --- | --- | --- | --- | --- |
| [Git clone progress](https://git-scm.com/docs/git-clone) | 2026-08-11 | Current Git documentation | Long transfers report progress on stderr; `--progress` forces it for non-TTY consumers and `--quiet` suppresses it. The primary output stream remains separately consumable. | Treat progress as a bounded side channel controlled by the caller that owns the long-running experience. | Do not add a public progress flag when only Safeword's managed review wrapper needs the behavior. | Keep direct `--json` behavior unchanged; let the managed wrapper opt its paired CLI into the existing progress reporter through a private environment signal. |
| [Docker Buildx progress](https://docs.docker.com/reference/cli/docker/buildx/build/#set-type-of-progress-output---progress) | 2026-08-11 | Current Docker Buildx CLI reference | Operators can choose TTY, plain, quiet, or raw-JSON progress, and plain mode exposes otherwise silent policy decisions during long builds. | Make progress an explicit output mode with a stable non-interactive representation. | Do not add multiple renderers or JSON-lines progress until Safeword has a consumer that needs them. | Use Safeword's existing plain delayed-start and heartbeat reporter rather than inventing a second event protocol. |

The transferable principle is progressive disclosure at the stream boundary: the final result remains the stable machine artifact, while Safeword's managed wrapper may request rate-limited lifecycle updates for the long-running experience it owns. This avoids a new public option or streaming schema.

## Jobs To Be Done

### reliable-observable-quality-reviews.TBU1 — Trust a long review without babysitting it

**Persona:** Technical Builder (TBU)

> When an independent review takes several minutes or must try another route, I want visible bounded progress and a precise terminal result, so I can distinguish healthy work from a stuck or misconfigured reviewer without corrupting automation.

#### reliable-observable-quality-reviews.TBU1.R1 — A managed JSON review reports rate-limited lifecycle progress separately from its final typed result

#### reliable-observable-quality-reviews.TBU1.R2 — Callers that do not request managed progress keep the existing silent machine contract

### reliable-observable-quality-reviews.SWM1 — Preserve the machine contract while improving dogfood visibility

**Persona:** Safeword Maintainer (SWM)

> When Safeword skills invoke the review coordinator with JSON output, I want progress to be explicitly requested on a separate stream and covered by public CLI tests, so installed workflows are observable without breaking existing consumers.

#### reliable-observable-quality-reviews.SWM1.R1 — Progress is a best-effort Safeword-owned side channel that cannot alter or disclose reviewer output

#### reliable-observable-quality-reviews.SWM1.R2 — Every generated required-review workflow delegates to the managed wrapper while remaining compatible with an older resolved CLI

## Rave Moment

### reliable-observable-quality-reviews — The review was working the whole time

- **Moment:** Once the packet is prepared and asynchronous reviewer work begins, a long review explains which reviewer is active, periodically confirms it is still waiting, and ends with one precise result without the agent retrying blindly.
- **Beats:** The current several-minute silence followed by an opaque route-exhausted message.
- **They'd say:** "Safeword showed me the independent review was still healthy, then gave my agent the exact recovery without breaking its JSON."

## Outcomes

- Safeword-owned review invocations expose the coordinator's existing delayed stages and heartbeats before the unchanged terminal schema-1 result.
- Existing direct `--json` callers whose environment does not carry the unsupported internal signal receive exactly the same silent stderr behavior; the managed wrapper is the only supported producer of the opt-in.
- Installed-reviewer discovery, compatibility, authentication, launch, timeout, and invalid-output failures delivered by ticket 3FK4DC remain typed through the public result with actionable recovery.
- Direct public CLI behavior does not change. The managed wrapper sets `SAFEWORD_REVIEW_PROGRESS` only for its Safeword CLI child; an older Safeword CLI ignores the unknown variable and completes with today's silent JSON behavior. External use of this internal variable is unsupported and creates no compatibility commitment.
- Existing route budgets, failure classifications, bounded reviewer-output validation, cleanup rules, and exit statuses are integration dependencies to revalidate rather than redesign here.
- Progress covers asynchronous reviewer-route work. Synchronous packet preparation remains byte-bounded but is outside this ticket's heartbeat and wall-clock contract.
- Reviewer agent stdio is piped only to the coordinator; its existing dispatch-id and schema checks authenticate accepted reviewer output before the coordinator builds the one public result envelope. The internal progress signal is removed by the reviewer agent's allowlisted environment builder.
- The wrapper and generated skills never parse reviewer agent output. The Safeword CLI preserves its existing schema-1 stdout envelope and uses stderr only for fixed progress. Host UIs may display those descriptors together, but whole-display JSON parsing and cross-descriptor ordering are not part of the machine contract.
- Candidate resolution retains its existing explicit order: bundled plugin CLI, project-local package binary, source CLI only when this is the Safeword source tree, then the version-pinned installed CLI. It does not search arbitrary PATH entries. Candidate resolution and no-CLI failure behavior are unchanged by this ticket.
- Actor-facing progress scenarios live in `packages/cli/features/reliable-observable-quality-reviews.feature`; focused regression tests retain the full landed failure taxonomy and action-required exit behavior.
- `data.preferred_failure` admits `not_installed`, `unsupported`, `probe_timed_out`, `not_authenticated`, `launch_failed`, `timed_out`, and `invalid_output`; route exhaustion is the separate machine-stable finding code `REVIEW_ROUTES_EXHAUSTED`, and both layers use action-required exit 2.
- Ticket 3FK4DC's landed taxonomy is treated as the baseline during scenario and final verification; if it changes on main, this ticket's named public-result scenarios must be updated and independently reviewed rather than silently following the change.

## Open Questions

None.

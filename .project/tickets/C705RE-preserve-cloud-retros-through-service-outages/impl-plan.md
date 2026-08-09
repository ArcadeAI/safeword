# Impl Plan: Preserve cloud retros through service outages

**Status:** blocked

## Approach

The riskiest assumption was that Claude Code Cloud could obtain a receipt during
its completion hook. The live Cloud probe disproved that release direction: the
hook ran but Railway did not respond inside the conservative 450 ms deadline.
Because the user experience must be invisible and nonblocking, no production
sender, public endpoint, project UUID, or operator queue ships from this plan.
A receiver without a proven sender would add an unauthenticated surface without
an end-to-end user outcome.

1. Before resuming implementation, run one separately chartered spike for a
   detached, Cloud-native carrier that can persist its own handoff or prove a
   public-ingest receipt without delaying the task. Its proof must use the real
   `POST /v1/public-retros` receipt path, not `/health`, and preserve a measured
   completion result. Claude, Codex Cloud, and Cursor Cloud Agents all remain
   `skip: live receipt proof outstanding`.
2. Only after a provider passes that proof, create a new fresh production plan
   for the complete vertical slice: project UUID and public-envelope builder,
   `PublicQuarantineStore`/migration, real public and operator routes, and that
   provider's thin adapter. The plan will require real-listener integration,
   temporary-SQLite lifecycle, fault-injection, and hosted wiring proof.

The Cloud probe is evidence only and its experimental code is not reused.

## Decisions

| Decision | Choice | Alternatives considered | Rejected because |
| --- | --- | --- | --- |
| Store boundary | Separate `public_quarantine` store/table | Reuse `retro_requests`; external telemetry system | The former risks a filing path from public input; the latter adds a service without low-volume value. |
| Dedupe equality | Canonical sorted-key fingerprint of every validated v1 public field | Raw request bytes; fingerprint only retro text | Raw bytes make key order relevant; partial fingerprint allows changed persisted metadata under one receipt. |
| Timing | 50 ms profile collection inside one 500 ms total deadline | Additive 50 ms + 500 ms timers | Additive timers violate the silent handoff contract. |
| Admission and recovery | Global in-memory limiter, 10,000-record cap, 80%/full alerts, explicit operator delete | Public UUID as credential; automatic expiry/eviction | UUID is forgeable; automatic loss conflicts with "store it for later." This is low-volume operational containment, not abuse prevention. |
| Carrier rollout | Defer every public-cloud release until a provider proves a detached, receipt-confirmed carrier | Build a receiver before its sender; raise the synchronous Stop-hook timeout | The first has no end-to-end value and widens public ingress; the second violates the invisible, nonblocking requirement and has already missed the conservative budget in Cloud. |

Figure It Out evidence: the live Claude Cloud `Stop` hook wrote the fixed
marker but recorded `TimeoutError` after 452 ms under a 450 ms deadline; a
local probe of the same Railway endpoint completed in 311 ms. The existing
architecture keeps unauthenticated records separate from the private filing
worker. Receiver-first was close because the SQLite/keyring design is small,
but loses because it creates no usable handoff. The current decision is to
defer the whole public-cloud slice until a real sender is proven. Premortem:
the detached-carrier research could become an open-ended platform effort; cap
each provider to a one-question spike and stop after the first failed proof.

## Design alignment

| Principle | Consequence | Proof | Conflict |
| --- | --- | --- | --- |
| Structure enforces; instructions suggest | A provider route cannot exist until its hosted evidence exists; no public HTTP route is deployed first. | The recorded Cloud spike and a future real-receipt proof are release gates. | |
| Add, never replace | Private credential filing and `retro_requests` remain untouched while this slice is deferred. | Existing private relay regression suite remains the boundary proof. | |
| Optimize for the NTB without constraining the TBU | The builder never waits longer or sees transport status merely to activate telemetry. | Live Cloud evidence rules out the synchronous hook path. | |
| Clarity before correctness | No receiver-only release and no speculative multi-provider abstraction. | The next plan begins with a tested provider carrier, then one vertical slice. | |

Architecture decision honored: `ARCHITECTURE.md`'s public-cloud-retro ADR keeps
public records outside the filing worker, on the existing encrypted one-replica
SQLite deployment.

## Known deviations

No deviation: public relay routing remains compiled off. This still cannot
satisfy #1479's authenticated durable-filing invariant or supersede #834.

## Doc impact

skip: no customer-visible behavior ships while every provider carrier is
disabled.

## Assessment triggers

- A provider proves a detached carrier with a real public-ingest receipt: create
  a fresh plan for that provider's one complete vertical slice.
- Another Cloud `Stop` proof returns inside its deadline: it is still
  insufficient until it exercises the real receipt route and leaves no
  builder-facing status.
- The user accepts a visible or blocking completion flow: return to behavior
  definition rather than silently relaxing this ticket's invisible contract.

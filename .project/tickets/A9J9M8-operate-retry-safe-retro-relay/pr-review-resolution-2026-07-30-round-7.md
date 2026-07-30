# Seventh-round PR review decisions

The live #1479 body remains the canonical contract. This investigation covers
the seventh-round PR comment at `issuecomment-5133270808`.

## Investigation plan

- State ownership: distinguish durable relay ownership from successful GitHub
  filing without recreating local ownership.
- Recovery ergonomics: retain the identifiers and commands needed to act on
  terminal and corrupt records.
- Scheduling: compare UUID order, FIFO, and earliest-deadline-first behavior
  under the shared 24-hour deadline.
- Configuration safety: compare fail-closed validation with automatic native
  fallback when only part of the relay environment is present.
- Evidence provenance: determine how a readiness artifact can be reproduced
  rather than authored as an unmeasured fixture.
- Protocol evolution: keep unknown states fail closed while giving old clients
  a stable response vocabulary.
- Renewal coherence: decide when a rejected renewal proves that restoring the
  former bytes is safe.
- Filesystem durability and GitHub classification: verify the proposed `EEXIST`
  and 403/422 changes against primary sources before changing them.

Primary sources:

- [Canonical issue #1479](https://github.com/ArcadeAI/safeword/issues/1479)
- [GitHub create-issue API](https://docs.github.com/en/rest/issues/issues#create-an-issue)
- [GitHub REST API versioning](https://docs.github.com/en/rest/about-the-rest-api/api-versions)
- [GitHub REST rate limits](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api)
- [Node filesystem API](https://nodejs.org/docs/latest-v24.x/api/fs.html)
- [Earliest-deadline scheduling analysis](https://digitalcommons.njit.edu/fac_pubs/17286/)

## Decision 1: Terminal relay receipts

- [x] Phase 1: Decide how to acknowledge durable terminal receipts without
      silently hiding their disposition or losing operator addressing.
- [x] Phase 2: Options:
  1. Refuse terminal acknowledgements and keep the local request.
  2. Keep counters per state without identifiers.
  3. Acknowledge durable ownership and return typed terminal receipt details.
- [x] Phase 3a: Domains: idempotent ownership transfer, terminal-state
      observability, operator recovery UX, and payload/identity retention.
- [x] Phase 3b: #1479 requires acknowledgement after durable acceptance and
      durable visible terminal states. The recovery API is receipt-addressed.
      Tombstones with an issue number represent filed identity; tombstones
      without one derive from rejection.
- [x] Phase 4: Option 1 creates two owners and endless retry. Option 2 cannot
      support receipt-addressed recovery. Option 3 preserves one owner and
      carries `requestId`, `receiptId`, `state`, and optional `issueNumber`.

> Recommend **typed terminal receipt details** because durable ownership and
> filing success are different facts, and operators need the receipt address.
>
> **Premortem:** this fails if terminal details become an unbounded noisy log;
> the bounded drain budget limits the per-run list, and reporting remains one
> line per terminal receipt.
>
> **Next:** add terminal-receipt outcomes and state-specific command reporting
> in `relay-delivery.ts` and `commands/retro.ts`.

The `accepted` count remains the durable-ownership count. The summary will call
it “durably owned” and label the client dead-letter count as local.

## Decision 2: Drain ordering

- [x] Phase 1: Decide how to order a bounded drain so UUID names cannot make an
      older deadline lose to a newer one.
- [x] Phase 2: Options:
  1. Preserve lexical UUID order.
  2. Use FIFO by `createdAt`.
  3. Use `retryDeadlineAt`, then `createdAt`, then request ID.
- [x] Phase 3a: Domains: deadline scheduling, deterministic tie-breaking,
      corrupt-record visibility, and bounded-stop-hook latency.
- [x] Phase 3b: Earliest-deadline-first reduces lateness for known deadlines.
      It improves fairness but cannot manufacture capacity when the backlog is
      larger than the daily drain budget.
- [x] Phase 4: UUID order is unrelated to urgency. FIFO approximates current
      equal-window deadlines but loses once deadlines are renewed. Deadline
      order uses the policy field directly at no additional filesystem-scan
      cost.

> Recommend **deadline, creation time, then request ID** because the shared
> deadline is the actual loss boundary.
>
> **Premortem:** this fails if malformed records sort behind valid work forever;
> malformed records will sort first so they become visible local dead letters.
>
> **Next:** sort the recovered delivery snapshot before claiming requests.

## Decision 3: Partial relay configuration

- [x] Phase 1: Decide whether one malformed or leftover relay variable should
      trigger native filing or a precise fail-closed error.
- [x] Phase 2: Options:
  1. Fall back automatically to native filing.
  2. Fail closed with the current outbox-first error.
  3. Fail closed, validating scalar completeness before outbox containment.
- [x] Phase 3a: Domains: idempotency ownership, operator error UX, rollout
      fallback policy, and credential-safe diagnostics.
- [x] Phase 3b: #1479 keeps native filing as a controlled rollout path. It does
      not authorize malformed relay configuration to bypass the durable owner.
      Error text can name variable classes without echoing secrets.
- [x] Phase 4: Automatic fallback can create while an external outbox or relay
      already owns the request. Outbox-first validation misdiagnoses a lone
      repository variable. Scalar-first fail-closed validation preserves the
      boundary and fixes the misleading message.

> Recommend **scalar-first fail-closed validation** because malformed explicit
> configuration cannot safely select a second filing owner.
>
> **Premortem:** users may still not know which variable is wrong; the message
> will name the required variable set without printing values.
>
> **Next:** reorder `resolveRelayConfig` validation and add the real-command
> regression.

## Decision 4: Corrupt-spool recovery

- [x] Phase 1: Decide how a batch-wide corruption failure tells the user what
      can actually clear it without weakening identity fencing.
- [x] Phase 2: Options:
  1. Keep “retry the command.”
  2. Ignore the corrupt record and persist other sources.
  3. Fail closed with derived request IDs and confirmed discard guidance.
- [x] Phase 3a: Domains: identity fencing, destructive-action UX, error
      observability, and batch atomicity.
- [x] Phase 3b: An unreserved corrupt record cannot reveal its source identity,
      so continuing could mint a replacement request. The existing discard
      command is explicit and requires `--confirm`.
- [x] Phase 4: Retry cannot change durable bytes. Isolation is unsafe when the
      source reservation is unknowable. Request-specific guidance preserves the
      fence while providing a real recovery path.

> Recommend **request-specific fail-closed guidance** because it is the only
> option that is both actionable and identity-safe.
>
> **Premortem:** a user could discard recoverable data too quickly; the message
> will say to inspect first and retain the command’s confirmation requirement.
>
> **Next:** carry corrupt request IDs through the persistence error and render
> the discard command.

## Decision 5: Drain-throughput evidence production

- [x] Phase 1: Decide how readiness evidence is produced reproducibly before
      the disabled manifest can be enabled.
- [x] Phase 2: Options:
  1. Continue authoring JSON fixtures manually.
  2. Add a deterministic local measurement command over a real durable spool.
  3. Require an always-on CI benchmark before any measurement command exists.
- [x] Phase 3a: Domains: benchmark reproducibility, artifact provenance,
      filesystem realism, CI flakiness, and readiness attestation.
- [x] Phase 3b: The build currently attests committed bytes and ancestry, not
      how they were produced. A fixed backlog and injected network boundary can
      exercise the real persistence/drain code without making wall-clock CI a
      readiness oracle.
- [x] Phase 4: Fixtures are not measurements. A mandatory CI latency benchmark
      is noisy and still needs a producer. A local command is the smallest
      auditable producer; review and commit hashing remain separate gates.

> Recommend **a reproducible measurement command over 300 durable requests**
> because it creates the exact artifact the existing validator consumes.
>
> **Premortem:** the injected relay latency could be mistaken for production
> capacity; the artifact and README will label the command a client regression
> measurement, not a production catch-up guarantee.
>
> **Next:** add `measure:relay-drain` and a subprocess wiring test.

## Decision 6: Receipt protocol evolution

- [x] Phase 1: Decide how a future relay can evolve without teaching an older
      CLI to acknowledge an unknown ownership state.
- [x] Phase 2: Options:
  1. Accept every unknown 2xx state.
  2. Add an `ownershipTransferred` field and trust it across unversioned enums.
  3. Define API version 1, treat a missing version as legacy v1, and freeze the
     v1 receipt-state vocabulary.
- [x] Phase 3a: Domains: backward compatibility, unknown-enum safety, HTTP
      version negotiation, and rolling client/server deployment.
- [x] Phase 3b: GitHub’s REST versioning keeps breaking changes behind explicit
      versions. Strict unknown handling is necessary because an unknown state
      cannot prove durable ownership.
- [x] Phase 4: Accepting unknown states recreates silent data loss. An ownership
      boolean can drift independently from state semantics. A versioned state
      vocabulary lets future servers preserve v1 for old or headerless clients.

> Recommend **an explicit v1 HTTP contract with headerless legacy v1
> compatibility** because it protects both old clients and strict ownership
> validation.
>
> **Premortem:** a future server could ignore the version contract; server tests
> will reject unsupported versions before durable access and documentation will
> freeze v1 states.
>
> **Next:** add the version header at the CLI/server boundary and real HTTP
> compatibility tests.

## Decision 7: Renewed-payload rollback

- [x] Phase 1: Decide which 4xx responses prove that restoring pre-renewal bytes
      cannot diverge from server-held identity.
- [x] Phase 2: Options:
  1. Roll back on every 4xx.
  2. Never roll back.
  3. Roll back only for a typed invalid request or payload mismatch.
- [x] Phase 3a: Domains: request-hash convergence, reverse-proxy ambiguity,
      authentication/rate-limit retries, and shared-deadline renewal.
- [x] Phase 3b: GitHub and HTTP infrastructure use several 4xx statuses for
      temporary conditions. The relay supplies typed 400 reasons and a 409
      payload-mismatch response; those are stronger evidence than the whole
      status class.
- [x] Phase 4: All-4xx rollback can discard the only bytes accepted elsewhere.
      Never rollback makes a proven-invalid renewal sticky. Typed rollback keeps
      renewed bytes through auth/rate-limit ambiguity and restores only when the
      payload itself is rejected or mismatched.

> Recommend **typed rollback for `invalid-request` and 409 mismatch only**
> because those responses speak to payload coherence rather than transport
> availability.
>
> **Premortem:** a new terminal payload error could be missed; it must add a
> typed reason and regression before joining the rollback allowlist.
>
> **Next:** narrow `renewRelayRecovery` and test both rollback and retain paths.

## Declined remedies

- Automatic native fallback on malformed relay configuration: violates the
  single durable owner and can create a duplicate.
- Converting failed post-`EEXIST` directory sync back into benign `EEXIST`:
  reports durability that was not proven. The sync failure must remain fatal.
- Treating every GitHub 403/422 as terminal: GitHub documents 403 rate limits
  and 422 validation-or-spam ambiguity, so status alone cannot authorize local
  deletion.

## Post-GREEN Decision 8: Syntactically valid corrupt durable records

- [x] Phase 1: Decide whether JSON syntax alone is enough to order a durable
      relay record.
- [x] Phase 2: Options:
  1. Let malformed fields flow into ordering and delivery.
  2. Validate only inside the ordering helper.
  3. Make the shared durable-request parser require the full request shape and
     finite timestamps.
- [x] Phase 3a: Domains: durable corruption recovery, deadline ordering,
      request-identity retention, and all parser callers.
- [x] Phase 3b: Every caller treats `undefined` as corrupt or non-authoritative.
      No caller can safely use a partial request. JSON such as `{}` currently
      survives parsing, produces invalid sort keys, and is rearmed instead of
      visibly dead-lettered.
- [x] Phase 4: Ordering-only validation would leave other parser callers with a
      weaker definition of a durable request. Shared shape validation makes
      corruption handling consistent without changing valid bytes.

> Recommend **shape- and timestamp-validating `parseDurableRequest`** because a
> syntactically valid object is not a usable durable request.
>
> **Premortem:** stricter validation could quarantine a historically accepted
> malformed record; such a record cannot safely preserve identity, deadline,
> or payload semantics and must remain visible for operator recovery.
>
> **Next:** keep the failing mixed-backlog regression and make the shared parser
> return `undefined` for partial or invalid-date records.

## Post-GREEN Decision 9: Measurement timing margin

- [x] Phase 1: Decide whether the producer's 900 ms drain budget leaves enough
      margin for its required sub-second artifact on loaded CI.
- [x] Phase 2: Options:
  1. Keep a 900 ms budget and rely on roughly 100 ms of cleanup margin.
  2. Raise the one-second validator ceiling.
  3. Lower only the producer's injected drain budget while preserving the
     production 750 ms contract and `acceptedCount >= 2`.
- [x] Phase 3a: Domains: deterministic CI evidence, real filesystem cleanup,
      injected 80 ms latency, and production deadline independence.
- [x] Phase 3b: The producer is regression evidence, not a capacity claim. A
      650 ms producer budget still permits several 80 ms acknowledgements and
      leaves roughly 350 ms for the post-drain rescan and artifact write.
- [x] Phase 4: Raising the validator weakens the stated readiness threshold.
      Keeping 900 ms makes loaded-CI scheduling part of the measured result.

> Recommend **a 650 ms producer-only drain budget** because it preserves the
> metric contract while materially reducing timing flake.
>
> **Premortem:** very slow filesystems may still exceed one second; the command
> will fail visibly rather than publish invalid readiness evidence.
>
> **Next:** lower the producer budget under the existing subprocess
> characterization and keep the production deadline unchanged.

## Refactor ledger

- [x] Keep client API-version constants private (`b4c32ac35`).
- [x] Reuse the server API-version header constant (`fcb8cddd9`).
- [x] Name the reported terminal-state set (`db01919b9`).
- [x] Deduplicate the persistence fallback message (`b53813d89`).
- [x] Name the measurement timing policy (`35e16743d`).
- [x] Extract measurement draft, collaborator, and artifact construction one
      change at a time (`464e83a65`, `3aa0d8eec`, `4ee34fe8a`).
- [x] Remove the introduced accepted-response test clone (`e8f975d72`).
- [x] Characterize recovery protocol headers before sharing submission headers
      (`32837a008`, `4f4f20056`).
- [x] Rename the non-filed terminal reporting abstraction so it cannot be
      confused with every server terminal state (`812aabff4`).
- [x] Parse each delivery priority once (`a80b86a31`).
- [x] Defer a cross-package protocol-contract module: creating a new dependency
      boundary between the published CLI and private relay is architectural
      work, not a small behavior-preserving refactor.

---
id: C705RE
slug: preserve-cloud-retros-through-service-outages
type: feature
phase: plan-implementation
status: in_progress
scope:
- Generate one UUIDv4 project installation ID locally during `safeword install`,
  store it in project config, and make no setup-time relay call.
- Send that public installation ID with a bounded sanitized retro and a
  best-effort runtime profile: normalized repository, actor, agent/harness,
  host class, OS family, architecture, and Safe Word version.
- Resolve actor as an already-exposed GitHub login when available, otherwise
  the local Git `user.email`; the only initial GitHub-login source is
  `GITHUB_ACTOR`. Never make a network identity lookup or read a token to
  enrich a handoff.
- Bound runtime-profile collection to 50 ms; a missing, malformed, or slow
  source produces an omitted field and cannot consume the relay handoff budget.
- Key public quarantine identity by project installation ID, normalized remote
  repository, and request ID, so a fork that copies project config is a distinct
  source without mutating its config at runtime.
- Reuse the existing request identity and durable-store conventions to keep
  accepted public ingress in a separate encrypted operator queue, with a fixed
  configurable record capacity.
- Let only an existing authenticated relay operator list and inspect queued
  public records. Public ingress remains submit-only and never files a retro.
- Keep the carrier quiet: its bounded failure is recorded only in sanitized
  operational telemetry, never narrated to the builder.
- Prove the endpoint, client wiring, and failure behavior with integration and
  fault-injection tests.
out_of_scope:
- Treat the project installation ID or any runtime claim as a secret,
  authentication, or authority for relay operations, reads, GitHub access,
  cross-repository filing, or the privileged filing worker.
- Claim a provider route is enabled without a real carrier and hosted-network
  proof; this work does not activate `05PR3F` or supersede #834.
- Add provider-persistent storage or a new hosted identity system.
done_when:
- A fresh install creates its UUID locally without contacting the relay; an
  accepted handoff has that ID, its original transport-independent request ID,
  one receipt, and bounded provenance with its source recorded.
- Duplicate delivery is idempotent and malformed, mismatched, oversized,
  unknown, or rate-limited ingress cannot file a retro.
- An accepted public request remains durably quarantined through a relay
  restart; a client-side timeout or service failure stays bounded and silent to
  the builder.
- Encrypted public payload and runtime profile remain available in the bounded
  operator queue. A full queue rejects a new identity without evicting or
  mutating an accepted record, while an existing identity still deduplicates.
- The original bearer-authorized filing and operator paths retain their current
  authorization boundaries.
created: 2026-08-08T16:53:28.607Z
last_modified: 2026-08-08T16:53:28.607Z
---

# Hand off cloud retros without interrupting builders

**Goal:** Let builders using cloud agents hand off a sanitized retro without
waiting for relay filing or seeing a user-facing interruption.

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.

## Work Log

- 2026-08-08T16:53:28.607Z Started: Created ticket C705RE
- 2026-08-08T16:55Z BDD intake drafted the requested-by, cost-of-inaction,
  reversibility, cloud personas, affected surfaces, and three JTBDs. The
  receipt boundary is explicit: durable recovery starts only after a hosted
  intake accepts the request; total loss of every durable endpoint cannot be
  repaired from a reclaimable VM and remains awaiting user confirmation.
- 2026-08-08T17:00Z Current official host documentation and an independent
  Claude quality review approved the intake. Before the scope gate, add the
  mandatory host-managed credential boundary and capture a concrete supported
  carrier for each cloud surface; machine-readable scope/done-when remains
  deliberately deferred until the BDD JTBD and Rules gates are confirmed.
- 2026-08-08T17:05Z User chose the receipt boundary: recovery is guaranteed only
  after durable intake accepts the request; a total intake outage reports an
  actionable incomplete result rather than adding provider-specific storage.
  The five JTBDs now have one or two testable Rules each and await the Rules
  gate before engineering scope is set.
- 2026-08-08T17:10Z User prioritized an invisible, nonblocking experience. The
  ticket now chooses a quiet bounded handoff with operator-only failure evidence
  when a receipt cannot be obtained. That intentional trade-off cannot satisfy
  #1479's no-loss service-outage invariant for an ephemeral VM, so it cannot
  unblock all-harness relay activation or supersede #834.
- 2026-08-08T17:18Z Figure It Out examined the existing relay authentication,
  host lifecycle/configuration documentation, carrier support, and secret
  exposure. The current reusable bearer token cannot meet the approved
  hook-only/no-agent-secret rule: Claude Cloud hooks share the agent
  environment, while Codex Cloud strips configured secrets before the agent
  phase. No common provider workload-identity boundary is documented for all
  three cloud surfaces. Keep every cloud route disabled rather than inventing a
  credential path; a real provider carrier must prove an independently
  authorized, durable receipt before it contributes to #1479.
- 2026-08-08T17:27Z User explicitly selected the public telemetry-style intake
  trade-off. Scope now treats the shipped value as a public, repository-scoped,
  bounded ingest identity with strict server-side scope binding and rate limits,
  not a secret credential. It may enqueue only the existing sanitized retro
  request; it cannot operate, read, or select another repository. The cloud
  carrier stays silent on bounded intake failure. This is a deliberately
  untrusted ingress boundary and remains separate from the bearer-authorized
  filing and operator paths.
- 2026-08-08T17:31Z BDD scope gate complete: moving to define behavior. The
  public-ingest route is intentionally limited to one server-bound repository
  and must prove durable acceptance, idempotency, bounded silent failure, and
  no escalation into the bearer-authorized relay surface.
- 2026-08-08T17:39Z Quality review corrected a load-bearing scope conflict with
  #1479: its canonical contract requires authenticated harness credentials
  before durable or GitHub access. A public key is not authentication, so this
  ticket's public route must durably quarantine rather than enter the existing
  privileged filing worker. It remains an invisible optional telemetry path,
  never evidence for #1479, `05PR3F`, or #834. The authenticated relay route is
  unchanged.
- 2026-08-08T17:52Z User chose a zero-signup model. `safeword install` will
  generate a public UUIDv4 project installation ID locally, with no server
  contact. Each nonblocking handoff will carry best-effort claimed provenance:
  normalized repository, an already-available GitHub login or local Git email,
  agent/harness, cloud-or-local host class, OS family, architecture, and
  Safe Word version. Claims are metadata only: never authentication or filing
  authority. The client makes no identity network call and never reads or
  transmits a token.
- 2026-08-08T18:01Z Quality review tightened the zero-signup proposal before
  implementation: the receiver namespaces untrusted public records by local
  project ID + normalized remote repo + request ID so copied fork config does
  not merge sources; only `GITHUB_ACTOR` may supply an initial GitHub login,
  otherwise local Git email or unknown is recorded with source provenance; and
  the encrypted public payload/profile expires after 30 days while its
  payload-free dedupe tombstone remains indefinitely.
- 2026-08-08T18:05Z Quality review added a 50 ms runtime-profile collection
  budget. Slow or unavailable local Git and host metadata resolve to omitted
  fields; they never delay a receipt attempt or add builder-facing output.
- 2026-08-08T18:08Z User accepted the revised behavior set and requested
  implementation to proceed. Moving to the scenario gate for adversarial review
  and independent approval before implementation planning.
- 2026-08-08T18:15Z Independent Claude scenario review requested changes. The
  feature now proves that a copied installation ID stays isolated when the
  request ID is the same but the normalized repository differs; a changed
  payload cannot reuse an accepted identity; `GITHUB_ACTOR` wins over Git
  email; and a 30-day tombstone still deduplicates without retaining payload.
  The remaining cross-outcome quiet-result check is intentional NTB coverage.
- 2026-08-08T18:35Z Cloud-carrier spike was partial: Railway served health in
  286 ms and accepted a bounded POST in 213 ms, but the deployed route correctly
  required authentication and this local session cannot run an actual hosted
  completion carrier. All provider routes remain disabled. The implementation
  plan uses a separate public quarantine table and write-only endpoint so this
  result cannot weaken the authenticated filing boundary.
- 2026-08-08T18:42Z Plan review found that a write-only 30-day quarantine would
  retain diagnostic data with no way to use it, while indefinite tombstones
  would leave an unbounded anonymous-write namespace. User confirmed the
  current low-volume goal: use the existing Railway SQLite service only. The
  revised behavior is a small encrypted operator queue with a fixed configurable
  record cap, no automatic eviction, basic bounded ingress, and operator-only
  list/inspect access. This materially changes retention and therefore returns
  to scenario review before implementation planning resumes.
- 2026-08-08T19:10Z The revised bounded-queue behavior passed independent
  scenario review after adding deterministic deadline, malformed-profile,
  untrusted-egress, dedupe-before-rate-limit, capacity-race, and traceability
  coverage. Reviewer suggestions for rate-window reset and exact body-size
  boundaries are intentionally deferred: they do not protect the core durable
  acceptance/quiet failure contract at current low volume and would add policy
  surface before there is evidence it is needed.
- 2026-08-08T19:25Z Replanned after the approved scenario review. The first
  slice is public quarantine persistence plus real HTTP/operator wiring; no
  cloud adapter is planned until a provider proves a completion carrier. The
  plan now binds dedupe to a canonical complete v1 envelope and makes the
  50 ms profile collection part of the 500 ms total handoff budget.
- 2026-08-09T16:25Z A live Claude Code Cloud `Stop`-hook probe wrote its fixed
  marker, proving hook execution, but the Railway health request timed out at
  452 ms under a conservative 450 ms deadline. The result is partial: Cloud
  lifecycle execution exists, but a synchronous receipt-confirmed completion
  carrier is not ready. Replanning defers the entire public-cloud vertical
  slice—not merely the adapter—because a receiver-only release would add public
  ingress without an end-to-end handoff. A future one-question spike must prove
  a detached carrier against the actual public receipt endpoint.
- 2026-08-11T A detached Claude Cloud `send_later` spike was invalidated before
  its script could run. Auto mode denied the delayed-message registration twice,
  including after in-chat approval; no message registered and no workaround was
  attempted through triggers, cron, or a background timer. A permission rule or
  another session mode would change the zero-setup contract, so the plan now
  requires default auto-mode permission as part of any future carrier proof.

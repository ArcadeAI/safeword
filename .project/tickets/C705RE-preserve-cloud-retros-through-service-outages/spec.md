# Spec: Preserve cloud retros through service outages

## Intent

Cloud-agent workspaces disappear at task completion. A cloud retro handoff must
stay out of the builder's way: it has a short bounded attempt, no task-blocking
continuation, and no user-facing transport narration. A durable public receipt
means its encrypted quarantine record can survive relay restart; it is not a
promise of GitHub filing. An unavailable intake is a best-effort failure, not a
false promise of recovery.

## Intake Brief

- **Requested by:** Alex, while exploring a quiet cloud handoff alongside
  GitHub issue #1479's authenticated durable relay.
- **Cost of inaction:** cloud sessions can leave a non-critical diagnostic retro
  only in a reclaimed VM. This public route must not be mistaken for #1479's
  authenticated all-harness filing boundary.
- **Reversibility:** one-way. A new durable-ingress contract and its persisted
  records become an operational compatibility boundary.

## References

- GitHub issue #1479 — canonical retry-safe retro filing contract.
- Ticket `A9J9M8-operate-retry-safe-retro-relay` — existing relay, request
  identity, auth, and local external-outbox protocol.
- Ticket `05PR3F-route-retros-through-durable-relay` — launch evidence and
  manifest activation, deliberately blocked on this feature.

## Personas

- Technical Builder (TBU)
- Non-Technical Builder (NTB)
- Safeword Maintainer (SWM)

## Surfaces

Affected:

- Safe Word CLI
- Claude Code Cloud
- OpenAI Codex Cloud
- Cursor Cloud Agents
- Railway Hosted Relay

Unaffected:

- Claude Code — its existing local Stop hook and externally durable outbox are
  already handled by the relay foundation.
- OpenAI Codex — its existing local Stop hook and externally durable outbox are
  already handled by the relay foundation.
- Cursor — its existing local Stop hook and externally durable outbox are
  already handled by the relay foundation.

## Vocabulary

- **Durable intake:** a hosted endpoint that accepts the exact sanitized relay
  request and returns success only after durable persistence. Public intake
  persists a quarantine record; it does not authorize later GitHub filing.
- **Filing worker:** the background relay process that takes bearer-authorized
  requests through the existing retry-safe GitHub filing state machine. It does
  not consume public-ingress quarantine records.
- **Handoff receipt:** the request-ID-bound proof returned by durable intake;
  it permits an ephemeral agent to end without retaining its own retry file.
- **Quarantine key:** project installation ID + normalized remote repository +
  request ID. It identifies one public intake record and is the sole dedupe
  key for that record.
- **Project installation ID:** a UUIDv4 generated locally by `safeword install`
  and stored in project config without contacting the relay. It is intentionally
  public and groups first-seen telemetry; it is not authentication. A copied
  project config in a fork has a distinct quarantine key because its normalized
  remote repository differs.
- **Public ingest key:** a release-scoped, intentionally public key compiled
  into Safe Word. It identifies the permitted intake format and can be rotated
  by releasing a replacement; it is not a secret, identity, or authorization.
- **Runtime profile:** best-effort claimed provenance gathered without network
  calls: normalized repository, actor, agent/harness, cloud-or-local host
  class, OS family, architecture, and Safe Word version. Initial GitHub login
  is used only from `GITHUB_ACTOR`; otherwise the local Git `user.email` is
  used. Missing data stays missing. The profile is encrypted quarantine
  metadata; raw email is never included in a GitHub issue, command output, or
  operational log. Profile collection has a 50 ms budget inside the existing
  500 ms cloud handoff deadline; a slow or malformed source produces an
  omitted field and never delays relay handoff. It is part of the 500 ms total
  handoff budget, so the receipt request uses only the time that remains.

## Jobs To Be Done

### preserve-cloud-retros-through-service-outages.TBU1 — Finish a cloud task without a filing interruption

**Persona:** Technical Builder (TBU)

> When my cloud agent finishes a session, I want it to hand off a sanitized
> retro without delaying or interrupting my task, so relay plumbing does not
> make the agent feel noisy or slow.

#### preserve-cloud-retros-through-service-outages.TBU1.R1 — A cloud handoff is bounded and silent while returning a durable receipt only after acceptance

#### preserve-cloud-retros-through-service-outages.TBU1.R2 — An accepted cloud retro remains durably quarantined through a relay restart

### preserve-cloud-retros-through-service-outages.TBU2 — Continue work when cloud intake is unavailable

**Persona:** Technical Builder (TBU)

> When cloud intake cannot be reached, I want my task to continue without a
> transport interruption, so a rare Safe Word outage does not become my work.

#### preserve-cloud-retros-through-service-outages.TBU2.R1 — An unavailable intake never delays, blocks, or claims durable acceptance for a cloud task

### preserve-cloud-retros-through-service-outages.NTB1 — Finish cloud work without Safe Word transport noise

**Persona:** Non-Technical Builder (NTB)

> When my cloud task finishes, I want its response to focus on my requested
> work rather than Safe Word transport details, so I do not need to understand
> the relay to use the agent successfully.

#### preserve-cloud-retros-through-service-outages.NTB1.R1 — Cloud handoff status does not add user-facing narration to an ordinary task result

### preserve-cloud-retros-through-service-outages.SWM1 — Enable only real cloud handoffs

**Persona:** Safeword Maintainer (SWM)

> When I prepare the relay for release, I want each cloud surface to use its
> own supported completion carrier and prove durable acceptance, so an enabled
> route reflects real host behavior rather than a test-only universal hook.

#### preserve-cloud-retros-through-service-outages.SWM1.R1 — Only an actual supported carrier with durable-acceptance evidence counts toward activation

### preserve-cloud-retros-through-service-outages.SWM2 — Identify public cloud handoffs without enrollment or authority

**Persona:** Safeword Maintainer (SWM)

> When I install Safe Word in a project, I want it to create a local project ID
> and gather useful runtime provenance without sign-up or a network setup step,
> so cloud handoff can remain effortless without gaining relay or GitHub
> authority.

#### preserve-cloud-retros-through-service-outages.SWM2.R1 — Installation creates a stable public project ID locally and handoff carries bounded best-effort provenance

#### preserve-cloud-retros-through-service-outages.SWM2.R2 — Public intake cannot use privileged relay capabilities while authenticated operators can inspect queued data

#### preserve-cloud-retros-through-service-outages.SWM2.R3 — Public data remains available to authenticated operators within a fixed queue capacity

## Rave Moment

skip: table-stakes. The outcome is durable confidence, not a moment that should
be marketed as surprising.

## Outcomes

- A successful cloud handoff has a durable, request-ID-bound receipt before the
  handoff is counted as durable.
- A public-ingress receipt survives relay restart as one encrypted quarantine
  record with the original identity and payload; it causes no GitHub write.
- Accepted public payload and runtime profile remain encrypted in a bounded
  operator queue so authenticated Safe Word operators can inspect, cluster, or
  export them later. The queue has a fixed configurable record capacity; a full
  queue rejects a fresh quarantine key without displacing an accepted record.
  It emits a sanitized operator alert at 80% capacity and again when full.
- An unavailable intake returns control within the 500 ms handoff deadline, creates no
  user-facing interruption, and emits only sanitized operator evidence.
- A surface without a supported carrier or without a receipt cannot count
  toward #1479 relay activation.
- A fresh install creates its project installation ID locally and makes no relay
  enrollment call. An accepted handoff records that ID and its best-effort
  runtime profile as metadata, with provenance for each actor field.
- Project ID and runtime claims can cause only bounded, sanitized retro
  quarantine. They cannot read records, operate the relay, access GitHub
  credentials, select a repository, or enter the filing worker.

## Decision

Cloud handoff is quiet best effort. A successful public-ingest receipt transfers
ownership to an encrypted durable quarantine record, not the GitHub filing
worker. If durable intake is unavailable, the handoff returns quickly and does
not interrupt the agent or mention the failure to the builder. An independent
operator channel may record sanitized evidence when reachable; no such record
is promised while all endpoints are unreachable.

This is an intentional deviation from #1479's no-loss service-outage invariant
for a reclaimable VM without any reachable durable endpoint. It does not count
as all-harness relay routing, cannot enable ticket `05PR3F`, and does not affect
the supersession condition in issue 834. Provider-specific persistent storage is out of
scope.

## Ingress trust decision (Figure It Out)

The existing reusable bearer credential remains the private authorization path
for local filing and relay operations. Cloud handoff instead uses a
telemetry-style local project installation ID. It is intentionally readable by
the agent and therefore is never described as authentication or a secret.

`safeword install` generates the UUIDv4 locally only when missing and stores it
in project config; there is no registration endpoint or setup-time network
call. At handoff the
client derives the repository from its Git remote after stripping userinfo and
adds only best-effort runtime claims. It never calls GitHub to discover an
identity, reads a token, or sends a hostname, local path, or token. `GITHUB_ACTOR`
is the only initial GitHub-login source; otherwise the actor is Git email or
unknown. The relay validates and rate-limits the request but treats all values
as metadata, never as authorization; it persists accepted public submissions
  only in an encrypted quarantine record. A release-scoped public ingest key
  accompanies the request but is never treated as a secret. Records persist
  until an authenticated operator uses them or the configured fixed queue
  capacity is reached; the receiver never evicts accepted data to make room for
  a fresh untrusted quarantine key. This accepts the residual risk of bounded junk
  submission and spoofed provenance; strict body, rate, and capacity limits
  plus operator alerts contain it. This public path is intentionally outside
issue 1479's authenticated relay contract and can never count toward issue
1479, `05PR3F`, or issue 834.

The public request body is the existing versioned, sanitized relay filing
envelope plus public project installation ID and claimed runtime profile; its
receipt is bound to the same request ID. New cloud carriers must use this exact
schema or introduce a new version rather than changing the public contract.

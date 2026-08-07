# Spec: Prove the retro relay on Railway

## Intent

Prove that the retry-safe retro relay can run as a small hosted service with
durable local SQLite storage before investing in production GitHub App setup
and real harness routing.

## Intake Brief

- **Requested by:** Safeword maintainer
- **Cost of inaction:** The relay remains a locally tested abstraction with
  unknown hosting, persistent-volume, and restart behavior.
- **Reversibility:** Two-way door. The Railway project is disposable and uses
  generated spike-only credentials.

## References

- GitHub issue #1479
- Ticket N30CKR, retry-safe retro relay foundation
- [Railway volumes](https://docs.railway.com/volumes)
- [Railway volume backups](https://docs.railway.com/volumes/backups)

## Personas

- Safeword Maintainer (SWM)

## Surfaces

Affected:

- Railway-hosted relay — spec-local deployment surface

Unaffected:

- Claude Code, OpenAI Codex, and Cursor — real harness routing is deferred

## Vocabulary

- **Spike credential:** generated, disposable relay/GitHub configuration that
  cannot successfully create a production issue.
- **Restart durability:** a request identity written before a service restart
  remains authoritative afterward.

## Jobs To Be Done

### deploy-retro-relay-spike.SWM1 — Prove the relay survives real hosting

**Persona:** Safeword Maintainer (SWM)

> When I evaluate the relay foundation, I want to deploy a disposable instance
> with durable storage, so I can discover hosting gaps before production
> credentials or harness traffic depend on it.

#### deploy-retro-relay-spike.SWM1.R1 — Invalid runtime configuration never produces a deceptively healthy service

#### deploy-retro-relay-spike.SWM1.R2 — A healthy instance proves its durable store is open and ready

#### deploy-retro-relay-spike.SWM1.R3 — Restarting the hosting instance preserves accepted request identity

#### deploy-retro-relay-spike.SWM1.R4 — The spike cannot mutate production GitHub or an existing Railway project

#### deploy-retro-relay-spike.SWM1.R5 — The maintainer receives enough evidence to keep, promote, or remove the spike

## Rave Moment

skip: internal infrastructure proof

## Outcomes

- The relay starts from environment-only configuration on Railway.
- Health proves that SQLite is open at the persistent path.
- A mismatch after restart proves that an earlier request row survived.
- The instance can be torn down without affecting production systems.
- A spike report records live topology, restart proof, observed resource usage,
  limitations, promotion prerequisites, and the exact project-specific teardown
  command.

## Open Questions

- defer: A dedicated GitHub App is required before proving a successful live
  issue create; this spike deliberately proves only hosting and persistence.

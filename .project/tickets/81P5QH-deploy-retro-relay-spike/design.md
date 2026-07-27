# Design: Railway retro relay spike

**Related:** [spec.md](./spec.md) | [test-definitions.md](./test-definitions.md)

## Architecture

Add a production composition root around the existing relay library. It parses
and validates environment configuration before opening SQLite, binds the HTTP
server to an explicit host and Railway-provided port, reports unauthenticated
health only after the schema is ready, and closes the server/store/lock on
shutdown.

Railway runs one service instance with `/data` mounted from one persistent
volume. Both `relay.sqlite` and `relay.lock` live under `/data`. The deployment
uses generated spike-only credentials and a deliberately invalid GitHub App
identity, proving hosting and persistence without granting issue-writing access.

```text
Internet → Railway HTTPS → one Node process → /data/relay.sqlite
                                      └────→ /data/relay.lock
```

## Components

### Runtime configuration

**Where:** `packages/retro-relay/src/runtime-config.ts`

Parses required environment values, validates host/port/repository/IDs, decodes
32-byte encryption material, and constructs one spike credential principal.
Validation completes before durable resources are opened.

### Production runtime

**Where:** `packages/retro-relay/src/runtime.ts`

Constructs `RelayStore`, `CredentialRegistry`, `GitHubAppTokenProvider`,
`GitHubRestClient`, and `startRelayServer`. It owns graceful shutdown and emits
structured, secret-free startup/shutdown events.

The bundled executable is `dist/main.js`, launched as
`node /app/dist/main.js`. A built-image smoke starts that exact command with a
real mounted data directory, injects environment values through stdin rather
than command arguments, checks health, sends SIGTERM, and requires a clean exit.

### HTTP readiness

**Where:** `packages/retro-relay/src/http-server.ts`

`GET /healthz` requires no relay credential and returns success only while the
SQLite schema is accessible. It includes `RAILWAY_REPLICA_ID` as a non-secret
replacement identity. Existing filing and reconciliation routes retain their
authentication requirements.

### Railway deployment

**Where:** `packages/retro-relay/Dockerfile`, `railway.json`

The container builds the private workspace package and runs its production
entrypoint. Railway mounts `/data`, supplies `PORT`, terminates TLS, and runs
exactly one replica.

### Spike orchestrator

**Where:** `packages/retro-relay/scripts/railway-spike.ts`

Creates a new prefixed project, service, volume, variables, domain, deployment,
and restart proof through exact-ID Railway CLI calls. After every successful
mutation it atomically rewrites a non-secret state file under `.project/tmp/`
before continuing. That file is the sole teardown authority.

Generated credential values exist only in process memory. They enter Railway
through `railway variable set <NAME> --stdin`; values never appear in argv,
stdout, logs, state, reports, or committed files. Any detected exposure stops
the spike, rotates the affected Railway value through stdin, and records only
the variable name and rotation event.

## Key decisions

### Deploy a deliberately non-filing spike

**What:** Use generated relay/encryption keys and a syntactically valid but
non-functional GitHub App identity.

**Why:** It proves the unknown hosting and persistence behavior without creating
or borrowing a privileged GitHub App.

**Trade-off:** The spike cannot prove a successful GitHub issue creation.

### Keep SQLite on one persistent Railway volume

**What:** Mount `/data` and run exactly one replica.

**Why:** This directly matches #1479's qualified SQLite topology.

**Trade-off:** Deploys have brief downtime and no host-level redundancy. A
production multi-instance service requires PostgreSQL.

### Prove persistence through application semantics

**What:** Submit a request that durably accepts but fails before GitHub create,
restart the service, then reuse its request ID with a changed payload.

**Why:** A post-restart 409 mismatch proves the original durable row survived;
checking only for a database filename would not prove readable application
state.

**Trade-off:** This is a spike-specific black-box probe, not a production health
check.

## Error handling and constraints

- Missing, malformed, or relative durable paths fail startup.
- `PORT` must be an integer in the TCP port range.
- `HOST` must be exactly `0.0.0.0` for the hosted runtime.
- Health never includes filesystem paths, credentials, or payload content.
- SIGTERM and SIGINT stop accepting connections, close SQLite, and release the
  process lock.
- Railway remains at one replica for the entire SQLite deployment.
- Restart proof requires `RAILWAY_REPLICA_ID` to change; readiness from the
  original process cannot satisfy it.
- Hosted GitHub failure emits a secret-free
  `stage=github_installation_token` event. A real-collaborator integration test
  independently proves that this stage produces one token request and zero
  issue-create requests.

## Deferred production work

- Create and install a dedicated GitHub App.
- Route a real harness and complete a successful issue filing.
- Add the timed retry/dead-letter/compaction worker.
- Add production metrics export, alerts, SLOs, backup drills, and key rotation.

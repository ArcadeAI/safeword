# Impl Plan: Prove the retro relay on Railway

**Status:** planned

## Approach

The riskiest assumption is that one Railway process can reopen the same SQLite
state after Railway replaces its process. The cheapest decisive proof is the
live mismatch scenario: durably accept a request, record the healthy
boot identity and `RAILWAY_REPLICA_ID`, restart through an exact
service/project ID, wait up to 120 seconds for a different healthy boot
identity, then prove changed
content under that request ID still returns 409.

Proof plan and build order:

1. **RED → GREEN → REFACTOR: runtime configuration.** Table-drive every
   missing and malformed class, including `HOST`, through the public parser.
   Assert parsing fails before any data directory, database, or lock appears;
   implement only the parser needed to pass.
2. **RED → GREEN → REFACTOR: production composition root.** Exercise real
   configuration, credentials, encryption, SQLite, process lock, GitHub REST
   adapter, and HTTP listener while mocking only the GitHub network boundary.
   Prove `0.0.0.0:$PORT`, positive/fail-closed health, replica identity,
   shutdown cleanup, token-stage logging, and zero create requests.
3. **RED → GREEN → REFACTOR: built container wiring.** Build the real image
   containing `dist/main.js`; launch its `CMD` with environment supplied over
   stdin and a mounted temporary `/data`, check health, send SIGTERM, require a
   clean exit, and reopen the resulting database. This catches missing native
   SQLite binaries, broken `CMD`, wrong bind, and unclosed locks.
4. **RED → GREEN → REFACTOR: spike safety tools.** Validate Railway topology,
   exact-ID teardown preview, and report completeness/redaction. Implement the
   named `railway-spike.ts` orchestrator so every mutation immediately
   atomically records non-secret IDs before the next mutation.
5. **Live Railway proof (E2E):** record pre-existing project IDs; create a new
   prefixed project; atomically record its ID; add and record the service and
   `/data` volume; generate secrets in memory and pass each value only to
   `railway variable set <NAME> --stdin`; generate a public domain; deploy; and
   run the hosted health/non-filing/restart/mismatch sequence. Require a changed
   process boot identity; poll state/health without fixed sleeps. On interruption,
   the state file supports exact-ID inspection and teardown.
6. **Evidence:** capture live resource IDs, deployment/replica IDs, topology, summarized
   CPU/memory/volume metrics, Railway pricing/docs provenance, limitations,
   production GitHub App prerequisites, and exact dry-run teardown in
   `spike-report.md`. Validate the report contains no configured secret values.
   If exposure is detected, rotate that Railway variable through stdin before
   stopping and record only the variable name.

Affected surface proof: `Railway-hosted relay` is covered by the live E2E lane.
Local tests provide fast deterministic failure localization but cannot replace
that lane.

The feature stays one ticket despite six named components because none delivers
independent value: runtime, container, volume, smoke validator, teardown preview,
and report are one coupled disposable deployment proof.

## Decisions

| Decision | Choice | Alternatives considered | Rejected because |
| --- | --- | --- | --- |
| Railway build | Repository-context Dockerfile with Node 22 runtime | Railpack; package-directory upload | Docker makes the native SQLite runtime and monorepo build context explicit; package-only upload loses root workspace files |
| Durable mount | One `/data` volume, one replica | Ephemeral filesystem; multiple volumes/replicas; PostgreSQL | Ephemeral storage cannot prove restart durability; multiple SQLite writers violate #1479; PostgreSQL is beyond the spike |
| Durability oracle | Post-restart same-ID/different-payload 409 | Filename existence; downloading a live database; successful GitHub create | The mismatch is application-level proof of readable durable state without copying WAL files or granting GitHub privileges |
| GitHub identity | Fresh RSA key with an uninstalled numeric App ID | Real production App; user token; mocked GitHub in live deploy | A real credential expands blast radius; user tokens violate the server credential model; the hosted network failure is part of the proof |
| Provisioning | Railway CLI with exact JSON IDs and a new prefixed project | Reuse an existing project; dashboard-only setup | Exact IDs make targeting and teardown reviewable; reuse risks changing unrelated services |
| Teardown | Dry-run validator by default; explicit execution deferred | Automatic teardown; name-only delete | The user asked to get it running; automatic removal defeats that goal, while name-only targeting is unsafe |
| Secret injection | Generate in one orchestrator process and send values only over child stdin | CLI argv; dotenv/temp files; report/state persistence | All alternatives expose values to process listings, tool logs, filesystem, or commits |
| Restart oracle | Generate a process boot UUID and require it to change before the post-restart 409; retain `RAILWAY_REPLICA_ID` as hosting identity | Health-only poll; require Railway replica ID to change | An unchanged healthy process could otherwise produce a false pass; live evidence showed Railway keeps `RAILWAY_REPLICA_ID` stable across an in-place service restart |

Evidence consulted:

- Railway config-as-code supports Dockerfile paths, health checks, restart
  policies, and deployment teardown settings:
  <https://docs.railway.com/config-as-code/reference>
- Railway requires apps to bind `0.0.0.0:$PORT` and treats a 200 health response
  as deployment readiness:
  <https://docs.railway.com/deployments/healthchecks>
- Railway volumes persist runtime files and support backups:
  <https://docs.railway.com/volumes> and
  <https://docs.railway.com/volumes/backups>
- The installed `better-sqlite3` 13.0.1 package supplies Node LTS prebuilt
  binaries and recommends WAL mode.
- Railway provides `RAILWAY_REPLICA_ID` to identify a deployment replica:
  <https://docs.railway.com/variables/reference>

## Arch alignment

- Honors `ARCHITECTURE.md` **Retro relay boundary**: SQLite WAL is supported
  only for one active process on one host; multi-host deployment requires
  PostgreSQL.
- Honors schema-as-source and private-package boundaries: deployment code stays
  under `packages/retro-relay` and does not enter CLI templates.
- Honors server-held GitHub App credentials and raw REST marker authority.

## Known deviations

- The spike uses an uninstalled GitHub App identity, so GitHub token acquisition
  intentionally fails. This is acceptable because successful issue filing was
  explicitly excluded; the purpose is hosting and persistence proof.
- Railway health checks are deployment-time readiness, not continuous
  monitoring. Continuous uptime monitoring is deferred with production SLOs.

## Doc impact

Internal-only spike: update `packages/retro-relay/README.md` with the production
entrypoint contract and link the ticket report. Do not advertise the relay in
customer CLI or website documentation until a real GitHub App and harness route
exist.

## Assessment triggers

- A second replica, network filesystem, or multi-region requirement triggers
  PostgreSQL before scaling.
- A successful production filing requires a dedicated installed GitHub App,
  credential rotation, and #1479 readiness review.
- Sustained CPU/memory/volume usage above the smallest Railway service envelope
  triggers a sizing review.
- Any secret in logs, reports, deployment output, or durable plaintext blocks
  promotion and requires rotation.

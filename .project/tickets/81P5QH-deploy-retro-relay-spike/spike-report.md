# Railway retro relay spike report

## Outcome

The disposable relay is running at
<https://retro-relay-production.up.railway.app>. It is intentionally not wired
to a real GitHub App or any harness, so it cannot file production issues.

The spike passed its decisive durability check:

1. the hosted relay accepted request identity `railway-boot-restart-proof`
   before the deliberately invalid GitHub App failed at installation-token
   acquisition;
2. Railway restarted the exact service;
3. health returned a different process boot ID while keeping the same Railway
   replica ID;
4. changed content under the same request identity returned HTTP 409.

This proves the replacement process reopened the durable SQLite identity from
the mounted volume. It also disproves the planning assumption that
`RAILWAY_REPLICA_ID` changes on an in-place restart; a per-process boot UUID is
the correct restart oracle.

## Live topology

| Resource | Evidence |
| --- | --- |
| Project | `safeword-relay-spike-0726` (`5b713344-9f5b-4e9e-bc6a-8e959ecd20a9`) |
| Environment | `production` (`37a73eaf-9023-4379-9af0-52f76c6fbe4b`) |
| Service | `retro-relay` (`bd3f0223-d88d-4594-8f99-9ffdb29f3f62`) |
| Deployment | `13c67f9c-4041-45c8-9b51-c1c4c7d65980`, status `SUCCESS` |
| Replicas | one configured, one running, zero crashed |
| Volume | `retro-relay-volume` (`511eaf85-301d-4b8a-9c25-07a6e397b502`) mounted at `/data` |
| Health | schema version 1; HTTP 200 |
| Restart | boot ID changed; Railway replica ID remained stable |
| Durability | same identity plus changed payload returned HTTP 409 after restart |

The built-image smoke also passed locally on ARM: the real image `CMD` loaded a
source-built `better-sqlite3` binary, opened a mounted database, returned
health, handled SIGTERM with exit code 0, and left the database durable.

## Non-filing evidence

The live request returned HTTP 503 after a secret-free log event with
`stage=github_installation_token`. The configured App ID and installation ID
are deliberately uninstalled placeholders, so GitHub could not mint a token
and the issue-create boundary was unreachable. The real-collaborator
integration suite separately asserts one token request and zero issue-create
requests for this failure.

No production GitHub credential, issue, or existing Railway project was used.

## Resource and cost snapshot

Railway's first-hour summary reported:

- average CPU `0.000353 vCPU`, maximum `0.009782 vCPU`;
- average memory `2.97 MB`, maximum `19.95 MB`, current `15.53 MB`;
- 66 HTTP requests with p50/p95 of `8 ms`;
- volume-reported current usage about `1.08 GB` of a `50 GB` limit.

The volume number is mostly filesystem metadata: Railway documents that a new
volume reserves approximately 2–3% for metadata. At current published rates,
Railway charges `$20/vCPU-month`, `$10/GB-month`, `$0.15/GB-month` for volume
storage, and `$0.05/GB` egress, plus the account plan minimum. This short,
mostly-idle sample suggests the relay process itself is lightweight, but it is
not a production cost forecast. Railway recommends observing a workload for a
week before extrapolating cost.

Pricing provenance:

- <https://docs.railway.com/pricing>
- <https://docs.railway.com/volumes/reference>
- <https://docs.railway.com/pricing/faqs>

## Limitations and promotion gates

- Use exactly one replica while SQLite is the store. Multiple writers require
  PostgreSQL.
- Install a dedicated GitHub App with repository-scoped issue write
  permission, rotate all disposable credentials, and rerun successful-filing
  collaborator tests before production use.
- Wire real harness spools only after their transport-independent request
  identity contract is enabled.
- Raw GitHub REST bodies remain the sole marker authority; sanitized MCP reads
  must never make duplicate decisions.
- Add continuous monitoring, backups, retry/dead-letter maintenance, and an
  explicit resource limit before production promotion.
- GitHub issue #1495 is a readiness gate only if production wiring reuses its
  client credential helpers.
- GitHub issue #834 is not superseded: #1479 supplies durable server-side
  filing semantics, while #834 still owns its distinct harness integration
  and fallback-retirement work.

## Teardown preview

The service remains running because the user asked to get the spike up.
Teardown must target the exact recorded disposable project ID:

```sh
railway project delete \
  --project 5b713344-9f5b-4e9e-bc6a-8e959ecd20a9 \
  --yes \
  --json
```

Before executing, verify the project name is exactly
`safeword-relay-spike-0726` and the service ID is exactly
`bd3f0223-d88d-4594-8f99-9ffdb29f3f62`. This report is a preview only; no
teardown was executed.

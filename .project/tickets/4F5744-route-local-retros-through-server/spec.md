# Spec: Route local retros through the durable server without customer setup

<!-- safeword:inspiration-contract:v1 -->

## Intent

Make SafeWord's local retrospective path invisible and dependable: customers
install SafeWord once, while eligible sanitized findings reach durable server
ownership without customer credentials or direct agent-side GitHub writes.

## Intake Brief

- **Requested by:** Alex Salazar, product owner
- **Cost of inaction:** Direct GitHub filing remains dependent on each agent's credentials and permissions, while the production collector and relay cannot become the dependable default path they were built to provide.
- **Reversibility:** One-way operational cutover guarded as a two-stage rollout; the routing change is reversible, but disabling the established recovery path without production proof could lose customer feedback.

## References

- [GitHub issue #3514](https://github.com/ArcadeAI/safeword/issues/3514)
- [Local batch delivery #3477](https://github.com/ArcadeAI/safeword/issues/3477)
- [Claude Cloud carrier #3476](https://github.com/ArcadeAI/safeword/issues/3476)

## Personas

- Non-Technical Builder (NTB)
- Technical Builder (TBU)
- Safeword Maintainer (SWM)

## Surfaces

Affected:

- Claude Code
- OpenAI Codex
- Cursor
- Safeword CLI
- Retro Filer
- Railway Public Retro Collector
- Railway Hosted Relay

Unaffected:

- OpenCode — its current plugin observes stop events but does not dispatch retrospective extraction or filing.
- Claude Code Cloud — cloud transport remains owned by #3476.
- OpenAI Codex Cloud — this ticket covers persistent local runtimes only.
- Cursor Cloud Agents — this ticket covers persistent local runtimes only.

## Vocabulary

- **Collector acceptance:** the public collector has durably stored the sanitized request in the server-owned queue and assumed responsibility for retaining it until a private server-side filing worker claims it. This is the only acknowledgement that permits local recovery data to be released; it guarantees durable ownership, not a filing-time SLA.
- **Filing ownership:** the relay has durably accepted the worker's mapped filing request under the collector request identity and now owns retry, duplicate detection, ambiguity recovery, and terminal disposition. A collector claim before that acceptance is only a renewable lease, never an ownership transfer.
- **Terminal disposition:** filed, exact duplicate, rejected, or dead-letter after the bounded server retry policy. A queued, retryable, or ambiguous record is not terminal.
- **Sanitized finding:** approved finding content plus operational source metadata needed to route and diagnose delivery. It excludes transcript text, prompts, tool output, file contents, secrets, and user identity; repository identity, session scope, harness and agent versions, SafeWord CLI version, model, host class, and operating-system family may be included and are disclosed by installation documentation.
- **Server-owned envelope:** envelope `v3`, emitted only by clients that have already disabled direct filing for that captured source. Earlier envelope versions remain accepted as inert quarantine and are never leased by the filing worker.

## Product Inspiration

<!-- prettier-ignore -->
| Reference | Checked on | Source version / edition | Customer-value evidence | Principle to borrow | Non-copy boundary | Decision impact |
| --- | --- | --- | --- | --- | --- | --- |
| [Sentry DSN and client transport](https://www.sentry.help/en/articles/13964441-what-is-a-sentry-dsn) | 2026-08-29 | Current hosted SDK documentation | A client receives a destination identifier at integration time; its modern DSN uses a public key rather than an account secret, and mobile SDKs can cache events until connectivity returns | Separate write-only ingestion identity from privileged read and management authority; retain events locally across temporary transport failure | SafeWord cannot require each customer to create or copy a project key, and unlike disposable telemetry it promises one durable request identity and duplicate-safe GitHub filing | Keep public intake free of customer credentials and filing authority, keep GitHub authority server-side, and make durable local spooling plus opaque receipts the cutover contract rather than embedding a shared client credential |

## Jobs To Be Done

### local-retro-cutover.NTB1 — Contribute feedback without setup

**Persona:** Non-Technical Builder (NTB)

> When SafeWord notices a useful retrospective finding in my local agent
> session, I want it handled quietly without registration, credentials, or
> configuration, so I can improve SafeWord without learning or operating its
> reporting system.

#### local-retro-cutover.NTB1.R1 — An ordinary local installation can submit eligible sanitized retros without registration, credentials, environment variables, or manual configuration

#### local-retro-cutover.NTB1.R2 — All retrospective transport in one session-stop event is silent and shares one 750 ms drain budget whether the server accepts, rejects, duplicates, times out, or cannot be reached; every attempt derives its deadline from the remaining budget

#### local-retro-cutover.NTB1.R3 — The existing project-level opt-out remains authoritative, and installation documentation discloses the sanitized feedback path without requiring an onboarding step

### local-retro-cutover.TBU1 — Keep delivery recoverable and inspectable

**Persona:** Technical Builder (TBU)

> When a local retrospective is delivered through SafeWord's server, I want
> retries to preserve one identity and failures to remain recoverable without
> direct agent-side GitHub authority, so I can trust that automation neither
> loses feedback nor creates duplicate issues.

#### local-retro-cutover.TBU1.R1 — One captured transcript window keeps one durable request identity and immutable envelope across retries, lost receipts, and repeated extraction; genuinely later windows receive distinct source scopes

#### local-retro-cutover.TBU1.R2 — Local recovery transfers only on durable collector acceptance of a server-owned `v3` envelope; legacy rows stay inert, direct filing never resumes, and typed terminal rejection remains locally diagnosable

#### local-retro-cutover.TBU1.R3 — Duplicate suppression requires a complete scan of raw GitHub REST bodies for the exact request and authority markers; sanitized reads, similarity, or a lone marker never authorize suppression

#### local-retro-cutover.TBU1.R4 — Every accepted request is relay-compatible, excludes user identity, and stays within the shared serialized payload bound; invalid intake is rejected before storage

#### local-retro-cutover.TBU1.R5 — Server ownership survives worker and network failure through reclaimable leases, stable server-derived digests, retained ambiguity payloads, and exactly-once relay filing

#### local-retro-cutover.TBU1.R6 — Routine lifecycle inspection is payload-free; only separately authorized and audited worker or break-glass access can read stored finding payloads

#### local-retro-cutover.TBU1.R7 — Global cutover preserves drafts already owned by direct filing while every newly captured finding uses only the server-owned route

### local-retro-cutover.SWM1 — Cut over only on production proof

**Persona:** Safeword Maintainer (SWM)

> When changing the default retrospective route, I want fresh evidence that
> every supported local harness reaches durable server ownership and eventual
> filing, so I can retire direct local GitHub filing without guessing.

#### local-retro-cutover.SWM1.R1 — A per-source maintainer canary proves real build-attested Claude Code, Codex, and Cursor requests through terminal production filing before the global default disables direct filing

#### local-retro-cutover.SWM1.R2 — Readiness uses truthful runtime evidence: Cursor's managed cloud metadata is excluded, `unknown` cannot prove local readiness, and evidence ancestry binds implementation, harness artifact, server receipts, and running build

#### local-retro-cutover.SWM1.R3 — Fault injection proves accepted work remains visible and files exactly once after worker outage, claim-before-relay crash, retry exhaustion, or ambiguous GitHub creation

#### local-retro-cutover.SWM1.R4 — Public intake and automatic filing have configurable global and per-project bounds; admitted work drains oldest-first or, after 24 hours of quota blocking, reaches an alerted terminal state without risking already accepted records

#### local-retro-cutover.SWM1.R5 — The readiness evaluator rejects missing harness proof, indeterminate host provenance, mismatched build ancestry, and fault artifacts without authoritative recovery evidence

## Rave Moment

skip: invisible infrastructure; correctness and quietness are table stakes.

## Outcomes

- A newly installed local Claude Code, Codex, or Cursor project can produce one eligible finding that reaches collector acceptance and eventual GitHub filing without customer credentials or action.
- Cursor reaches collector acceptance while truthfully reporting the local host class; no harness may pass readiness by weakening or falsifying its source metadata.
- Replaying the same captured request across retries or harnesses produces one server-owned lifecycle and at most one GitHub issue.
- Network failure before collector acceptance leaves the exact local recovery record intact; collector acceptance prevents agent-side GitHub fallback.
- Public encoding bounds each finding's JSON-serialized bytes to 4 KiB after escaping and reserves 16 KiB for metadata and structure, so the existing 50-finding ceiling keeps a complete batch below the 256 KiB client-and-collector limit without dropping a finding. Transport-invalid requests remain in the existing project-local retro spool with the same immutable bytes and identity until accepted; byte conflicts preserve both the authoritative server record and the local diagnostic copy. This ticket does not split batches or mint replacement identities.
- A disabled collection preference produces no outbound submission and no server record.
- The cutover switch cannot enable unless production evidence proves the three current local filing carriers and server-side transfer through terminal filing.
- Drafts captured before cutover may finish through the established direct-filing path; newly captured retros never enter that path after cutover.
- A full worker outage leaves accepted records durably queued and operator-visible; recovery drains the same records exactly once without customer action.
- A timeout after server acceptance retries the exact persisted request identity and bytes, converging on the original receipt rather than creating a second lifecycle.
- Legacy collector rows and legacy envelope versions remain inert; the worker leases only server-owned envelopes created after the new client disabled its direct path.
- Anonymous intake cannot cause unbounded GitHub creation: filing quotas contain the maximum rate while preserving excess records for later drain.
- Maintainer canaries prove the real `v3` path one source at a time without enabling the global default or allowing a parallel direct create.

## Open Questions

defer: Retention duration and cleanup policy are operational follow-up work, not an initial cutover gate.
defer: The no-user-identity guarantee is forward-only for newly admitted records; handling previously stored v1 rows belongs with retention follow-up.
defer: No shipped client emits `userIdentity`; legacy v1 records that already contain it stay inert and are not worker-eligible.
defer: Anonymous project-identity attribution abuse is contained by the launch filing quotas; stronger ownership proof is follow-up work and not an initial cutover gate.

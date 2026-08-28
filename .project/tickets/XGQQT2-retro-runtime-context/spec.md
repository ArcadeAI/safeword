# Spec: Attach useful runtime context to retros without signup

<!-- safeword:inspiration-contract:v1 -->

## Intent

Give Safeword maintainers enough runtime context to distinguish where a retro
occurred without asking builders to register, configure telemetry, or wait for
metadata discovery. Context is attached only to Safeword's already-sanitized
retro finding; it never widens transcript or customer-code egress.

## Intake Brief

- **Requested by:** Alex Salazar, project owner
- **Cost of inaction:** Cursor findings lack parity with Claude/Codex, while new producers continue emitting email-derived identity, overclaiming `local` execution, and accepting unbounded optional values.
- **Reversibility:** One-way door at the public envelope and stored-data boundary; optional fields can be removed later, but shipped identifiers and semantics must remain interpretable.

## References

- [GitHub issue #3429](https://github.com/ArcadeAI/safeword/issues/3429)
- GitHub issue #1479 and the durable retro relay it introduced

## Personas

- Safeword Maintainer (SWM)
- Technical Builder (TBU)
- Non-Technical Builder (NTB)

## Surfaces

Affected:

- Safeword CLI
- Claude Code
- OpenAI Codex
- Cursor
- Railway Public Retro Collector

Unaffected:

- Railway Hosted Relay — authenticated private filing stays disabled and its durable state machine does not change in this slice
- Exact Claude Code and OpenAI Codex cloud classification, plus cloud-carrier readiness — follow-up issue #3430

## Vocabulary

- **Project identity:** A random GUID generated locally by Safeword setup and persisted in project configuration; it is not a user account, device fingerprint, or server-issued credential.
- **Runtime context:** Bounded, allowlisted metadata derived at filing time and omitted field-by-field when unavailable.

## Product Inspiration

<!-- prettier-ignore -->
| Reference | Checked on | Source version / edition | Customer-value evidence | Principle to borrow | Non-copy boundary | Decision impact |
| --- | --- | --- | --- | --- | --- | --- |
| [PostHog Identify specification](https://github.com/PostHog/sdk-specs/blob/main/openspec/specs/identify/spec.md) | 2026-08-27 | main | Client SDKs persist an anonymous distinct ID, can later associate it with an identified user, and specify silent drops rather than throwing into the host application. | Start with an opaque locally generated identity; identity enrichment is optional and lifecycle-explicit. | Do not create person profiles, cross-project user tracking, or an anonymous-to-account merge system. | Keep one project-scoped GUID and optional observed actor context; never require a user identity to submit. |
| [OpenTelemetry service resource conventions](https://opentelemetry.io/docs/specs/semconv/registry/attributes/service/) and [resource guidance](https://opentelemetry.io/docs/concepts/resources/) | 2026-08-27 | semantic conventions 1.44.0 | Opaque random UUIDs are recommended when only instance distinction is needed; runtime, OS, service, and SDK versions are modeled as bounded resource attributes, while underlying machine data is treated as confidential. | Separate stable opaque identity from descriptive runtime attributes and prefer standard, bounded names. | Do not collect machine IDs, hostnames, IP addresses, MAC addresses, or provider resource IDs. | Model runtime context as a flat versioned object whose optional fields are independently derived and omitted. |
| [Sentry JavaScript SDK migration guidance](https://github.com/getsentry/sentry-javascript/blob/develop/MIGRATION.md) | 2026-08-27 | JavaScript SDK v11 migration | Sentry moved from a broad PII switch to category-level data collection because context classes have different privacy consequences. | Allowlists should be field-specific; identity and content-bearing categories need stricter treatment than low-cardinality runtime facts. | Do not adopt Sentry's broad default collection, request/body capture, or generalized observability surface. | Permit only enumerated metadata fields; exclude transcripts, source, command arguments, hostnames, and arbitrary environment variables. |

The transferable product principle is **anonymous first, context by bounded
resource attributes, and enrichment only from already-present signals**. The
smallest form extends the existing closed `source` object on the retro envelope,
not public issue prose, a duplicate `context` authority, or a parallel analytics
event stream.

## Jobs To Be Done

### retro-runtime-context.SWM1 — Understand where Safeword friction occurs

**Persona:** Safeword Maintainer (SWM)

> When I receive a sanitized retro, I want bounded runtime and project context
> that was available without user interaction, so I can group, reproduce, and
> prioritize friction without asking the builder to reconstruct their session.

#### retro-runtime-context.SWM1.R1 — Every project keeps one opaque locally generated identity across installs and upgrades

#### retro-runtime-context.SWM1.R2 — Every harness describes the same bounded runtime concepts through one versioned context contract

### retro-runtime-context.TBU1 — Contribute useful context without telemetry setup

**Persona:** Technical Builder (TBU)

> When Safeword reports its own friction from my project, I want useful context
> attached automatically without registration, prompts, or customer content, so
> I can help improve Safeword without adding work or disclosure risk.

#### retro-runtime-context.TBU1.R1 — Runtime context contains only explicitly allowlisted facts and never transcript, source, machine, or arbitrary environment content

### retro-runtime-context.NTB1 — Keep retrospective reporting invisible

**Persona:** Non-Technical Builder (NTB)

> When Safeword cannot discover some runtime context, I want my session and
> retro capture to continue silently, so missing telemetry never becomes a task
> I must understand or fix.

#### retro-runtime-context.NTB1.R1 — Context discovery never disrupts the user or existing recovery

## Rave Moment

### retro-runtime-context — Useful context with nothing to set up

- **Moment:** A maintainer opens a retro and sees the same privacy-bounded project, repository, harness, version, model, and OS facts across supported harnesses without builder setup; ambiguous execution class is honestly `unknown`.
- **Beats:** The expected support loop of asking which machine, harness, version, and environment reproduced the friction.
- **They'd say:** "I installed SafeWord once, and its retros arrive with the useful context already attached."

## Outcomes

- A project receives a stable random GUID locally with no registration or server dependency.
- Claude, Codex, and Cursor attach the same optional context shape to sanitized retro submissions without guessing ambiguous execution class.
- Maintainers retain existing Claude/Codex grouping and gain Cursor project, repository, harness, SafeWord CLI version, and OS context. Cursor exposes no supported agent-version or model signal today; all current producers omit plugin version until both hosts expose a trustworthy carrier. Exact runtime-class grouping remains #3430.
- Email and actor identity are excluded; cloud-safe actor attribution and exact Claude/Codex cloud classification remain #3430.
- Missing, malformed, or unavailable context has no observable effect on the builder's session or retro delivery.

## Contract Decisions

- Keep envelope `version: "v1"` and widen its existing closed `source` authority for Cursor. Producer-side optional enrichment is bounded, while the collector preserves the released v1 value rules. A second `context` object or schema version would add authority without local user value.
- `harness` is `claude-code`, `codex`, or `cursor`. Collector validation uses one harness/host-class matrix: `hostClass: "local"` is accepted for `claude-code` and `codex`, while `hostClass: "unknown"` is accepted for all three. No producer-version gate is involved. None of the three harnesses can prove local/cloud execution without registration or host attestation. Follow-up issue #3430 owns exact classification; this slice never guesses it.
- Git-config email, `GITHUB_ACTOR`, and active identity discovery are prohibited in the local producer. `GITHUB_ACTOR` belongs to GitHub Actions/cloud classification and is deferred with that carrier to #3430.
- Harness version and model facts come only from the harness's existing allowlisted runtime signals. Repository comes only from a credential-stripped Git origin on the explicit public-host allowlist (`github.com`, `gitlab.com`); hosts are lowercase, GitHub owner/repository paths are also lowercase, and GitLab paths preserve case. Local, file, malformed, and every non-allowlisted remote are omitted. SafeWord CLI version comes from the running package; plugin version is omitted until both hosts expose a trustworthy runtime carrier. OS family comes from the runtime's standard platform signal. Optional strings containing control characters or exceeding 256 UTF-8 bytes are omitted independently.
- The collector widens the closed v1 harness allowlist for Cursor without tightening released optional-value rules, returning every accepted envelope as its original canonical bytes. The new producer no longer emits legacy `userIdentity`; the collector continues accepting it for installed clients. The collector does not normalize or rewrite stored submissions.
- `sessionScope` remains derived only from harness, project UUID, and session ID. Runtime metadata never changes duplicate identity.
- The local exclusive session claim suppresses a concurrent or completed second attempt before the collector; a failed handoff releases its uncommitted claim so a later invocation may retry. Collector request/session constraints remain defense in depth, not a second metadata authority.
- The existing `retro run` CLI remains the single submission boundary. Every new producer reports `hostClass: "unknown"`. Existing `CLAUDE_CODE_REMOTE_SESSION_ID` evidence continues to deny Claude delivery; it does not suppress Codex or Cursor. Cursor public egress additionally requires the hook-stashed transcript, conversation identity, and project directory to match the current invocation. Missing or mismatched identity and runtimes with no runnable public carrier keep the existing recovery behavior—retro capture itself remains nonblocking and silent.
- Optional enrichment uses only subprocess-free synchronous local reads inside the existing preparation flow. Each unavailable or failed input omits only its own value. Private recovery is persisted before the public attempt; that attempt uses one two-second abort timer and adds no retry, backoff, worker, or background task.

## Open Questions

None.

# Spec: Send enriched retros from Claude Cloud

<!-- safeword:inspiration-contract:v1 -->

## Intent

Let an eligible Claude Cloud session hand all of its sanitized retrospective
findings to the same collector used by local SafeWord, without signup,
narration, or a cloud-only telemetry path.

## Intake Brief

- **Requested by:** Alex, as the first carrier-gated follow-up to GitHub issue
  #3429 and the local public-retro launch.
- **Cost of inaction:** useful findings produced in Claude Cloud remain suppressed
  and disappear when the ephemeral workspace is reclaimed.
- **Reversibility:** two-way door; the host allowlist can disable this carrier
  without changing the public envelope, collector schema, or stored records.

## References

- GitHub issue #3430 is the canonical tracker contract.
- Ticket `3F5Z6P-send-cloud-retros-silently` owns the shared local envelope,
  transport, collector, and explicit unsupported-host gate.
- GitHub issue #3429 owns the source-profile allowlist and zero-signup project
  identity now reused here.

## Product Inspiration

<!-- prettier-ignore -->
| Reference | Checked on | Source version / edition | Customer-value evidence | Principle to borrow | Non-copy boundary | Decision impact |
| --- | --- | --- | --- | --- | --- | --- |
| [Sentry JavaScript SDK for AWS Lambda](https://docs.sentry.io/platforms/javascript/guides/aws-lambda/install/cjs-layer__v7.x/) | 2026-08-28 | Current official serverless guidance | Sentry wraps the ephemeral function lifecycle so reporting completes through the host boundary without making application authors manually operate each event. | Attach best-effort delivery to the real ephemeral-runtime lifecycle and keep it bounded by that lifecycle. | Do not copy Sentry's SDK, DSN setup, broad event collection, environment configuration, or data model. | retained: use Claude Cloud's existing synchronous Stop carrier and the already-built narrow public-retro contract instead of adding MCP, scheduling, or another service. |

## Personas

- Non-Technical Builder (NTB)
- Safeword Maintainer (SWM)

## Surfaces

Affected:

- Claude Code Cloud's Anthropic-managed remote workspaces. Claude Code GitHub
  Actions remains disabled until its runtime exposes equivalent native evidence.
- Claude Code, whose silent delivery semantics stay the same while its wire
  envelope advances to shared v2
- Railway Public Retro Collector
- GitHub Actions Execution Sandbox, where `GITHUB_ACTIONS=true` deliberately
  suppresses the public route entirely rather than falling back to local
  `unknown` provenance

Unaffected:

- Local OpenAI Codex behavior is unchanged.
- OpenAI Codex Cloud and Cursor Cloud Agents remain disabled pending their own
  real-carrier evidence.
- Private authenticated relay filing remains physically and behaviorally
  separate.

## Jobs To Be Done

### send-enriched-retros-from-claude-cloud.NTB1 — Finish cloud work without telemetry chores

**Persona:** Non-Technical Builder (NTB)

> When my meaningful Claude Cloud session ends, I want SafeWord to preserve its
> sanitized feedback quietly, so I can finish the task without learning or
> operating a telemetry system.

#### send-enriched-retros-from-claude-cloud.NTB1.R1 — Each eligible Claude Cloud session yields at most one recorded public retro silently

#### send-enriched-retros-from-claude-cloud.NTB1.R2 — Public delivery never prevents completion, narrates, or consumes existing recovery

### send-enriched-retros-from-claude-cloud.SWM1 — Trust cloud provenance without creating another pipeline

**Persona:** Safeword Maintainer (SWM)

> When Claude Cloud submits a public retro, I want its host provenance bound by
> the installed carrier and its delivery contract shared with local runtimes,
> so the record is useful without trusting payload claims or maintaining a
> cloud-only system.

#### send-enriched-retros-from-claude-cloud.SWM1.R1 — The carrier binds Claude Code and cloud host identity independently of payload claims

#### send-enriched-retros-from-claude-cloud.SWM1.R2 — New senders use one bounded shared batch while the collector remains backward compatible

#### send-enriched-retros-from-claude-cloud.SWM1.R3 — Readiness requires real cloud evidence with a matching durable receipt

## Rave Moment

skip: table-stakes. The intended experience is that nothing interrupts or asks
the builder to operate it.

## Scope

- Enable the existing Claude Code Stop carrier for eligible Claude Cloud public
  retros.
- Bind `claude-code` and `cloud` at the installed carrier boundary only when
  `CLAUDE_CODE_REMOTE` is exactly `true` and
  `CLAUDE_CODE_REMOTE_SESSION_ID` is non-empty. Fail closed with no public route
  when only one value is valid, either is malformed, or `GITHUB_ACTIONS` is
  exactly `true` (regardless of the pair). Both values absent in an ordinary
  local Claude session retain its released `unknown` host class.
- Add a shared v2 envelope whose exact top-level fields are `version`,
  `findings`, `source`, and `sessionScope`. `findings` is the non-empty ordered
  array of rendered sanitized finding strings.
- Emit one canonical request, one transport-independent request identity, and
  one receipt per session. Preserve extraction order; do not pick one finding
  or make per-finding requests.
- Apply the existing 65,536-byte limit to the entire canonical request. Zero
  valid findings and oversized batches make no public attempt and retain the
  existing private or spool recovery behavior.
- Keep accepting the released v1 single-finding envelope; new clients emit v2.
- Reuse the existing source allowlist, project identity, HTTPS transport, and
  public collector semantics.
- Prove silent bounded behavior, once-only delivery, failure containment, and
  unchanged private/spool recovery through real collaborator wiring.
- Require a live Claude Cloud receipt before activation.

Readiness is a human release decision backed by checked evidence recorded in
this ticket's work log and the manual evidence scenarios below; adding a runtime
feature-flag or readiness-evaluator subsystem is out of scope.

## Out of Scope

- Claude Code GitHub Actions, Codex Cloud, or Cursor Cloud enablement before
  their carriers are proven.
- Generic cloud inference from CI or arbitrary environment variables.
- Cloud-only envelopes, services, credentials, registration, queues, retries,
  MCP transport, or scheduled work.
- Retention, deletion, tombstones, abuse controls, actor/email collection, or
  other operational policy.
- Changes to private filing or the raw REST body duplicate authority. Local
  Claude intentionally begins publishing all eligible sanitized findings in
  one v2 batch instead of suppressing multi-finding sessions; its opt-out,
  silence, timeout, and recovery behavior remain unchanged.

Shared collector rejection, malformed-receipt, and timeout semantics remain
owned by ticket `3F5Z6P-send-cloud-retros-silently`; this feature exercises the
inherited non-responsive path once at the new carrier boundary rather than
duplicating that transport matrix.

## Done When

- An eligible Claude Cloud Stop run makes one public attempt and records a valid
  collector receipt with no user-facing output.
- The installed carrier—not payload data—binds harness `claude-code` and host
  class `cloud`.
- Every non-success path exits successfully, stays silent, and preserves existing
  private or spool behavior.
- Local and Claude Cloud new senders use the same canonical v2 batch and
  transport-independent request identity semantics; the collector still
  accepts v1 senders.
- Real Claude Cloud evidence proves carrier execution, outbound access, collector
  acceptance, and a matching durable receipt before enablement is considered
  ready.

## Open Questions

None.

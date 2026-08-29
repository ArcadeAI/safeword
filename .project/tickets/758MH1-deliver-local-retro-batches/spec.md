# Spec: Deliver every eligible local retro finding in one bounded batch

<!-- safeword:inspiration-contract:v1 -->

## Intent

Ensure an opted-in local SafeWord session submits every eligible sanitized
finding once. The current exactly-one guard silently suppresses public delivery
whenever extraction produces the multi-finding result it was designed to find.

## Intake Brief

- **Requested by:** Project maintainer through GitHub issue #3477
- **Cost of inaction:** Local multi-finding sessions continue to make no public
  attempt, leaving upstream maintainers with incomplete evidence while the
  behavior appears successful to builders.
- **Reversibility:** Two-way door. New clients can stop emitting v2 while the
  collector continues accepting released v1 requests; no stored-row migration
  is required.

## References

- [GitHub issue #3477](https://github.com/ArcadeAI/safeword/issues/3477)
- #3430, where the local correctness defect was isolated from cloud carrier
  readiness

## Personas

- Safeword Maintainer (SWM)
- Technical Builder (TBU)
- Non-Technical Builder (NTB)

skip: Delivery diagnostics and a verbose/status surface for TBU are intentionally out of scope; this ticket preserves the existing silent carrier contract for every persona.

## Surfaces

Affected:

- Claude Code
- OpenAI Codex
- Cursor
- Safeword CLI
- Railway Public Retro Collector

Unaffected:

- Claude Code Cloud — zero-configuration carrier readiness is tracked by #3476
- OpenAI Codex Cloud — no proven native completion carrier
- Cursor Cloud Agents — no proven native completion carrier
- Retro Filer — private recovery and acknowledgement semantics remain unchanged

## Vocabulary

- **Batch:** The ordered set of valid sanitized findings produced by one local
  session and serialized into one bounded public request.
- **Raw-body authority:** Duplicate and conflict decisions compare the exact
  REST bytes accepted by the collector, never sanitized operator output.

## Product Inspiration

<!-- prettier-ignore -->
| Reference | Checked on | Source version / edition | Customer-value evidence | Principle to borrow | Non-copy boundary | Decision impact |
| --- | --- | --- | --- | --- | --- | --- |
| https://opentelemetry.io/docs/specs/otel/protocol/exporter/ | 2026-08-29 | Stable OTLP exporter specification | Treats an export as a bounded batch with explicit maximum request size and timeout rather than an unbounded per-item loop | Send one bounded session batch and honor the existing deadline | Do not copy OTLP schemas protocols queues retries SDK configuration or dependencies | Retained the existing synchronous transport and deadline while replacing the exactly-one guard with one all-or-nothing bounded batch |

## Jobs To Be Done

### deliver-local-retro-batches.SWM1 — Receive complete local session evidence

**Persona:** Safeword Maintainer (SWM)

> When an opted-in local session produces several eligible findings, I want all
> of them recorded as one durable submission, so I can improve SafeWord from the
> complete session evidence without duplicates.

#### deliver-local-retro-batches.SWM1.R1 — Every valid sanitized finding from one local session is recorded in original order as one bounded submission

#### deliver-local-retro-batches.SWM1.R2 — Released single-finding senders and new batch senders share one exact collector boundary without weakening raw-body duplicate authority

### deliver-local-retro-batches.NTB1 — Finish without telemetry ceremony

**Persona:** Non-Technical Builder (NTB)

> When my local agent session ends, I want retrospective delivery to remain
> invisible and unable to disrupt recovery, so I can keep building without
> operating SafeWord's internal transport.

#### deliver-local-retro-batches.NTB1.R1 — Public acceptance failure timeout opt-out invalid input and oversize never block completion or consume private recovery

## Rave Moment

skip: table-stakes — complete invisible telemetry is expected infrastructure,
not a persona-facing moment worth manufacturing.

## Outcomes

- Multi-finding local sessions produce one durable public receipt containing
  every valid sanitized finding in original order.
- One-finding local sessions use the same batch contract while released v1
  clients remain accepted.
- Empty, oversized, opted-out, rejected, duplicated, conflicted, timed-out, and
  unreachable submissions stay silent and preserve private recovery.

## Open Questions

None.

# PR #1522 review round 14 — decision

Scope: the fourteenth-round PR review at `f89d0e6b9`. The live
[issue #1479](https://github.com/ArcadeAI/safeword/issues/1479) remains the
canonical contract.

## Quality-review plan

- Correctness: preserve every known persistence failure when the later delivery
  phase throws.
- Observability: do not display invented delivery totals after a failed drain.
- Durability: ensure the failure still directs the caller to the retained local
  work rather than native fallback or silent success.

## Figure-it-out: combined persistence and delivery failure

- [x] Phase 1: Decide how a delivery-throw result should retain a known
  `spoolFailed` count without claiming unknown delivery outcomes.
- [x] Phase 2: Options: return fabricated zero delivery counts, widen relay
  counts to optional values, or compose the persistence diagnostic into the
  existing delivery error.
- [x] Phase 3a: Research domains: partial-result truthfulness, CLI recovery
  ergonomics, durable spool lifecycle, and #1479 availability behavior.
- [x] Phase 3b: `spoolFailed` is known before delivery starts, while accepted,
  retryable, and dead-letter counts are unknowable if delivery throws. #1479
  requires the draft to stay durable and visible, not a misleading metric.
- [x] Phase 4: Compose the existing detailed persistence error before the
  delivery error. This retains the corrupt-request recovery instructions and
  preserves `agentFilingNeeded` without extending the result model.

> Recommend **composed diagnostics** because they preserve the only truthful
> known count. Zero-valued relay statistics were close on output consistency but
> lose on operational correctness. Cite: [#1479](https://github.com/ArcadeAI/safeword/issues/1479).
>
> **Premortem:** A future failure may add another partial result; only include it
> when it was durably observed before the throw.
>
> **Next:** Retain the regression that corrupts an existing request, then causes
> delivery validation to fail and asserts both diagnostics appear.

## Provenance

- [GitHub #1479](https://github.com/ArcadeAI/safeword/issues/1479), fetched
  2026-08-01: durable acceptance, visible failure, and no silent fallback are
  the controlling requirements.

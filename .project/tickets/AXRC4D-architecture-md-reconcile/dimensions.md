# Behavioral dimensions — AXRC4D (reconcile ARCHITECTURE.md vs generated doc)

Two behaviors: (1) `/audit`'s structural reconciliation verdict (a skill prompt
reading the generated doc) and (2) the deterministic done-gate nudge
(`architectureDocumentNudgeForProject` / `architectureDocumentNudge`). The nudge
is the auto-testable unit; the audit verdict is agent-judgment, anchored on the
generated doc as ground truth.

| # | Dimension | Partitions | Covered by |
| - | --------- | ---------- | ---------- |
| D1 | **Structural relation: doc vs generated map** | (a) in-sync; (b) doc names a unit absent from the map (orphaned); (c) map has a unit the doc omits (missing); (d) layer→dir mapping points at a non-existent module path (drifted) | Audit-lane A1 (b), A2 (c), A3 (d), A0 (a) |
| D2 | **Audit posture** | (a) report-only (cite + propose); (b) MUST NOT auto-overwrite prose; (c) MUST NOT block | A3/J1.AC3 (report-only, no overwrite, no block) |
| D3 | **Did this ticket move the top-level fingerprint?** | (a) unchanged → no nudge; (b) moved (module added/removed) → nudge; (c) shape map newly introduced (no base doc) → nudge | U-pure + U-git: N2/N1 (b), N3 (a), pure "new doc" (c) |
| D4 | **ARCHITECTURE.md presence (nudge gate)** | (a) exists → nudge eligible; (b) absent → never nudge (audit create-from-template owns it) | N4 (b), N1/N2 (a) |
| D5 | **Generated shape doc presence (nudge gate)** | (a) exists → comparable; (b) absent (non-architecture project) → no nudge | U-pure "no generated doc" |
| D6 | **Baseline resolvability (nudge IO)** | (a) merge-base resolves → compare; (b) unresolvable (no upstream) → no nudge (don't guess) | U-git harness asserts resolvable path; (b) noted |
| D7 | **Blocking posture (nudge)** | (a) advisory only — done transition still completes | N1/N2 assert a string is returned but the ticket is already marked done before it fires (hook wiring) |

## Load-bearing partitions (where this change actually bites)

- **D3(b)/D3(c)** — the trigger: a ticket that moved the top-level fingerprint (or
  introduced the shape map) must nudge. New behavior; the deterministic core.
- **D3(a) + D4(b)** — the no-false-alarm boundary: an unchanged fingerprint, or a
  project with no `ARCHITECTURE.md`, must stay silent. Without this the nudge is
  noise and the audit finding a false positive.
- **D1(b)/D1(c)** — the audit verdict: orphaned vs missing are the two structural
  drifts the sharpened `/audit` must distinguish, citing the generated doc.
- **D2(b)/D2(c)** — the human-ownership guard: report-only, never overwrite, never
  block. The whole design rejects blocking/auto-rewrite, so this is the invariant.

## Out-of-partition (not exercised; noted)

The full `/audit` agent run end-to-end (LLM judgment over a real repo) is not
deterministically asserted — audit reconciliation is a skill prompt; its verdict
quality is verified by reading the sharpened instructions and the cited evidence,
following safeword's precedent for skill-prompt changes. The deterministic nudge
trigger carries the executable R/G/R proof.

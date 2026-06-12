# Spec: Independent evidence-backed architecture gate for features

## Intent

Architecture is the one major safeword surface with no gate, no required artifact, and no independent review — exactly the blind spot that retired the `decomposition` phase ("the only phase with no gate and no required artifact, so agents skip it and nothing notices"). Today a feature's architecture quality depends entirely on the agent choosing to run `/figure-it-out` well; nothing forces it and nothing checks it. This feature makes exceptional architecture _reliable_ rather than _hoped-for_: every feature's design must be recorded with cited evidence and survive an independent fresh-context challenge before implementation begins.

## References

- `ARCHITECTURE.md` → "BDD as a Solo-Agent Adaptation" ADR — names the correlated-error problem this mitigates.
- `FSX1PP-collapse-decomposition-phase` / `W9GPE7` — the prior decision that folded architecture into intake; this builds the missing enforcement on top.
- Existing rails this reuses: the JTBD/AC intake gate (`lib/jtbd.ts`) and the Tier 2 fork-review ledger (`lib/review-ledger.ts`, `write-review-stamp.ts`).
- Research (`/figure-it-out`, 2026-06-12): correlated-error limits of self-review (preprints.org/manuscript/202601.0892); ADRs as governance not documentation (reflectrally.com/architecture-decision-logs).

## Personas

- **Agent-Driven Developer (DEV)** — runs an AI agent on a real project and installs safeword specifically to keep that agent design-validated. This feature closes the "design-validated" gap that is currently unenforced.

## Vocabulary

- **Architecture record** — the per-feature decision artifact: options considered, the cited evidence behind the pick, and the reconcile record (conform/deviate vs. existing patterns).
- **Fork review** — an adversarial review run by a fresh-context reviewer that sees only the artifact and ticket scope, so the author cannot grade their own work.

## Jobs To Be Done

### architecture-gate.DEV1 — Every feature's design faces an independent challenge before code

**Persona:** Agent-Driven Developer (DEV)

> When my agent builds a non-trivial feature, I want its architecture recorded with real evidence and challenged by an independent reviewer before any code is written, so I can trust the design wasn't a confident first guess that nothing checked.

#### architecture-gate.DEV1.AC1 — A feature cannot reach implementation without an architecture record carrying cited evidence

#### architecture-gate.DEV1.AC2 — The architecture record is challenged by a fresh-context reviewer whose pass is required to proceed

#### architecture-gate.DEV1.AC3 — Trivial features and non-feature work (patch/task) are exempt, and any feature can opt out with an auditable `skip: <reason>`

### architecture-gate.DEV2 — The gate ships safely without bricking existing workflows

**Persona:** Agent-Driven Developer (DEV)

> When I upgrade safeword, I want this new blocking gate to arrive inert until I deliberately enable it, so a half-built feature in my repo doesn't suddenly become unshippable.

#### architecture-gate.DEV2.AC1 — The gate is default-off behind a config flag and only enforces when explicitly enabled

## Outcomes

- For an enabled repo, no feature ticket advances from intake to implementation without (a) an architecture record with at least one cited source and a reconcile record, and (b) a matching fork-review stamp — or an auditable skip for either.
- Patches and tasks are never gated by this; the friction lands only where a feature's blast radius justifies it.
- With the flag off, behavior is unchanged from today.

## Open Questions

- Artifact home: a new `design.md` in the ticket folder vs. extending the existing `ARCHITECTURE.md` Key Decisions log vs. ticket frontmatter fields — decide in define-behavior against the existing scaffold.
- Gate placement: enforce at intake→define-behavior exit (design before scenarios) vs. at the implement-phase boundary (design before code). Leaning intake-exit to match the "design the ideal first" ordering; confirm against the phase machine.
- Reuse depth: can the fork-review stamp reuse `reviewScope(ticket, 'design', hash)` as-is, or does the architecture artifact need its own scope kind?

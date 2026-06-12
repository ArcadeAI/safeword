# Spec: Independent evidence-backed architecture gate for features

## Intent

PR #204 (epic M6D315) ships the per-feature `impl-plan.md` artifact, its existence gate, ADR consultation, and plan-vs-actual reconciliation. What it deliberately leaves out — confirmed in its `stop-quality.ts` and `check.ts` — is any **independent challenge** of the design: every gate is an existence/validity/status check on an artifact the *same agent* authored and self-graded, and the lone architecture check in `safeword check` is non-blocking and purely structural. The Decisions section captures the agent's own reasoning about its own alternatives, with no requirement to cite live evidence.

That is precisely the correlated-single-agent-error gap the M6D315 ADR itself names. The research is unambiguous that the only thing that closes it is the pattern "propose with high entropy, then select with low entropy using fresh context" — i.e. evidence-backed generation **plus** independent review. This feature adds both halves on top of #204's artifact: it makes the impl-plan's design (a) generated from cited evidence and (b) challenged by a fresh-context reviewer before implementation completes.

## References

- PR #204 / epic `M6D315` — ships `impl-plan.md`, `impl-plan.ts`, `architecture-records.ts`, the existence + reconciliation gates. **This ticket depends on #204 merging.**
- `ARCHITECTURE.md` → "BDD as a Solo-Agent Adaptation" ADR — names the correlated-error problem this closes.
- Existing rails reused: the Tier 2 fork-review ledger (`lib/review-ledger.ts`, `write-review-stamp.ts`) and the `/figure-it-out` skill (the evidence-cited generation half).
- Research (`/figure-it-out`, 2026-06-12): correlated-error limits of self-review (preprints.org/manuscript/202601.0892); ADRs as governance not documentation (reflectrally.com/architecture-decision-logs); the "popularity trap" of voting ensembles.

## Personas

- **Agent-Driven Developer (DEV)** — runs an AI agent on a real project and installs safeword to keep that agent design-validated. #204 gives them a recorded design; this gives them an *independently challenged* one.

## Vocabulary

- **Generation half** — the design is produced via `/figure-it-out` and recorded in the impl-plan's Decisions section **with citations**; the citations are the enforceable trace that real evidence-weighing happened.
- **Selection half / fork review** — an adversarial review run by a fresh-context reviewer that sees only the impl-plan and ticket scope, tries to refute the design against its cited sources, and whose pass is required to proceed.

## Jobs To Be Done

### architecture-gate.DEV1 — The design is generated from evidence, then independently challenged, before code completes

**Persona:** Agent-Driven Developer (DEV)

> When my agent records an implementation plan for a non-trivial feature, I want its key decisions backed by cited evidence and then challenged by an independent reviewer before the work can finish, so I can trust the design wasn't a confident first guess that only its own author ever checked.

#### architecture-gate.DEV1.AC1 — The impl-plan Decisions section must carry cited external evidence (the /figure-it-out trace), or an auditable skip

#### architecture-gate.DEV1.AC2 — A fresh-context reviewer challenges the impl-plan design, and its pass (a review stamp) is required to leave the implement phase

### architecture-gate.DEV2 — The gate ships safely without bricking existing workflows

**Persona:** Agent-Driven Developer (DEV)

> When I upgrade safeword, I want this new blocking gate to arrive inert until I deliberately enable it, so an in-flight feature doesn't suddenly become unshippable.

#### architecture-gate.DEV2.AC1 — The gate is default-off behind a config flag and only enforces when explicitly enabled

## Outcomes

- For an enabled repo, no new-flow feature leaves implement without cited evidence in its impl-plan Decisions and a matching fork-review stamp for the design — or an auditable skip for either.
- The artifact, its existence gate, and features-only scoping are #204's; this only adds the evidence requirement and the independent review on top.
- With the flag off, behavior is identical to post-#204.

## Open Questions

- Stamp scope: can the design fork-review reuse `reviewScope(ticket, 'impl-plan', hash)` over the impl-plan content, so an edit after review invalidates the stamp (same content-hash binding as spec review)? Resolve in define-behavior.
- Gate placement: enforce at the implement→verify exit (design reviewed before the work is called done) vs. a separate phase-exit. Leaning implement→verify, alongside #204's reconciliation gate which already fires there.
- Evidence check shape: how strict is "cited"? Minimum one URL/source reference in the Decisions section vs. a richer check. Lean minimal-and-structural (mirror #204's non-prose-extraction ruling YR6C49) to avoid brittle parsing.
- Confirm #204 merged as-is before starting — if its impl-plan section names or parser shape changed in review, re-confirm the anchors this builds on.

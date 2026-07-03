# Spec: Demand impl-plan.md at first application-code write: plans are authored before the code they plan

## Intent

Close #644 G4: the impl-plan Stop gate (`checkImplPlanArtifact` in stop-quality.ts) fires when a feature ticket *stops* at implement/verify/done — which means the first time anything demands the plan can be after implementation is complete. The GH628F session proved the consequence: a plan authored at 03:44 for code finished at 03:21, with `**Status:** implemented` and its own implementation cited as proof of the "riskiest assumption". The artifact's whole purpose is to be authored at scenario-gate exit, *before* implementation. Demand it where it can still shape the work: at the first application-code write on a feature ticket at `phase: implement`, in the PreTool chain — before a single line of application code exists.

## Intake Brief

- **Requested by:** Safeword Maintainer (via the #644 session audit; wave-2 ordering agreed 2026-07-03 — this ticket follows sibling 87Y167 in the same epic).
- **Cost of inaction:** Every impl-plan in every safeword project can be written after the fact and still satisfy the gate — the design record degenerates into documentation theater, and the plan's build-order/riskiest-assumption discipline never constrains anything. #480's analysis (plan-implementation as its own checkpoint) stays unenforceable.
- **Reversibility:** Two-way door. One PreTool gate extension; removing it restores today's verify-stop-only behavior with no data or API impact.

## References

- #644 (G4 — the gap; G1 sibling is ticket 87Y167; G3/G5/G6 later)
- #480 (plan-implementation phase proposal — this ticket delivers the enforcement half without a phase-enum change; the phase reshaping stays open upstream)
- XDNSZA / ERVA6V (impl-plan artifact + verify-stop reconciliation gate — the parser and template reused here; the stop gate stays as the *implemented*-status reconciliation point)
- #128 (implement-phase PreTool gate this joins — features need test-definitions.md before app code; same firing point, same exemptions)
- DZ2NM5 D5 (grandfathering rule: spec.md presence routes new-flow vs pre-spec tickets — mirrored exactly)
- Parent epic YA68QF (design record D3, decided via /figure-it-out 2026-07-03)

## Personas

- Non-Technical Builder (NTB) — can't audit code, so the plan-before-code guarantee is the only way they get a real design record instead of a post-hoc write-up.
- Technical Builder (TB) — resumes tickets across sessions and reads impl-plan.md to orient; a plan that predates the code is a design record, one that postdates it is a summary.

## Surfaces

Affected:

- Claude Code
- Claude Code on the Web
- OpenAI Codex — via `codex/pre-tool-quality.ts` adapter spawning the Claude hook as source of truth
- Cursor — via `cursor/pre-tool-quality.ts` adapter spawning the Claude hook as source of truth

Unaffected:

- OpenAI Codex Cloud — no safeword hook runtime there today; parity tracked at the adapter layer, not per-feature.

skip: adapter architecture routes all three harnesses through the single Claude-shaped gate (`pre-tool-quality.ts`); scenarios exercise the shared gate directly plus the existing adapter contract tests, rather than per-surface `@surface.*` duplicates (same ruling as 0KYEBN and 87Y167).

## Vocabulary

- **New-flow feature** (spec-local, from DZ2NM5): a feature ticket whose folder contains spec.md — the post-product-layer flow. Tickets without spec.md are grandfathered and exempt, mirroring the stop gate.
- **Application-code write** (spec-local, from #128): an edit-tool write on a non-meta path while the session's active ticket is a feature at `phase: implement` — the same firing condition as the existing test-definitions demand, extended.
- **Reconciliation point** (spec-local, from ERVA6V): the verify-stop gate that requires `**Status:** implemented` from verify onward. Unchanged; this ticket adds the *authoring* point, the stop gate keeps the *reconciliation* point.

## Jobs To Be Done

### impl-plan-at-code-write.NTB1 — Get a design record, not a post-hoc write-up

**Persona:** Non-Technical Builder (NTB)

> When my agent starts implementing a feature, I want the implementation plan demanded before the first line of application code, so the design record is a plan the work actually followed rather than a write-up of whatever already happened.

#### impl-plan-at-code-write.NTB1.AC1 — No application code before a valid plan

The first application-code write on a new-flow feature ticket at `phase: implement` is denied while impl-plan.md is missing or structurally invalid (the five sections, each with content or a reasoned skip), with a plain-language remediation that names the template, says the plan is authored at scenario-gate exit, and instructs `**Status:** planned` — a concrete next action, no jargon dead ends.

#### impl-plan-at-code-write.NTB1.AC2 — A real plan unblocks immediately

Once a valid impl-plan.md exists, application-code writes proceed — whether the status reads `planned` (fresh plan) or `implemented` (resumed ticket after reconciliation). The gate demands the artifact, not a particular moment in its lifecycle; the verify-stop gate still owns the planned → implemented reconciliation.

### impl-plan-at-code-write.TB1 — Existing work keeps flowing

**Persona:** Technical Builder (TB)

> When I resume older tickets or work outside the new-flow ladder, I want the plan demand to stay out of my way, so retrofitted enforcement doesn't brick work that predates it.

#### impl-plan-at-code-write.TB1.AC1 — Exemptions match the stop gate exactly

Grandfathered features (no spec.md), tasks, patches, epics, meta/tooling-path writes, sessions with no active ticket, and features at any phase other than `implement` are never blocked by this gate — the same population the verify-stop gate exempts today keeps flowing at the code-write point.

## Rave Moment

skip: inherited — parent epic YA68QF's children are guardrail plumbing; same table-stakes ruling as 87Y167 and 0KYEBN.

## Outcomes

- The #644 G4 reproduction is dead on all three harnesses: with scenarios done and phase at implement, the first attempted application-code write without impl-plan.md is denied at write time — the plan gets authored while it can still shape build order, not after.
- A retroactive `Status: implemented` plan written to satisfy a stop after the fact is no longer possible for new-flow features that went through this gate — the plan necessarily predates the code.
- The verify-stop reconciliation gate's behavior is byte-for-byte unchanged; grandfathered and non-feature work is untouched.

## Open Questions

(none — D3 enforcement-point debate and premortem recorded in parent epic YA68QF; grandfathering boundary locked to the stop gate's spec.md rule)

# Spec: Phase provenance: feature tickets must be born at intake and advance one phase at a time

## Intent

Close #644 G2: today a feature ticket can be *created* already at `phase: implement` (or jump phases with a bare frontmatter edit), which silently unreaches every gate keyed to the skipped phases — intake sub-phase discipline, the scenario-gate independent review, the readiness gate into define-behavior. Make phase state trustworthy: born at intake, advanced one canonical step at a time, with any deliberate deviation explicit and auditable instead of silent.

## Intake Brief

- **Requested by:** Safeword Maintainer (via the #644 session audit; ordering agreed with the maintainer 2026-07-03 — G2 first because it's the root cause that unreaches the other gates).
- **Cost of inaction:** Every phase-keyed gate remains bypassable by construction — the GH628F session demonstrated a feature shipping with intake, define-behavior, and scenario-gate never existing as phases. Downstream fixes (G1 review demands, G4 impl-plan timing) build locks on doors that can still be walked around. Recurrence is likely: the bypass requires no intent, just an agent creating a ticket "where the work already is."
- **Reversibility:** Two-way door. A hook gate plus frontmatter convention; removing or loosening it breaks no data and no public API. (New frontmatter key must be tolerated by existing parsers, which ignore unknown keys.)

## References

- #644 (G2 — the gap; G1/G4 siblings deferred to their own tickets)
- #119 (earlier silent BDD bypass via ticket parse failure — different root cause, same symptom)
- Existing gates this composes with: #404 readiness gate into define-behavior, NMSD94 Tier-2 phase-exit review (default-off), MBGQ89 blocked_on gate — all in `pre-tool-quality.ts` ticket.md section.
- Out-of-scope siblings: G3 (Bash bypass of write-time gates) — this gate, like every write-time gate, is Bash-bypassable until G3 lands.

## Personas

- Non-Technical Builder (NTB) — relies entirely on gates to keep the agent honest; cannot audit the diff.
- Technical Builder (TB) — resumes and audits tickets across sessions; needs ticket state to mean what it says.

## Surfaces

Affected:

- Claude Code
- Claude Code on the Web
- OpenAI Codex — via `codex/pre-tool-quality.ts` adapter spawning the Claude hook as source of truth
- Cursor — via `cursor/pre-tool-quality.ts` adapter spawning the Claude hook as source of truth

Unaffected:

- OpenAI Codex Cloud — no safeword hook runtime there today; parity tracked at the adapter layer, not per-feature.

skip: adapter architecture routes all three harnesses through the single Claude-shaped gate (`pre-tool-quality.ts`); scenarios exercise the shared gate directly plus the existing adapter contract tests, rather than per-surface `@surface.*` duplicates.

## Vocabulary

- **Phase provenance** (spec-local): the guarantee that a ticket's current `phase:` was reached by traversing the canonical sequence, not by declaration.
- **Canonical phase order** (spec-local): `intake → define-behavior → scenario-gate → implement → verify → done`, per the bdd skill and glossary "Phase" entry.
- **`phase_skips`** (spec-local, new frontmatter convention): a list of `"<phase>: <reason>"` entries, one per deliberately skipped phase, with a non-empty reason (house `skip:` semantics). The gate's escape hatch — bypass cost proportional to phases bypassed, permanently visible in the ticket.

## Jobs To Be Done

### phase-provenance.NTB1 — Trust that the workflow ran without auditing the diff

**Persona:** Non-Technical Builder (NTB)

> When my agent builds a feature, I want workflow phases to be impossible to skip silently, so I can trust the discovery and review conversations actually happened even though I can't read the code myself.

#### phase-provenance.NTB1.AC1 — A feature ticket cannot silently begin life past intake

Creating a feature ticket already at a later phase is denied with a plain-language explanation of what intake is for and what to do next — no jargon dead ends. "Begin life" includes the side doors: converting a ticket's type to feature past intake counts as a birth whatever the prior type (task, patch, epic, or none) and however it arrives (including a frontmatter repair that turns unparseable frontmatter into a feature past intake), and a ticket.md without parseable frontmatter fails closed at creation (#119's silent-bypass symptom) rather than slipping through unclassified. A flip where the prior phase is unrecognized follows the counts-as-intake rule. Birth semantics cut both ways: a flip at intake, or one carrying complete per-phase justifications, is allowed. The gate never touches non-feature tickets themselves, at birth or in motion.

#### phase-provenance.NTB1.AC2 — Any deliberate phase skip stays visible in the ticket

When a phase genuinely doesn't apply (e.g. retroactively ticketing work that already exists), the skip requires an explicit reason that remains readable in the ticket afterward — an auditable act, not a silent drift.

### phase-provenance.TB1 — Rely on ticket phase as ground truth across sessions

**Persona:** Technical Builder (TB)

> When I resume or review a ticket in a later session, I want its `phase:` field to reflect phases actually traversed in order, so gates keyed to phases have really fired and I can orient from ticket state alone.

#### phase-provenance.TB1.AC1 — Phases advance one canonical step at a time

A frontmatter edit that jumps a feature ticket forward past an intermediate phase is denied, naming the phase being skipped.

#### phase-provenance.TB1.AC2 — Rework and routine edits stay cheap

Moving a ticket backward (e.g. implement → define-behavior after scenario changes) and edits that leave the phase untouched (work-log appends — the most common write the gate will ever see) are never blocked by this gate — including edits to legacy tickets whose frontmatter doesn't parse, so long as the frontmatter isn't what's being changed.

#### phase-provenance.TB1.AC3 — Off-sequence phase values can't smuggle past the gate

A feature ticket created or advanced into a phase name outside the canonical sequence is denied the same way as a skipped phase — an unknown label would otherwise unreach every keyed gate at once.

## Rave Moment

skip: table-stakes — a guardrail's peak experience is the absence of a failure; nothing here beats an expectation in a shareable way.

## Outcomes

- A feature ticket at `phase: implement` implies intake, define-behavior, and scenario-gate each existed as phases (or carry a named, visible skip) — for every ticket created after this ships.
- The #644 G2 reproduction (create ticket.md born at `phase: implement`, or edit intake → implement directly) is denied at write time on all three harnesses.
- Existing tickets and task/patch tickets are untouched — no retroactive breakage.

## Open Questions

(none — escape-hatch shape resolved 2026-07-03 via /figure-it-out: per-phase `phase_skips` list; decision and premortem recorded in the ticket work log)

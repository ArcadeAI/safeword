# Spec: Converge spec grammar on a single Rule tier

## Intent

Collapse the two coexisting criteria names between JTBD and scenarios — "Acceptance
Criterion" (`.AC<n>`) and "Rule" (`.R<n>`) — down to **one** tier, named **Rule**.
Canonical BDD (Example Mapping) treats AC and Rule as the *same* card, and Gherkin
has a real `Rule:` keyword tooling acts on while "AC" is prose no tool understands.
PR #713 landed Rules as a reversible coexistence bridge; this ticket makes Rule
the single tier, retires AC to a soft-deprecated legacy alias, and ships a codemod
so existing `.AC` projects migrate with one command.

## Intake Brief

- **Requested by:** @TheMostlyGreat (issue #716), flagged by @nbarbettini on #713 ("we
  use Rules everywhere now… they essentially mean the same thing"). Confirmed against
  canonical Cucumber sources.
- **Cost of inaction:** two names for one concept persists — every gate, coverage path,
  template, and skill carries dual AC/Rule vocabulary plus a mixed-criteria guard that
  exists *only* to police the two-name split. Authors keep choosing between synonyms;
  the tooling keeps propping up "AC" prose that no Gherkin tool reads.
- **Reversibility:** one-way door. Renaming AC→Rule across specs, gates, and downstream
  repos is a cross-cutting grammar migration. Mitigated by soft-deprecation (AC keeps
  parsing) and the codemod, but the vocabulary decision itself is not casually undone.

## References

- Issue #716 (this ticket) + resolved-decision comment (soft-deprecate, don't hard-cut).
- #713 / ticket `V0NHT6-rule-tier` — the coexistence bridge this converges.
- Cucumber Example Mapping docs — "acceptance criteria, **or** rules" = one tier.

## Personas

- **Safeword Maintainer (SM)** — owns the grammar; wants one tier, not two, and the
  coexistence scaffolding gone.
- **Non-Technical Builder (NTB)** — has an existing `.AC` project; must not be silently
  blocked on upgrade. The soft-deprecation decision exists to protect this persona.
- **Technical Builder (TB)** — wants a one-command, safe migration for their `.AC` corpus.

## Surfaces

The grammar ships through templates/skills that reconcile onto every agent surface;
the change is surface-agnostic (same Rule vocabulary everywhere).

Affected:

- Claude Code — `skip: grammar is surface-agnostic; no Claude-Code-specific behavior, no per-surface scenario`

Unaffected:

- OpenAI Codex, Cursor (+ cloud variants) — receive the identical converged templates via
  the same reconcile path; no surface-specific divergence.

## Vocabulary

- **Rule** — the single criteria tier between a JTBD and its scenarios; a testable
  business invariant with a stable per-JTBD id `#### <jtbd-id>.R<n>`. (Was: two names,
  "Acceptance Criterion" and "Rule".)
- **Legacy AC alias** — the retired `.AC<n>` spelling. Still parses and traces coverage
  as a Rule, emits a deprecation nudge, and is rewritten by the codemod. Hard removal
  deferred to a later major.

## Jobs To Be Done

### rule-tier-convergence.SM1 — Maintain one criteria tier, not two

**Persona:** Safeword Maintainer (SM)

> When I extend the spec grammar or its gates, I want a single criteria tier named Rule
> instead of two coexisting names with a guard policing the split, so I reason about and
> evolve one vocabulary across templates, gates, and coverage.

#### rule-tier-convergence.SM1.R1 — The scaffolded grammar offers exactly one criteria tier, Rule

> Templates (spec-template ×2), skills (bdd DISCOVERY/SCENARIOS ×3, review-spec),
> and guidance scaffold `#### <jtbd-id>.R<n>` Rule headings and `@<jtbd-id>.R<n>` tags as
> the single criteria tier. The "a JTBD declares one criteria kind, never both" doctrine
> and the AC-as-co-equal-option framing are removed from all authoring surfaces.

#### rule-tier-convergence.SM1.R2 — The mixed-criteria guard is retired and coverage speaks one vocabulary

> A JTBD declaring both `.AC` and `.R` headings is no longer a `safeword check` issue
> (AC and R are the same tier now). `findMixedCriteriaJtbds` and its health issue are
> gone; coverage/health advisories (uncovered / stale / orphan) are worded once, in Rule
> terms, regardless of the id's legacy spelling.

#### rule-tier-convergence.SM1.R3 — The intake-exit gate requires a Rule and names Rules in its denial

> The hook-side `jtbd.ts` gate (both byte-identical mirrors) requires ≥1 criterion (or a
> `skip:`) per JTBD; its denial message names `#### <id>.R<n>` as the thing to add. AC is
> not presented as a co-equal option in new guidance.

### rule-tier-convergence.NTB1 — Keep an existing AC project working on upgrade

**Persona:** Non-Technical Builder (NTB)

> When I upgrade safeword on my existing `.AC`-based project, I want my intake and coverage
> to keep working — with a clear nudge, not a block — so my agent doesn't suddenly stall
> on grammar I can't debug.

#### rule-tier-convergence.NTB1.R1 — Legacy `.AC` still parses and traces coverage identically

> A spec/feature still using `.AC<n>` parses, satisfies the intake-exit gate, and traces
> uncovered/stale/orphan coverage exactly as before. AC is a legacy alias for Rule; the
> AC-wins ref-parse precedence is retained so `@feat.R1.AC1` stays unambiguous and
> persona code `R` stays safe. Nothing about AC blocks.

#### rule-tier-convergence.NTB1.R2 — Using `.AC` surfaces a plain-language deprecation nudge

> When `safeword check` sees `.AC<n>` in an in-progress ticket's spec or feature, it emits
> a deprecation advisory (zero-exit) naming the codemod and the Rule replacement — actionable
> and jargon-free, never a gate.

### rule-tier-convergence.TB1 — Migrate an AC corpus with one command

**Persona:** Technical Builder (TB)

> When I move my project onto the Rule tier, I want one safeword command that rewrites
> `.AC<n>` → `.R<n>` across my specs and features, so migration is mechanical, reviewable,
> and doesn't corrupt cross-references.

#### rule-tier-convergence.TB1.R1 — A codemod rewrites `.AC<n>` → `.R<n>` across spec headings, feature tags, and scenario refs

> `safeword migrate-ac` rewrites `#### <jtbd>.AC<n>` spec headings, `@<jtbd>.AC<n>` feature
> tags, and `### Scenario: <jtbd>.AC<n>…` legacy-ledger refs to the `.R<n>` spelling,
> same number, rewriting both the declaration and its references together so lineage stays
> intact.

#### rule-tier-convergence.TB1.R2 — The codemod is safe: idempotent, collision-aware, previewable

> Re-running is a no-op (idempotent). `--dry-run` previews changes without writing. When
> rewriting an AC would collide with an existing `.R<n>` under the same JTBD, the codemod
> reports and refuses that JTBD rather than silently renumbering (numbering is reference-
> load-bearing).

## Rave Moment

### rule-tier-convergence — one command, whole corpus, nothing stalls

- **Moment:** An NTB upgrades, sees "your specs use the old `.AC` name — run `safeword
  migrate-ac`", runs it, and their entire spec corpus moves to Rules in one pass — the
  agent never once stalls on grammar they couldn't have debugged.
- **Beats:** the dread of a silent intake block after an upgrade — the exact trust-eroding
  failure safeword exists to prevent, worst for the persona who can't read the diff.
- **They'd say:** "I upgraded, it told me exactly what to run, and one command migrated
  everything — it never left me stuck."

## Outcomes

- New scaffolds/templates/skills present exactly one criteria tier (Rule); zero remaining
  "one criteria kind, never both" doctrine or AC-co-equal framing.
- `findMixedCriteriaJtbds` and the mixed-criteria health issue deleted; coverage advisories
  worded in a single Rule vocabulary.
- `.AC` specs/features still pass gates and trace coverage, now with a deprecation nudge.
- `safeword migrate-ac` migrates `.AC` → `.R` mechanically, idempotently, collision-safe.
- This repo's own AC corpus migrated to Rules (breadth per Open Question below).
- Full suite + Gherkin acceptance lane green; hook/template mirrors byte-identical.

## Open Questions

- **Repo migration breadth — RESOLVED (user, 2026-07-04):** option **B, live surface only**.
  Migrate the running `features/` + `packages/cli/features/` lanes and active in-progress
  ticket specs; leave `completed/` historical records untouched (health.ts already exempts
  done tickets as the out-of-scope pre-scheme migration case). The codemod ships for the rest.
- **Codemod command name — RESOLVED (user, 2026-07-04):** `safeword migrate-ac` (top-level,
  `--dry-run` supported).
- **Deprecation-warning exact wording — `defer: define-behavior`:** fires only in the existing
  in-progress + spec-bearing `safeword check` path (no new global scan); precise message
  authored with its scenarios.

# Spec: Numbered Rule tier between JTBD and scenarios

## Intent

Safeword's scenario lineage is two-rung — JTBD → AC (`<jtbd-id>.AC<#>`) → scenarios — with
Gherkin `Rule:` used only as an unnumbered grouping header. This feature adds an optional
third rung: the **numbered Rule** (`<jtbd-id>.R<#>`), a testable business invariant with a
stable ID that scenarios nest under and reference, so the spec states general behavior
explicitly (an invariant catalog) instead of leaving it implied by a pile of examples.
Upstream tracker issue: ArcadeAI/safeword#649.

## Intake Brief

- **Requested by:** TheMostlyGreat via GitHub issue #649, surfaced by a corpus-migration
  audit of ArcadeAI/monorepo's pre-safeword spec system.
- **Cost of inaction:** Arcade's CI-wired feature corpus in `tests/behaviors/` already
  carries numbered-rule grammar that safeword's AC-only lineage cannot express — that repo's
  spec-authoring flow stays blocked off `/bdd`. All repos keep missing invariant-level review
  checks (a rule with zero rejection-path scenarios is invisible in flat scenario lists) and
  rule-level test selection.
- **Reversibility:** One-way once adopted — rule IDs land in customer feature corpora, CI tag
  expressions, and review references, and IDs are numbering-locked after review by design.
  The tier itself is opt-in; repos that don't adopt keep today's flat AC lineage unchanged.

## References

- Upstream issue: [ArcadeAI/safeword#649](https://github.com/ArcadeAI/safeword/issues/649).
- XT1FFM — scenario lineage (`<jtbd-id>.AC<#>` tags + `safeword check` coverage report); this
  feature extends that scheme one tier. Its arcade pair QEKGBK named Arcade's scheme the
  fidelity target ("kept snake-exact").
- 31W8M3 — AC layer in spec.md (`#### <jtbd-id>.AC<n>` headings).
- ZRMDKD (backlog) — plans to promote the AC↔scenario coverage check to a *blocking*
  hook-side gate via a differential-tested port of `scenario-coverage.ts`; must become
  tier-aware or sequence after this feature, else it denies opted-in rule-tier features.
- NMSD94 — owns the two-tier review-stamp mechanism (candidate anchor for "numbering-locked
  after review").
- Companion gap noted in #649 (post-done `measured` state) is to be filed separately — out
  of scope here.

## Personas

**Technical Builder (TB)** — authors specs and scenarios through `/bdd` in their own repo,
reviews the invariant catalog, and selects tests by rule when an invariant changes.

## Surfaces

Affected:

- skip: runtime-agnostic — the tier lives in CLI parsing/checks (`safeword check`,
  `lint-gherkin`, `codify`), the hook-side mirror codepath (`templates/hooks/lib/` deployed
  to `.safeword/hooks/`), and shared skill templates deployed identically to every agent
  runtime; no per-runtime behavior differs.

## Vocabulary

**Numbered Rule** — a testable business invariant with a stable per-JTBD ID
(`<jtbd-id>.R<#>`, 1-indexed within its job), stated generally in the spec and illustrated
by the scenarios nested under its Gherkin `Rule:` block. Feature-local term; distinct from
today's unnumbered `Rule:` grouping header.

**Rejection path** — a scenario proving the system refuses or fails safely when a rule's
invariant is violated; a numbered rule with no rejection-path scenario is a review smell.

## Jobs To Be Done

### rule-tier.TB1 — State invariants once, see missing rejection paths

**Persona:** Technical Builder (TB)

> When I define behavior for a feature, I want each business invariant stated once as a
> numbered rule with its examples nested under it, so the spec reads as an explicit
> invariant catalog and a rule with no rejection-path scenario surfaces at review instead
> of hiding in a flat scenario list.

### rule-tier.TB2 — Run every example of one invariant

**Persona:** Technical Builder (TB)

> When one invariant changes or regresses, I want to select every scenario of that rule by
> its stable ID (e.g. a cucumber tag expression), so I can verify the invariant directly
> without running or eyeballing the whole feature suite.

### rule-tier.TB3 — Anchor behavior changes to the rule that changed

**Persona:** Technical Builder (TB)

> When reviewed behavior changes, I want the change anchored to the one numbered rule that
> changed — IDs numbering-locked after review — so status resets and cross-references land
> on a stable anchor instead of rotting across scattered, renumbered scenarios.

### rule-tier.TB4 — Migrate an existing rule-numbered corpus onto /bdd

**Persona:** Technical Builder (TB)

> When I bring a repo whose feature files already carry numbered-rule grammar (Arcade's
> `tests/behaviors/`) onto safeword, I want the lineage grammar to express that corpus
> as-is, so adopting `/bdd` doesn't force a corpus rewrite or drop the rule tier.

(Persona note: migration is done by the developer running the agent in their own repo —
that is TB by definition; personas.md has no separate adopter archetype, so TB is a
deliberate choice, not a default.)

## Rave Moment

skip: table-stakes — spec-grammar infrastructure; the payoff is review checks and test
selection working quietly, not a peak moment that travels.

## Outcomes

- A reader of a `.feature` file can map any scenario to the invariant it illustrates, and
  any rule back to its JTBD/persona, from IDs alone.
- `safeword check` / `lint-gherkin` surface rule-tier gaps (a spec rule no scenario
  references; a `@rule` reference matching no spec rule; a rule with zero rejection-path
  scenarios) without eyeball cross-referencing.
- Repos that don't opt in see zero change to today's flat AC lineage.

## Open Questions

- **AC ↔ Rule coexistence (load-bearing):** parallel axis (scenario carries AC tag +
  optional rule tag), nested under AC (`.AC1.R1`), or per-JTBD substitute (a JTBD carries
  either ACs or Rules)? Lean: substitute-per-JTBD — preserves "exactly one lineage
  reference per scenario" and matches Arcade's job → rule → scenario corpus, which has no
  AC tier. Nested breaks corpus fidelity (motivation #4).
- **Tag scheme:** safeword-style combined tag (`@<jtbd-id>.R<#>`) vs Arcade's split axes
  (`@job:PO1 @rule:PO1.R1 @scenario:<name>`) with slug-less short IDs. Rule-level test
  selection works under both (tag-expressions reserve only `( ) \` and whitespace, so `:`
  is legal). The split scheme hides two conflicts: multiple lineage tags per scenario
  collides with the exactly-one-lineage-tag lint, and a `@scenario:<name>` axis contradicts
  "names plain English; lineage in tags, not names" — corpus-literal fidelity (TB4's
  "as-is") therefore means *relaxing* existing lint rules, not just adding a tier.
- **Enforcement-stack interaction:** under the substitute-per-JTBD lean, a scenario carries
  no AC tag — which today's `findFeatureLineageIssues` hard-flags ("missing lineage") and
  `parseAcReferenceFromTag` (AC-only regex) can't read. Tier-awareness must land in the CLI
  *and* the hook-side mirror (`templates/hooks/lib/`, deployed `.safeword/hooks/`), and
  ZRMDKD's planned blocking coverage gate must be sequenced with or made aware of the tier,
  or opted-in features get denied at test-definitions creation.
- **Numbering-lock mechanism (TB3):** what enforces "numbering-locked after review", and
  what does "after review" map to in the phase flow — the scenario-gate review stamp
  (NMSD94), a lint on renumbering an existing rule ID, or convention only? If convention
  only, TB3's stable-anchor promise and the one-way reversibility claim rest on it —
  resolve before ACs are written.
- **Rule catalog declaration:** `#### <jtbd-id>.R<#> — <invariant>` headings in spec.md
  (mirrors ACs; enables the drift gate "every @rule tag maps to a spec rule") vs the
  `.feature` `Rule:` blocks as the sole source of truth.
- **Rejection-path signal:** how lint identifies a rejection-path scenario — a tag
  convention (e.g. `@negative`) seems necessary; Then-text heuristics are unreliable.
- **Opt-in mechanism:** `.safeword/config.json` flag vs auto-detection per feature file
  (presence of `R<#>` IDs in Rule names).
- **Intake-exit gate:** does the gate accept Rules in place of ACs for opted-in JTBDs
  (it currently denies `test-definitions.md` until every JTBD has ≥1 AC or a skip)?

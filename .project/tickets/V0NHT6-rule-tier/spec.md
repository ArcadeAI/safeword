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
  expressions, and review references, and are intended to be numbering-locked after review
  (enforcement mechanism open — see Open Questions).
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

#### rule-tier.TB1.AC1 — A JTBD can declare numbered Rules in place of ACs and still satisfy every gate that requires criteria

#### rule-tier.TB1.AC2 — A numbered Rule with no rejection-path scenario surfaces as an advisory

#### rule-tier.TB1.AC3 — JTBDs and repos that declare no Rules keep today's flat AC lineage unchanged

#### rule-tier.TB1.AC4 — A JTBD declaring both ACs and numbered Rules is flagged as a check issue naming the JTBD

### rule-tier.TB2 — Run every example of one invariant

**Persona:** Technical Builder (TB)

> When one invariant changes or regresses, I want to select every scenario of that rule by
> its stable ID (e.g. a cucumber tag expression), so I can verify the invariant directly
> without running or eyeballing the whole feature suite.

#### rule-tier.TB2.AC1 — Scenarios under a numbered Rule inherit its ID as their single lineage reference, and a tag expression on that ID runs exactly that rule's examples

### rule-tier.TB3 — Anchor behavior changes to the rule that changed

**Persona:** Technical Builder (TB)

> When reviewed behavior changes, I want the change anchored to the one numbered rule that
> changed — IDs numbering-locked after review — so status resets and cross-references land
> on a stable anchor instead of rotting across scattered, renumbered scenarios.

#### rule-tier.TB3.AC1 — `safeword check` reports rule-tier drift as advisories: an uncovered spec Rule, a stale rule reference, and an orphan rule reference

### rule-tier.TB4 — Migrate an existing rule-numbered corpus onto /bdd

**Persona:** Technical Builder (TB)

> When I bring a repo whose feature files already carry numbered-rule grammar (Arcade's
> `tests/behaviors/`) onto safeword, I want the lineage grammar to express that corpus
> as-is, so adopting `/bdd` doesn't force a corpus rewrite or drop the rule tier.

(Persona note: migration is done by the developer running the agent in their own repo —
that is TB by definition; personas.md has no separate adopter archetype, so TB is a
deliberate choice, not a default.)

#### rule-tier.TB4.AC1 — A corpus of per-JTBD numbered Rule blocks parses, lints, and reports coverage without structural rewriting, with a documented migration mapping for tag spelling

## Rave Moment

skip: table-stakes — spec-grammar infrastructure; the payoff is review checks and test
selection working quietly, not a peak moment that travels.

## Outcomes

- A reader of a `.feature` file can map any scenario to the invariant it illustrates, and
  any rule back to its JTBD/persona, from IDs alone.
- `safeword check` / `lint-gherkin` surface rule-tier gaps (a spec rule no scenario
  references; a rule reference in a scenario tag matching no spec rule; a rule with zero
  rejection-path scenarios) without eyeball cross-referencing.
- Repos that don't opt in see zero change to today's flat AC lineage.

## Decisions (intake, converged 2026-07-03)

- **Coexistence — substitute-per-JTBD** (user-confirmed): a JTBD carries either ACs or
  numbered Rules, never both; every scenario keeps exactly one lineage tag (an AC ref or an
  R ref). A JTBD declaring both kinds is a `safeword check` **issue** (not advisory) naming
  the JTBD — the gate still counts its criteria (fail-open), the issue drives the fix.
  Rejected: parallel axis (two overlapping coverage models per scenario), nesting under AC
  (breaks Arcade corpus fidelity, TB4).
- **Tag scheme — combined tag** `@<jtbd-id>.R<#>`, mirroring the AC tag grammar. Preserves
  the exactly-one-lineage-tag lint and dots-only IDs; rule-level selection works under
  cucumber tag expressions either way. Split axes deferred (see Open Questions).
- **Rule catalog — spec.md is the source of truth:** `#### <jtbd-id>.R<#> — <invariant>`
  headings under the JTBD (exactly where AC headings sit). This powers the drift checks
  (every rule reference maps back to a spec Rule) with the same walk `parseAcIdsByJtbd`
  does today.
- **Where the ID lives in `.feature`:** the `Rule:` block carries a literal
  `@<jtbd-id>.R<#>` **tag** (scenarios inherit it via existing rule-tag inheritance — tags
  are what selection and coverage read, so the tag is authoritative) and repeats the ID as
  the first token of its name for human readability (Arcade style). Name-token ≠ tag is a
  lint issue.
- **Ref-parse precedence — AC wins:** a tag matching `.AC<n>` is an AC ref, never an R ref
  (guards persona codes like `R`: `@feat.R1.AC1` is AC1 of JTBD `feat.R1`, not rule
  `feat.R1`). The R-ref parser only matches when no AC segment follows.
- **R refs are `.feature`-only:** the legacy test-definitions.md markdown-title path
  (`parseAcReferenceFromTitle`) stays AC-only — the rule tier requires the `.feature`
  source, which is already the canonical scenario source.
- **Opt-in — the grammar is the opt-in:** declaring `R<#>` headings under a JTBD opts that
  JTBD into rule lineage; no config flag. Per-JTBD granularity falls out of the substitute
  decision; repos that never write an R heading are untouched.
- **Rejection-path signal — `@rejection` tag convention:** lint counts a rule's scenarios
  tagged `@rejection`; zero on a numbered Rule → advisory (never a gate). Then-text
  heuristics rejected as unreliable.
- **Intake-exit gate accepts Rules:** ≥1 AC *or* ≥1 numbered Rule (or `skip:`) satisfies a
  JTBD; lands in the hook-side `jtbd.ts` mirror alongside the CLI.
- **Enforcement stack:** tier-awareness lands in `gherkin-feature.ts` (lineage lint + ref
  parser), `scenario-coverage.ts`, and the hook-side mirror together; ZRMDKD's ticket gains
  a tier-awareness requirement so the future blocking gate cannot deny opted-in features.
- **Numbering lock (TB3) — v1 ships stable IDs + drift advisories:** a renumbered or
  deleted rule ID surfaces as stale/orphan advisories on every scenario still referencing
  it. Hard lock enforcement deferred (see Open Questions).

## Open Questions

- Split-axis tag compat (`@job:` / `@rule:` / `@scenario:`) — defer: combined tag decided
  for v1; revisit as a compat flag only if the Arcade corpus migration proves the mechanical
  tag respelling too costly in practice.
- Hard numbering-lock enforcement — defer: follow-up anchored to NMSD94's review stamps
  (deny renumbering a stamped rule ID); v1's stale/orphan advisories cover detection.

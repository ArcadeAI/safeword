# Define Behavior & Scenario Gate

## Define Behavior

**Entry:** Agent enters `define-behavior` phase (after discovery or resume).

### Iron Law

**DERIVE DIMENSIONS BEFORE WRITING SCENARIOS** — systematic coverage, not intuition.

### Pipeline (5 steps)

1. **Derive dimensions** from intake artifacts (resolved questions, done-when, scope) + domain-knowledge dimensions not surfaced during intake
2. **Partition** each dimension into equivalence classes + boundary values
3. **Generate scenarios** — one per partition + boundary cases. Each scenario proves a specific **Rule** (or legacy Acceptance Criterion) from intake (`spec.md`); if a scenario doesn't map to any criterion, either it's testing implementation (drop it) or a criterion is missing (go back and add it).
4. **Organize under Gherkin `Rule:` blocks** with card-ratio self-check (too many rules? any rules with no examples? open questions?). They group scenarios by the criterion they prove, so every criterion has ≥1 scenario and no scenario is an orphan.
5. **Present to user** (decider) — user accepts, tweaks, or adds

Save the dimension table to `dimensions.md` in the ticket folder before writing test-definitions.md (the pre-tool hook enforces this for features). For tiny features with one obvious behavioral dimension and no partitioning to enumerate, dimensions.md may instead be a single line `skip: <non-empty reason>`.

### Scenario saturation

Each propose-and-converge turn either surfaces new scenarios or doesn't. When a turn produces no new scenarios → proceed to scenario-gate.

### Concrete example

**Context:** User asked for `--dry-run` on init. Intake produced scope (show what would be created without creating), done-when (output matches real init, no side effects).

**Agent turn 1:**

> From intake I see 2 behavioral dimensions:
>
> | Dimension              | Partitions                                    |
> | ---------------------- | --------------------------------------------- |
> | Output correctness     | empty dir, existing config, conflicting files |
> | Side-effect prevention | filesystem writes, git operations             |
>
> Organized under 3 rules:
>
> **Rule: Dry-run output matches real init**
>
> - [ ] Shows expected files in empty directory
> - [ ] Shows warning when config already exists
> - [ ] Shows conflict notice for incompatible existing files
>
> **Rule: Dry-run creates no files**
>
> - [ ] No files created on disk
>
> **Rule: Dry-run skips git operations**
>
> - [ ] No git init or git add executed
>
> 3 rules, 5 scenarios, 0 open questions. The "conflicting files" partition came from domain knowledge — init currently overwrites without warning, so dry-run should surface that. Anything missing, or ready for the quality gate?

**User:** "Looks good, proceed."

**Result:** No new scenarios → scenario saturation → proceed to scenario-gate.

### Two formats: discovery vs saved

**Discovery shorthand** (in chat, presenting to user): Rule + bare scenario checkboxes — fast to read, easy to amend in conversation. This is what turn-1 above looks like.

**Saved source** (`features/<slug>.feature`; under `paths.features` when configured): Gherkin `Feature` / `Rule` / `Scenario`, with lineage carried on the `Rule:` block as a `@<jtbd-id>.R<#>` tag that its scenarios inherit (legacy specs instead tag each scenario `@<jtbd-id>.AC<#>`). Two senses of "rule" meet here: Gherkin's `Rule:` keyword is the grouping block, while the numbered Rule (`.R<#>`) is safeword's lineage id — the block carries it as a tag and repeats it as the first token of its name. This is the executable behavior source that the Cucumber lane runs and `$safeword:review-spec`, `safeword check`, and `codify` read.

### Surface coverage tags

If `spec.md` `## Surfaces` lists `Affected:` entries, each affected surface needs at least one saved scenario tagged `@surface.<slug>` or an explicit `skip: <reason>` on the affected-surface line. Slug = lowercase name with non-alphanumerics collapsed to hyphens (`OpenAI Codex` -> `@surface.openai-codex`). One scenario can carry multiple surface tags when the same behavior proves parity across contexts. `safeword check` reports missing or stale surface tags as advisories.

**Progress ledger** (`test-definitions.md` on disk): scenario headings plus per-scenario `- [ ] RED / GREEN / REFACTOR` sub-checkboxes. test-definitions.md is the R/G/R ledger. The prompt hook parses those checkboxes to inject TDD-step guidance during implement, and they enforce one-commit-per-step discipline. Do not duplicate Given/When/Then here when a `.feature` source exists.

```gherkin
Feature: Description of feature

  @<jtbd-id>.R1
  Rule: <jtbd-id>.R1 — Description of the business invariant

    Scenario: Partition A
      Given [context]
      When [action]
      Then [outcome]

    @rejection
    Scenario: Partition B (invariant violated)
      Given [context]
      When [action]
      Then [outcome]
```

```markdown
# Test Definitions: Description of feature

Feature source: `features/<slug>.feature`

test-definitions.md is the R/G/R ledger.

## Rule: <jtbd-id>.R1 — Description of the business invariant

### Scenario: Partition A

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Partition B (invariant violated)

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR
```

### Scenario construction rules

Write each saved `.feature` scenario to these rules — they head off at authoring time the defects the scenario-gate would otherwise catch later. Coaching, not a gate: when a scenario starts to break one, split it on the spot instead of accumulating violations.

- **One behavior, one `When`** — each scenario specifies a single event and its outcome. Multiple `And`-joined `Then` lines are fine when they assert facets of the _same_ outcome (a withdrawal that debits **and** dispenses **and** returns the card); a second `When`, or a second behavior, means a second scenario.
- **Outcome-oriented `Then`** — assert what is true after the `When`, never how the system gets there. "Then the order is rejected" ✓, not "Then `validateOrder()` returns false" ✗.
- **Declarative, business language** — name the intent, not the UI mechanics. "When the customer submits the order" ✓, not "When the user clicks `#submit` and waits 200ms" ✗. Reads as living documentation and survives implementation changes.
- **`Given` is state, not action** — establish the world, don't act in it. "Given the cart holds one item" ✓, not "Given the customer adds an item" ✗ (an action belongs in `When`).
- **No `or` in the `Then`** — one outcome per scenario; "returns 200 **or** 201" is two scenarios. For one behavior across many inputs, use a `Scenario Outline` with an `Examples` table, not copy-pasted scenarios.

Two of these rules mirror gate checks — **one behavior** is AODI's **Atomic**, and externally-observable outcomes are its **Observable** (both in the Scenario Quality Gate below). Author for them here; the gate still validates every scenario adversarially.

### Scenario naming: lineage scheme

Each saved `.feature` scenario carries the criterion it proves as a
Gherkin tag, so the link back to the Rule (or legacy AC), JTBD, and persona is
machine-checkable rather than eyeballed:

`@<jtbd-id>.R<#>` — the tag is the numbered-Rule id from intake
(`<slug>.<persona-code><JTBD#>.R<#>`); legacy specs use `.AC<#>`. Long ids are
fine — no truncation. Scenario names may be plain English; keep lineage in tags,
not names.

Worked example — feature `oauth-flow`, persona Platform Operator (PLO), first JTBD:

| Layer        | Id                    |
| ------------ | --------------------- |
| JTBD         | `oauth-flow.PLO1`     |
| Rule         | `oauth-flow.PLO1.R2`  |
| Scenario tag | `@oauth-flow.PLO1.R2` |

```text
@oauth-flow.PLO1.R2
Scenario: Change association applies to subsequent auth
```

A scenario with no lineage tag is left alone — it simply proves no criterion.
`safeword check` reads the tags and reports coverage gaps for in-progress tickets
as advisories (never a gate):

- **uncovered** — a Rule (or AC) in `spec.md` that no scenario references.
- **stale ref** — a scenario whose JTBD exists but whose `R<#>`/`AC<#>` does not
  (a typo, or a criterion that was renumbered).
- **orphan** — a scenario whose JTBD is absent from `spec.md` entirely.

### Numbered Rules (the default tier)

Numbered Rules are the recommended criteria kind — testable business
invariants with stable per-JTBD IDs, stated generally and illustrated by the
scenarios nested under them. Writing `#### <jtbd-id>.R<n>` headings under a JTBD
puts it on rule lineage; there is no config flag, and a JTBD carries one criteria
kind, never both (`safeword check` flags a mixed job as an issue). Legacy specs
may still use Acceptance Criteria instead (soft-deprecated).

- **Spec catalog:** `#### <jtbd-id>.R<n> — <invariant>` headings under the JTBD,
  exactly where AC headings sit (e.g. `#### webhook-retry.PLO1.R1 — a failed
delivery retries on exponential backoff`). IDs are 1-indexed per job and
  numbering-locked after review — renumbering breaks references on purpose.
- **Feature file:** the `Rule:` block carries the literal `@<jtbd-id>.R<n>` tag
  (authoritative — scenarios inherit it as their single lineage ref) and repeats
  the ID as its name's first token for readability; a mismatch is a lint issue.
  An AC-shaped tag always wins the ref parse, so persona code `R` stays safe
  (`@feat.R1.AC1` is an AC of JTBD `feat.R1`).
- **Rejection paths:** tag at least one scenario per rule `@rejection` (the
  example proving the system refuses when the invariant is violated); a numbered
  rule without one draws a check advisory. Unnumbered `Rule:` grouping headers
  are exempt from all of this.
- **Selection:** `cucumber-js --tags @<jtbd-id>.R<n>` runs exactly that rule's
  examples.
- **Coverage:** the uncovered / stale ref / orphan advisories work for rule refs
  exactly as for AC refs.
- **Migrating a rule-numbered corpus** (e.g. Arcade-style split tags): the Rule
  blocks, IDs, and nesting survive as-is; respell tags mechanically —
  `@job:PLO1 @rule:PLO1.R1 @scenario:<name>` on a scenario becomes the single
  block-level `@<slug>.PLO1.R1` tag, and scenario names go back to plain English.

### Define Behavior Exit

1. **Save scenarios** to the feature lane: `features/<slug>.feature` (under `paths.features` when configured)
2. **Save the R/G/R ledger** to `<namespace-root>/tickets/{ID}-{slug}/test-definitions.md`
3. **Update frontmatter:** `phase: scenario-gate`
4. **Work log:** the phase hook stamps the transition with real time (Claude Code — on other harnesses add a short transition entry yourself); optionally add a narrative entry (scenario count, rules covered).

---

## Scenario Quality Gate

**Entry:** Agent enters `scenario-gate` phase.

Run the **`$safeword:review-spec`** skill — it is the gate procedure (vacuous-pass, AODI, determinism risks, adversarial pass + negative-case, cross-cutting checks, and the findings format). It reads the active ticket's `.feature` source when present, using `test-definitions.md` only as the R/G/R ledger, reports findings, and is re-invokable standalone after scenario edits. Apply its findings, then complete the saturation check and exit below.

### Coverage saturation

If the adversarial pass + user feedback produced new scenarios → loop back to define-behavior. If nothing new surfaced → done.

### Scenario Gate Exit

1. Each scenario passes the vacuous-pass test and AODI (Atomic, Observable, Deterministic, Independent)
2. Adversarial pass + cross-cutting checks complete; findings presented in the findings format (or confirmed clean)
3. **Update frontmatter:** `phase: plan-implementation` — implementation design (the impl-plan, proof plan, build order, ADR work) happens there; see `PLAN_IMPLEMENTATION.md`.
4. **Work log:** the phase hook stamps the transition with real time (Claude Code — on other harnesses add a short transition entry yourself); optionally add a narrative entry (validation outcome, proof-plan highlights).

### Optional: codify the scenarios

After the gate, `safeword codify <ticket>` derives implementation stubs from the `.feature` source — a front-loaded "N tests to make pass" board, instead of writing each test at its RED step. Cucumber acceptance proof still comes from matching step definitions and `test:bdd`. When `.safeword/config.json` sets `bdd.conventions`, read that doc and follow its stub shape, verification lane, and tag rules over these defaults.

- Default: a native vitest skeleton — one `describe` per rule, `it.todo` per scenario (`--red` for failing bodies); print to stdout or `--out <path>`.
- `--format gherkin`: prints the feature source when one exists; on legacy tickets, emits a migration `.feature` from markdown scenarios.

Either way `.feature` is the scenario source of truth. test-definitions.md is the R/G/R ledger for checkboxes and hooks.

**Avoid bloat.**

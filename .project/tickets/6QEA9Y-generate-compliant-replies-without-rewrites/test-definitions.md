# Test Definitions: Generate compliant replies without correction loops

Feature source: `features/generate-compliant-replies-without-rewrites.feature`

test-definitions.md is the R/G/R ledger.

## Rule: generate-compliant-replies-without-rewrites.NTB1.R1 — A compliant first completion finishes without a format-correction turn

### Scenario: A complete CONFIDENT brief finishes on the first Stop

- [x] RED c8a976988
- [x] GREEN 6ee8a7689
- [x] REFACTOR skip: minimal first slice is clear; grammar expansion belongs to later scenarios

### Scenario: A complete BLOCKED brief finishes with Need as its terminal action

- [x] RED a0691b36f
- [x] GREEN ee2d9f183
- [x] REFACTOR skip: shared variant table is already the smallest clear structure

### Scenario: A near-complete first reply cannot silently pass

- [x] RED skip: rejection was already established by the first parser slice; this characterization passed on its first run
- [x] GREEN 348a7c14b
- [x] REFACTOR skip: the characterization reuses the existing real-hook fixture without adding production structure

### Scenario: A builder sees one completion in a live Claude session

- [x] RED c8a976988
- [x] GREEN skip: local Claude API rejected all available models before the edit; see manual-acceptance.md
- [x] REFACTOR skip: unavailable external runtime produced no implementation structure to improve

### Scenario: An unavailable live runtime is recorded as a verification limitation

- [x] RED c8a976988
- [x] GREEN 4c709d939
- [x] REFACTOR skip: the evidence boundary is already explicit and minimal

## Rule: generate-compliant-replies-without-rewrites.NTB1.R2 — A non-compliant completion receives one actionable correction rather than an unbounded rewrite loop

### Scenario: A first non-compliant reply receives the canonical correction

- [x] RED skip: the earlier Stop slice already emitted the canonical correction; this scenario characterizes that fallback
- [x] GREEN cc97e0d0e
- [x] REFACTOR skip: the shared real-hook runner already expresses the correction boundary clearly

### Scenario: A correction attempt cannot trigger another format rewrite

- [x] RED skip: the pre-existing Stop loop guard already allowed the correction iteration; this scenario locks in its precedence
- [x] GREEN cc97e0d0e
- [x] REFACTOR skip: no new production path was needed beyond the existing early loop guard

## Rule: generate-compliant-replies-without-rewrites.TBU1.R1 — The exact phase-neutral contract is available before the first response and restored after compaction

### Scenario: Session boundaries deliver the same exact terminal contract

- [x] RED 8242be8e6
- [x] GREEN 3ada5ece9
- [x] REFACTOR 98b034592

### Scenario: Startup context excludes phase-specific completion evidence

- [x] RED 435f1a55e
- [x] GREEN 5a7dbe71d
- [x] REFACTOR skip: the phase-neutral contract is composed only at the Claude session boundary

## Rule: generate-compliant-replies-without-rewrites.TBU1.R2 — Quiet TDD turns retain the lead-only cue instead of the full decision-brief demand

### Scenario: Every active TDD step rejects the full decision-brief demand

- [x] RED skip: lead-only TDD behavior already existed; the new acceptance outline characterized all three steps
- [x] GREEN f38d58283
- [x] REFACTOR skip: the existing shared TDD-step derivation remains the smallest implementation

### Scenario: An ordinary work update retains the compact decision-brief reminder

- [x] RED a0691b36f
- [x] GREEN ee2d9f183
- [x] REFACTOR skip: one compact shared reminder serves the ordinary prompt boundary

## Rule: generate-compliant-replies-without-rewrites.TBU1.R3 — Format compliance never bypasses dependency, test, architecture, or done gates

### Scenario: A hard gate wins on every Stop iteration

- [x] RED skip: hard-gate precedence predated this feature; the real-hook matrix characterizes both iterations
- [x] GREEN f38d58283
- [x] REFACTOR skip: the format check remains after every hard gate without moving existing branches

### Scenario: Typecheck advice precedes format pass-through on the first Stop

- [x] RED skip: existing typecheck precedence was preserved and characterized with a real failing TypeScript project
- [x] GREEN f38d58283
- [x] REFACTOR skip: source order already expresses the intended advisory precedence

### Scenario: The correction loop guard runs after hard gates

- [x] RED skip: the pre-existing loop guard already occupied the required boundary
- [x] GREEN f38d58283
- [x] REFACTOR skip: no production restructuring was needed

### Scenario: A compliant first Stop emits no redundant format correction

- [x] RED c8a976988
- [x] GREEN 6ee8a7689
- [x] REFACTOR skip: compliant pass-through is a single terminal predicate

## Rule: generate-compliant-replies-without-rewrites.SWM1.R1 — One phase-neutral definition supplies both proactive context and terminal-format validation

### Scenario: Configured hooks follow one changed canonical contract

- [x] RED 8242be8e6
- [x] GREEN 3ada5ece9
- [x] REFACTOR 98b034592

### Scenario: Every distribution boundary handles contract drift

- [x] RED c8a976988
- [x] GREEN f38d58283
- [x] REFACTOR skip: existing setup, generator, diff, and parity validators required no new abstraction

## Rule: generate-compliant-replies-without-rewrites.SWM1.R2 — CONFIDENT and BLOCKED compliance is deterministic and matches the canonical paragraph grammar

### Scenario: Accepted boundary shapes remain deterministic

- [x] RED aea6768be
- [x] GREEN a1ee17f5f
- [x] REFACTOR skip: one ordered grammar table covers both verdict variants

### Scenario: Adversarial terminal shapes are rejected deterministically

- [x] RED 96617e769
- [x] GREEN 19bf51160
- [x] REFACTOR 5710456b7

### Scenario: Ignored Markdown content does not poison a valid terminal brief

- [x] RED 8242be8e6
- [x] GREEN 3ada5ece9
- [x] REFACTOR skip: the existing explicit block-state scanner accepted the added CommonMark partitions without another production abstraction

### Scenario: Adversarial parser work remains linear

- [x] RED 96617e769
- [x] GREEN 19bf51160
- [x] REFACTOR 5710456b7

### Scenario: The parser stays within the hook budget on the reference runner

- [x] RED c8a976988
- [x] GREEN 4c709d939
- [x] REFACTOR skip: the benchmark found no performance smell requiring code changes

---

## Feature-level cross-scenario refactor

- [x] cross-scenario 98b034592

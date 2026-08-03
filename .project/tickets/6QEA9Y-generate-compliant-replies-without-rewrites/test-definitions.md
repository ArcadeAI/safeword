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
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A near-complete first reply cannot silently pass

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A builder sees one completion in a live Claude session

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An unavailable live runtime is recorded as a verification limitation

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: generate-compliant-replies-without-rewrites.NTB1.R2 — A non-compliant completion receives one actionable correction rather than an unbounded rewrite loop

### Scenario: A first non-compliant reply receives the canonical correction

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A correction attempt cannot trigger another format rewrite

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: generate-compliant-replies-without-rewrites.TBU1.R1 — The exact phase-neutral contract is available before the first response and restored after compaction

### Scenario: Session boundaries deliver the same exact terminal contract

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Startup context excludes phase-specific completion evidence

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: generate-compliant-replies-without-rewrites.TBU1.R2 — Quiet TDD turns retain the lead-only cue instead of the full decision-brief demand

### Scenario: Every active TDD step rejects the full decision-brief demand

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An ordinary work update retains the compact decision-brief reminder

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: generate-compliant-replies-without-rewrites.TBU1.R3 — Format compliance never bypasses dependency, test, architecture, or done gates

### Scenario: A hard gate wins on every Stop iteration

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Typecheck advice precedes format pass-through on the first Stop

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: The correction loop guard runs after hard gates

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A compliant first Stop emits no redundant format correction

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: generate-compliant-replies-without-rewrites.SWM1.R1 — One phase-neutral definition supplies both proactive context and terminal-format validation

### Scenario: Configured hooks follow one changed canonical contract

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Every distribution boundary handles contract drift

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: generate-compliant-replies-without-rewrites.SWM1.R2 — CONFIDENT and BLOCKED compliance is deterministic and matches the canonical paragraph grammar

### Scenario: Accepted boundary shapes remain deterministic

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Adversarial terminal shapes are rejected deterministically

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Ignored Markdown content does not poison a valid terminal brief

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Adversarial parser work remains linear

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: The parser stays within the hook budget on the reference runner

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

---

## Feature-level cross-scenario refactor

- [ ] cross-scenario

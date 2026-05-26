# Test Definitions: 7YN5QB — personas.md + Phase 0 validation

**Ticket:** [ticket.md](./ticket.md)
**Dimensions:** [dimensions.md](./dimensions.md)

Six rules, 31 scenarios. R/G/R checkboxes are load-bearing — the prompt hook parses them during Phase 6 to inject per-scenario TDD-step guidance.

**Note on R/G/R discipline (retroactive, 2026-05-26):** The 31 scenarios below were implemented in slice-level batches (A1 derivation, A2 parser/resolver/validator, A3 lookup + I/O, B template + schema, D check command, E DISCOVERY.md) rather than per-scenario RED → GREEN → REFACTOR cycles. This is a documented discipline gap with five root-cause guardrail failures catalogued in [H7M3KQ](../H7M3KQ/ticket.md). Each scenario's RED and GREEN are marked `skip:` with the slice commit they actually shipped under; REFACTOR is marked `skip:` referencing the single feature-level cross-scenario refactor at `cc0c8395` (`PersonaReferenceResult` discriminated union). The `skip:` annotations document the deviation honestly — bare `[x]` would be blocked by the write-time hook.

**Design notes (resolved during Phase 3 + Phase 4 adversarial pass):**

- `validatePersonaRef` is strict on casing — `"po"` against existing `PO` returns `{ status: 'unknown', suggestion: 'PO' }`. Lenient matching would silently alias persona codes that legitimately differ by case (`PO` vs `Po` vs `PO2`); strict + suggestion catches the typo at the validation boundary.
- Single-character persona names rejected at `safeword check`. Padding (`A` → `AA`) produces meaningless codes; strict-by-default per modern Postel's-law reading.
- Digits are preserved during derivation (codes legitimately allow digits per the existing collision-suffix policy `PO2`); digit-first names produce non-conformant codes and error with an explicit-override prompt.
- Derivation overflow truncates silently to first 6 characters (git SHA / POSIX filename precedent; truncation visible after save).
- Duplicate persona names rejected at `safeword check` (names are unique human identifiers; ref lookup would otherwise be ambiguous).
- `validatePersonaRef` returns `{ status: 'unknown' }` on missing/unreadable `personas.md` — degrade gracefully at I/O boundary; strict validation lives in `safeword check`.

---

## Rule: Setup scaffolding is idempotent and non-destructive

### Scenario: Scaffolds personas.md when absent

Given a project with no `.safeword-project/personas.md` file
When `safeword setup` runs
Then `.safeword-project/personas.md` exists with the template format header and a commented-out example persona block

- [x] RED skip: batched implementation — see header note (H7M3KQ discipline gap)
- [x] GREEN skip: batched implementation — see header note (H7M3KQ discipline gap)
- [x] REFACTOR skip: cross-scenario refactor at cc0c8395

### Scenario: No-op when personas.md is the unmodified scaffold

Given `.safeword-project/personas.md` exists with only the template scaffold content (header + commented example, no real persona blocks)
When `safeword setup` runs again
Then the file is unchanged byte-for-byte

- [x] RED skip: batched implementation — see header note (H7M3KQ discipline gap)
- [x] GREEN skip: batched implementation — see header note (H7M3KQ discipline gap)
- [x] REFACTOR skip: cross-scenario refactor at cc0c8395

### Scenario: Preserves user content on re-run

Given `.safeword-project/personas.md` exists with one user-authored persona block ("## Platform Operator (PO)" with a Role line)
When `safeword setup` runs again
Then the file contents are unchanged byte-for-byte and the user's persona block is preserved

- [x] RED skip: batched implementation — see header note (H7M3KQ discipline gap)
- [x] GREEN skip: batched implementation — see header note (H7M3KQ discipline gap)
- [x] REFACTOR skip: cross-scenario refactor at cc0c8395

---

## Rule: Short codes auto-derive from names

### Scenario: Multi-word two-word name derives first-letter-of-each-word

Given personas.md contains a block "## Platform Operator" with a Role line and no parenthesized code
When `safeword check` runs (triggering derivation)
Then the block header is rewritten to "## Platform Operator (PO)"

- [x] RED skip: batched implementation — see header note (H7M3KQ discipline gap)
- [x] GREEN skip: batched implementation — see header note (H7M3KQ discipline gap)
- [x] REFACTOR skip: cross-scenario refactor at cc0c8395

### Scenario: Multi-word three-word name derives all initials

Given personas.md contains a block "## Site Reliability Engineer" with a Role line and no code
When `safeword check` runs
Then the block header is rewritten to "## Site Reliability Engineer (SRE)"

- [x] RED skip: batched implementation — see header note (H7M3KQ discipline gap)
- [x] GREEN skip: batched implementation — see header note (H7M3KQ discipline gap)
- [x] REFACTOR skip: cross-scenario refactor at cc0c8395

### Scenario: Single-word name derives first 2 characters uppercased

Given personas.md contains a block "## Auditor" with a Role line and no code
When `safeword check` runs
Then the block header is rewritten to "## Auditor (AU)"

- [x] RED skip: batched implementation — see header note (H7M3KQ discipline gap)
- [x] GREEN skip: batched implementation — see header note (H7M3KQ discipline gap)
- [x] REFACTOR skip: cross-scenario refactor at cc0c8395

### Scenario: Non-alpha characters stripped before derivation

Given personas.md contains a block "## Bob's Burger" with a Role line and no code
When `safeword check` runs
Then the block header is rewritten to "## Bob's Burger (BB)" (apostrophe stripped before initials extracted)

- [x] RED skip: batched implementation — see header note (H7M3KQ discipline gap)
- [x] GREEN skip: batched implementation — see header note (H7M3KQ discipline gap)
- [x] REFACTOR skip: cross-scenario refactor at cc0c8395

### Scenario: Leading and trailing whitespace in name is trimmed

Given personas.md contains a block "## Platform Operator " with surrounding whitespace, a Role line, and no code
When `safeword check` runs
Then the block header is rewritten to "## Platform Operator (PO)" with whitespace normalized

- [x] RED skip: batched implementation — see header note (H7M3KQ discipline gap)
- [x] GREEN skip: batched implementation — see header note (H7M3KQ discipline gap)
- [x] REFACTOR skip: cross-scenario refactor at cc0c8395

### Scenario: Digits preserved in single-word derivation

Given personas.md contains a block "## S3" with a Role line and no code
When `safeword check` runs
Then the block header is rewritten to "## S3 (S3)" (digit kept as the second character of the derived code; pattern allows letters and digits after the leading letter)

- [x] RED skip: batched implementation — see header note (H7M3KQ discipline gap)
- [x] GREEN skip: batched implementation — see header note (H7M3KQ discipline gap)
- [x] REFACTOR skip: cross-scenario refactor at cc0c8395

### Scenario: Digit-first name errors with explicit-override prompt

Given personas.md contains a block "## 3 Amigos" with a Role line and no code
When `safeword check` runs (which triggers derivation producing the non-conformant code `3A`)
Then check exits non-zero with an error referencing the line and the message "name produces non-conformant code — author explicit code via `## Name (CODE)`"

- [x] RED skip: batched implementation — see header note (H7M3KQ discipline gap)
- [x] GREEN skip: batched implementation — see header note (H7M3KQ discipline gap)
- [x] REFACTOR skip: cross-scenario refactor at cc0c8395

### Scenario: Derivation overflow truncates to 6 characters

Given personas.md contains a block "## International Atomic Energy Agency Inspection Sub Department" with a Role line and no code (derivation produces 7 initials: `IAEAISD`)
When `safeword check` runs
Then the block header is rewritten with the code truncated to the first 6 characters: `(IAEAIS)`

- [x] RED skip: batched implementation — see header note (H7M3KQ discipline gap)
- [x] GREEN skip: batched implementation — see header note (H7M3KQ discipline gap)
- [x] REFACTOR skip: cross-scenario refactor at cc0c8395

---

## Rule: Code collisions resolve predictably

### Scenario: Fresh code derives without suffix

Given personas.md contains only the block "## End User" with no code and no existing code conflicts
When `safeword check` runs
Then the block header is rewritten to "## End User (EU)" with no numeric suffix

- [x] RED skip: batched implementation — see header note (H7M3KQ discipline gap)
- [x] GREEN skip: batched implementation — see header note (H7M3KQ discipline gap)
- [x] REFACTOR skip: cross-scenario refactor at cc0c8395

### Scenario: Single collision appends suffix 2

Given personas.md contains the existing block "## Platform Operator (PO)" and a new block "## Product Owner" with no code
When `safeword check` runs
Then the new block header is rewritten to "## Product Owner (PO2)"

- [x] RED skip: batched implementation — see header note (H7M3KQ discipline gap)
- [x] GREEN skip: batched implementation — see header note (H7M3KQ discipline gap)
- [x] REFACTOR skip: cross-scenario refactor at cc0c8395

### Scenario: Chain collision advances to next available suffix

Given personas.md contains "## Platform Operator (PO)", "## Product Owner (PO2)", and a new block "## Partner Org" with no code
When `safeword check` runs
Then the new block header is rewritten to "## Partner Org (PO3)"

- [x] RED skip: batched implementation — see header note (H7M3KQ discipline gap)
- [x] GREEN skip: batched implementation — see header note (H7M3KQ discipline gap)
- [x] REFACTOR skip: cross-scenario refactor at cc0c8395

### Scenario: Auto-derived collides with user-authored explicit code

Given personas.md contains "## Partner Org (PO)" with a user-authored explicit code, and a new block "## Platform Operator" with no code
When `safeword check` runs
Then the new block header is rewritten to "## Platform Operator (PO2)" (the user-authored explicit code wins; the auto-derived one takes the suffix)

- [x] RED skip: batched implementation — see header note (H7M3KQ discipline gap)
- [x] GREEN skip: batched implementation — see header note (H7M3KQ discipline gap)
- [x] REFACTOR skip: cross-scenario refactor at cc0c8395

---

## Rule: User-authored explicit codes are validated, not re-derived

### Scenario: Valid explicit code is respected verbatim

Given personas.md contains "## Platform Operator (PLATOPS)" matching the pattern `^[A-Z][A-Z0-9]{1,5}$`
When `safeword check` runs
Then the block header is unchanged and validation passes

- [x] RED skip: batched implementation — see header note (H7M3KQ discipline gap)
- [x] GREEN skip: batched implementation — see header note (H7M3KQ discipline gap)
- [x] REFACTOR skip: cross-scenario refactor at cc0c8395

### Scenario: Malformed explicit code is rejected with line ref

Given personas.md contains "## Platform Operator (po)" with a lowercase code
When `safeword check` runs
Then check exits non-zero with an error referencing the line number and the pattern violation

- [x] RED skip: batched implementation — see header note (H7M3KQ discipline gap)
- [x] GREEN skip: batched implementation — see header note (H7M3KQ discipline gap)
- [x] REFACTOR skip: cross-scenario refactor at cc0c8395

### Scenario: Explicit code colliding with existing code is rejected

Given personas.md contains "## End User (EU)" and a later block "## Engineering Unit (EU)" with the same explicit code
When `safeword check` runs
Then check exits non-zero with an error naming both line numbers and the duplicate code

- [x] RED skip: batched implementation — see header note (H7M3KQ discipline gap)
- [x] GREEN skip: batched implementation — see header note (H7M3KQ discipline gap)
- [x] REFACTOR skip: cross-scenario refactor at cc0c8395

---

## Rule: `safeword check` validates personas.md

### Scenario: Well-formed file passes validation

Given personas.md contains two persona blocks each with a valid code matching pattern, a name, and a Role line
When `safeword check` runs
Then check exits 0 with no errors

- [x] RED skip: batched implementation — see header note (H7M3KQ discipline gap)
- [x] GREEN skip: batched implementation — see header note (H7M3KQ discipline gap)
- [x] REFACTOR skip: cross-scenario refactor at cc0c8395

### Scenario: Duplicate codes exits non-zero with line refs

Given personas.md contains two persona blocks with identical codes (`PO`)
When `safeword check` runs
Then check exits non-zero with an error naming both line numbers and the duplicate code

- [x] RED skip: batched implementation — see header note (H7M3KQ discipline gap)
- [x] GREEN skip: batched implementation — see header note (H7M3KQ discipline gap)
- [x] REFACTOR skip: cross-scenario refactor at cc0c8395

### Scenario: Code violating pattern exits non-zero with line ref

Given personas.md contains "## Platform Operator (2PO)" with a code starting with a digit
When `safeword check` runs
Then check exits non-zero with an error referencing the line and the pattern violation

- [x] RED skip: batched implementation — see header note (H7M3KQ discipline gap)
- [x] GREEN skip: batched implementation — see header note (H7M3KQ discipline gap)
- [x] REFACTOR skip: cross-scenario refactor at cc0c8395

### Scenario: Missing Role line exits non-zero

Given personas.md contains "## Platform Operator (PO)" but the block has no `Role:` line
When `safeword check` runs
Then check exits non-zero with an error referencing the block header line and "missing Role"

- [x] RED skip: batched implementation — see header note (H7M3KQ discipline gap)
- [x] GREEN skip: batched implementation — see header note (H7M3KQ discipline gap)
- [x] REFACTOR skip: cross-scenario refactor at cc0c8395

### Scenario: Block header without name exits non-zero

Given personas.md contains a malformed block "## (PO)" with no name before the parenthesized code
When `safeword check` runs
Then check exits non-zero with an error referencing the line and "missing persona name"

- [x] RED skip: batched implementation — see header note (H7M3KQ discipline gap)
- [x] GREEN skip: batched implementation — see header note (H7M3KQ discipline gap)
- [x] REFACTOR skip: cross-scenario refactor at cc0c8395

### Scenario: Single-character name exits non-zero

Given personas.md contains "## A" with a Role line (name is one character)
When `safeword check` runs
Then check exits non-zero with an error referencing the line and "persona name must be at least 2 characters"

- [x] RED skip: batched implementation — see header note (H7M3KQ discipline gap)
- [x] GREEN skip: batched implementation — see header note (H7M3KQ discipline gap)
- [x] REFACTOR skip: cross-scenario refactor at cc0c8395

### Scenario: Duplicate persona names exits non-zero

Given personas.md contains two blocks both with name "Platform Operator" (codes differ via suffix: `PO` and `PO2`)
When `safeword check` runs
Then check exits non-zero with an error naming both line numbers and "duplicate persona name"

- [x] RED skip: batched implementation — see header note (H7M3KQ discipline gap)
- [x] GREEN skip: batched implementation — see header note (H7M3KQ discipline gap)
- [x] REFACTOR skip: cross-scenario refactor at cc0c8395

---

## Rule: `validatePersonaRef` returns valid/unknown with optional suggestion

### Scenario: Matches by exact code returns valid with match

Given personas.md contains "## Platform Operator (PO)"
When `validatePersonaRef("PO")` is called
Then the return value is `{ status: 'valid', match: { name: 'Platform Operator', code: 'PO' } }`

- [x] RED skip: batched implementation — see header note (H7M3KQ discipline gap)
- [x] GREEN skip: batched implementation — see header note (H7M3KQ discipline gap)
- [x] REFACTOR skip: cross-scenario refactor at cc0c8395

### Scenario: Matches by exact full name returns valid with match

Given personas.md contains "## Platform Operator (PO)"
When `validatePersonaRef("Platform Operator")` is called
Then the return value is `{ status: 'valid', match: { name: 'Platform Operator', code: 'PO' } }`

- [x] RED skip: batched implementation — see header note (H7M3KQ discipline gap)
- [x] GREEN skip: batched implementation — see header note (H7M3KQ discipline gap)
- [x] REFACTOR skip: cross-scenario refactor at cc0c8395

### Scenario: Casing mismatch on code returns unknown with suggestion

Given personas.md contains "## Platform Operator (PO)"
When `validatePersonaRef("po")` is called
Then the return value is `{ status: 'unknown', suggestion: 'PO' }`

- [x] RED skip: batched implementation — see header note (H7M3KQ discipline gap)
- [x] GREEN skip: batched implementation — see header note (H7M3KQ discipline gap)
- [x] REFACTOR skip: cross-scenario refactor at cc0c8395

### Scenario: Unknown identifier returns unknown without suggestion

Given personas.md contains only "## Platform Operator (PO)"
When `validatePersonaRef("AdminUser")` is called
Then the return value is `{ status: 'unknown' }` with no suggestion field

- [x] RED skip: batched implementation — see header note (H7M3KQ discipline gap)
- [x] GREEN skip: batched implementation — see header note (H7M3KQ discipline gap)
- [x] REFACTOR skip: cross-scenario refactor at cc0c8395

### Scenario: Empty or null input returns unknown

Given personas.md contains "## Platform Operator (PO)"
When `validatePersonaRef("")` is called
Then the return value is `{ status: 'unknown' }` with no suggestion field

- [x] RED skip: batched implementation — see header note (H7M3KQ discipline gap)
- [x] GREEN skip: batched implementation — see header note (H7M3KQ discipline gap)
- [x] REFACTOR skip: cross-scenario refactor at cc0c8395

### Scenario: Missing personas.md returns unknown

Given `.safeword-project/personas.md` does not exist on disk
When `validatePersonaRef("PO")` is called
Then the return value is `{ status: 'unknown' }` with no suggestion field — no exception thrown

- [x] RED skip: batched implementation — see header note (H7M3KQ discipline gap)
- [x] GREEN skip: batched implementation — see header note (H7M3KQ discipline gap)
- [x] REFACTOR skip: cross-scenario refactor at cc0c8395

---

## Feature-level cross-scenario refactor

One holistic refactor pass across the implementation, performed once all scenarios are GREEN. Per TDD.md the row carries either a commit SHA (proving the refactor landed) or `skip:` (no structural improvement needed).

- [x] cross-scenario cc0c8395

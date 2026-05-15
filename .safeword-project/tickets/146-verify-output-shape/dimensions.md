# Dimensions — Ticket 146

Derived from intake: scope (3-section output), resolved open questions (N=5 cap, aggregate-rest, canonical-template edits, hide-empty-sections), constraints (preserve done-gate evidence patterns).

## Behavioral dimensions

| Dimension                | Partitions                                                                        |
| ------------------------ | --------------------------------------------------------------------------------- |
| Verify state             | all-checks-green / one-or-more-failures                                           |
| Failure category         | test-suite / build / lint / scenarios / dep-drift / mixed                         |
| Unchecked scenario count | 0, 1-5 (within cap), >5 (triggers aggregation)                                    |
| Decisions-needed count   | 0 (no user input needed), 1-5, >5                                                 |
| Decision type            | spec / scope / value (allowed) vs. implementation-path (forbidden)                |
| Agent-next-actions count | 0, 1-5, >5                                                                        |
| Evidence patterns        | preserved (`✓ X/X tests pass`, `All N scenarios marked complete`, `Audit passed`) |
| Empty section handling   | hidden when zero items                                                            |
| All-green collapse       | single-line "Ready to mark done" verdict when no decisions/actions needed         |

## Boundary cases

- Zero failures + zero decisions + zero actions → collapse to single-line verdict
- Exactly 5 unchecked scenarios → all listed, no aggregation
- 6+ unchecked scenarios → top-5 + "+ N others, see test-definitions.md"
- Decision section with 0 items → hidden entirely (not "None")
- Actions section with 0 items → hidden entirely
- Implementation-path question mistakenly placed in Decisions section → fails the contract; agent must reclassify or move to Actions

## Rule mapping

- Verify state × Failure category × Evidence patterns → **Rule: Status section preserves existing checklist + done-gate evidence patterns**
- Decision type × Decisions-needed count → **Rule: Decisions section contains only spec/scope/value questions, never implementation paths**
- Agent-next-actions count → **Rule: Actions section commits to concrete forward motion**
- Caps + aggregation → **Rule: Hard cap N=5 per section; aggregate rest**
- Empty section handling → **Rule: Empty sections hidden; all-green collapses to single-line verdict**

## Out-of-scope dimensions

- Auto-fixing identified gaps (still surfaces them; agent does not apply fixes).
- Test-pinning-bugs check (separate concern; deferred).
- Changing what /verify checks (only the report format changes).
- Adjusting test-definitions.md tracking format.

## Card-ratio self-check

- **Rules:** 5. Each gets 2-4 scenarios.
- **Target scenarios:** ~14.
- **Open questions remaining at this phase:** 0 (all resolved in intake-final per spec-vs-impl contract).

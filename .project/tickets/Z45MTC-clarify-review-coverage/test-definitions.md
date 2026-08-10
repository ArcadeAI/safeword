# Test Definitions: Make review coverage clear without false alarms

Feature source: `packages/cli/features/clarify-review-coverage.feature`

Each scenario below uses the RED → GREEN → REFACTOR loop.

- [x] Validated reviews use calm coverage vocabulary (14 rows)
- [x] Invalid or incomplete provenance never becomes completed coverage (19 rows)
- [x] Presentation rejects inconsistent policy and status as completed coverage (17 rows)
- [x] Exhausted typed routes remain incomplete
- [x] Required independence remains unsatisfied by standard coverage (2 rows)
- [x] Requested details offer one typed independent-coverage improvement (24 rows)
- [x] Untrusted typed fields and reviewer prose cannot create upgrade guidance (6 rows)
- [x] Human vocabulary leaves the typed JSON envelope unchanged
- [x] Real machine envelopes retain the pre-vocabulary schema (4 rows)
- [x] Requested changes suppress optional coverage upgrades
- [x] Non-eligible review states never offer a coverage upgrade (4 rows)
- [x] Real CLI modes preserve precedence and wire separation (6 rows)
- [x] Real CLI presents completed coverage and verdicts (8 rows)
- [x] Real CLI enforces required independence and preserves or supplies recovery (5 rows)
- [x] Blocked CLI modes preserve action-required precedence (2 rows)
- [x] Existing reviewer content follows the new coverage line (2 rows)
- [x] Host fallback wording stays supplemental and policy-safe (4 rows)
- [x] Supplemental host fallback cannot claim completed machine coverage
- [x] Generated review contract distribution facets are current (6 rows)

For each item, record RED, GREEN, and REFACTOR evidence in `ticket.md` as it is
completed. For every Scenario Outline, the evidence must name each example row
or the generated finite-domain count and prove the whole table executed.

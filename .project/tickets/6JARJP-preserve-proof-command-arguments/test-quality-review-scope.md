# Test-quality assessment scope

The user requested an assessment of BDD and TDD proof quality after Draft #5897.
Review the 21 added regression cases in the three supplied test files against
their current production collaborators and evidence/source-diff.patch.

Judge assertion discrimination, vacuity, positive/negative pairing, process
boundary realism, malformed-input preservation, and integration coverage. The
scope is repeated flags, empty operands, JSON backslashes and field-specific
diagnostics. Report specific gaps without requiring a whole #4200 rewrite.

Both current-head CI Node jobs passed the final test text. Earlier local RED
and GREEN logs are retained. No new feature scenarios were added for the dense
parser matrix. Separate scenario reviews are assessing the existing 7CAMAD,
A639WN and 6XW8H7 contracts and proof mappings.

Standalone reversion probes matched the added assertion boundaries and detected
six current-vs-baseline behavior differences and deletion of the command
exact-key check. These were direct source probes using Node assertions, not
executions of the Vitest tests under a mutation runner. The runtime diagnostic
has historical subprocess RED and current-head CI GREEN evidence.

Do not confuse baseline acceptance-contract gaps with newly introduced patch
regressions; name both with their actual scope when relevant.

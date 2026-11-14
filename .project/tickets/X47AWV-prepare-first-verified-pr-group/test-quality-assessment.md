# Landing-group BDD and TDD quality assessment

Scope: the four implemented behavior contracts (G1C9PP, 7CAMAD, 6XW8H7,
A639WN), their scenario ledgers and proof mappings, and the critical approval,
review identity, slicing, checklist and coding-authorization tests. This is a
scenario-by-scenario assessment of those contracts and a risk-based assessment
of their executable proof. It is not a claim that every test in the repository
or every unimplemented epic child has received a new quality review.

## Findings and repairs

1. G1C9PP had 48 feature scenarios and 53 ledger scenario headings. Added the
   existing malformed-configuration and canonical-exit behaviors to the feature
   and proof manifest. Reclassified three internal ledger/parser regressions as
   supporting unit regressions, preserving their test code and historical rows.
   The feature and acceptance ledger now agree at 50 named scenarios.
2. 7CAMAD's R17 adapter expected two passing tests but selected seven after the
   backport. A real Cucumber run reproduced both example failures. The selector
   now names only routing rows and expects eight, including the two new native
   unchanged-approach recovery rows. It excludes the ordinary-task test.
3. Made the repeated-approval bypass and legitimate unchanged-approach recovery
   explicit R17 scenarios with both human settings. Kept the original repeated
   approval assertion and its original RED log. Fresh review can clear a retained
   discovery without changing approach bytes; a prior human decision still
   applies to identical bytes. Changed approaches still need a fresh decision.
4. Slicing's installed-dispatch scenario pointed only to a static prompt digest
   test. It now points to the real public CLI recorder test, strengthened to
   check both dispatched contract hashes, all five slicing obligations and the
   exact canonical rubric. Only the external reviewer process is replaced.
5. Checklist applicability rejection pointed only to a corpus-ID assertion. It
   now points to the existing public CLI rejection test. This proves the CLI
   handles a rejecting reviewer and keeps the obligation open; it does not prove
   a real model will make that judgment. The blank-reason rejection already has
   a discriminating lower-level test; no duplicate was added.
6. Several ledger RED skips described passing live verification, and two entries
   repeated the same RED reference three times. Added corrections without
   rewriting historical checked rows. Safeword's history guard rejected replacing
   those rows, so the original entries remain visible with their correction.
7. Clarified that live verdict failures cannot be retried away. Infrastructure
   retries remain distinct observations with their initial failure retained.

## TDD history is weaker than current regression proof

`evidence/test-quality/lineage.json` compares every named scenario with its
ledger and checks ancestry for unambiguous RED/GREEN/REFACTOR commit references.
Nine RED references are not ancestors of their named GREEN references. For
example, G1C9PP R1's RED b1727e245 was committed after GREEN 828d8af75, and
7CAMAD's currency RED 7cead12f6 follows GREEN 153b78709. These references cannot
establish a test-first sequence. They may characterize existing behavior or
record later strengthening; no historical failure is reconstructed or invented.
Slicing's questioned f6e67f8ad -> 1c4d56d07 -> ee9ce897b ordering is valid.

The new unchanged-approach rows are characterization tests of the existing
human-authority policy. They passed without a production change. Their value is
the opposing case: a retained discovery refuses the old semantic receipt before
fresh review, then accepts fresh review without demanding another human decision
for the same bytes. They are not represented as a new feature's RED/GREEN cycle.

## Proof strengths and limits

- Approval repair: real CLI, real review-job integrity and currency, temporary
  project state, and real PTY decisions. The external reviewer is deterministic,
  so these tests prove admission and recovery, not semantic model competence.
- Native context: real packet capture and public CLI/copy-of-plugin replay;
  identity tests distinguish semantic changes from phase/progress-only changes.
- Slicing/checklist: output validators and filesystem/Git proof execution have
  meaningful positive and negative cases. Corpus-shape checks preserve fixtures
  and route-admission identity; they cannot prove semantic verdicts.
- `delivery-checklist-cli.test.ts` exercises public handlers but mocks review-job
  lookup/start. Its name does not make it an installed subprocess test. Real CLI
  prerequisite, unreadable-plan, review-wiring and authorization tests provide
  adjacent wiring proof; those scopes must remain distinct in reports.
- Scenario outlines generally vary coherent behavioral dimensions, have opposing
  outcomes, and isolate fixtures. The approval matrix combines stages of one
  recovery journey; early assertions localize the failed stage rather than
  asserting private helper calls. Retained proof has a positive control showing
  that its subprocess marker would detect an accidental rerun.

No unchanged 63-case paid qualification was repeated. Historical Sol/Claude
qualification remains prior-revision evidence, not a new current-head run.
The separate ledger-recovery branch and its failures remain outside this proof.
OpenCode/cloud accepted cases remain deferred exactly as before.

## Independent assessment

Four scenario packets included each child's spec, ticket exclusions, dimensions,
the parent spec, principles, personas and surfaces. Claude Opus independently
reviewed all four: d3592e8c-0c10-486f-894e-6d4f6eccde14 requested the G1C9PP lineage
repair; 50c48a6a-44a7-453a-9204-5ab7990b015e, 42692fce-cdf3-49e9-b687-d73ef95a95b6,
and a35789a9-0c57-4307-a225-183df251f77f approved with warnings. Changed packets
require refreshed review before the final decision record.

Non-blocking warnings retained: slicing has no separate file-count-only semantic
corpus case; model-driven positive examples still require live judgment rather
than echoing authored plans; owner resolution and non-convergence in the repair
demo are guidance-level limitations; canonical-contract invalidation and changed
human approval have stronger executable tests than the original R16/R17 prose.
Adding a semantic corpus case would change admission identity and qualification
cost; that optional expansion is not needed for this approval-repair landing.

Verification and final review: pending at this checkpoint.

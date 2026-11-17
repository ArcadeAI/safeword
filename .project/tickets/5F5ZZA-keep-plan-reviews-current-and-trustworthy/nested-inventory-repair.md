# Admit the project's nested persona inventories

Follow-up to the #5051 test-quality assessment and Claude rejection
`6c9b1219-80f5-4d8b-bdd8-534eb286996f`. The real unchanged parent Product Plan
stores its persona-outcome inventory in a nested list. The inherited validator
treated the label's empty inline paragraph as a blank inventory. Enabling that
validator at Product/scenario admission exposed a false refusal that the new
inline-only fixtures missed.

## Repair and proof

The validator accepts nonblank nested lists belonging to the inventory label's
own list item. Existing inline behavior, other required-field checks, blank
refusal and uniqueness are retained. Comment-only descendants are normalized
away. This is a structural nonblank check; semantic review owns whether the
recorded persona outcomes are complete or useful. Accepted specs and scope
remain unchanged. Canonical contract/copy checks, semantic identity derivation,
native identity, approval repairs and #5086 fallback code are unchanged.

- RED `159db446f`: one real installed-distribution Product-dispatch failure;
  four unrelated cases filtered. The populated nested inventory was refused
  with `missing_planning_context`.
- GREEN `9f5aef4c5`: all five Product cases pass. Expanded Product/scenario
  integration verification passes 18 cases, including nested inventory approval
  with actual packet content and missing/blank refusal before reviewer execution.
  Product controls additionally refuse comment-only nested lists, unrelated
  siblings and duplicate inventories. These additional controls are
  characterization coverage, not separately claimed RED cycles.
- An intermediate patch applied the visitor signature to the wrong local
  function. Its run failed two cases and passed three. The stray change was
  corrected, and the failure is retained rather than labeled an intended RED.
- The unchanged real parent now validates. Preparing the original actual
  scenario-gate packet with unchanged child/parent/ticket/dimensions and current
  principles/personas/surfaces now succeeds. This proves admission, not an
  independent scenario verdict or executable BDD completion.
- Independent Claude review `3336f72a-a2a4-4032-adf1-f4e4f55cc3aa` approves
  the full validator source and both changed integration files; actual reviewer
  Claude, reported model opus, cross-agent. Signed status rechecked approved.
  Earlier rejection and this approval are retained in `evidence/5051-main/`.
- All five derived surfaces regenerated, including lifecycle verification;
  subsequent static freshness passes. Compiled bundles were regenerated from
  reviewed source, not independently inspected as raw bundles.

Final `scripts/dev bun run test` passes: CLI 706 files, 11,489 passed and
14 skipped (924.10 seconds); relay nine files, 198 passed and one skipped;
collector four files, 153 passed. This was one serialized repository command,
with no competing Vitest process observed. Root lint, Gherkin lint and CLI
TypeScript checks pass. Full output is retained as
`evidence/5051-main/nested-inventory-full-repository-test.log.gz`.
No broad ticket phase or scenario-ledger completion is inferred from this repair.

## Remaining observations and disposition

Claude's warnings are answered as follows:

- A label-only nested persona such as `Builder:` is nonblank and can pass, just
  as uninformative inline text already could. No substantive-outcome claim is
  made by the parser; quality remains a semantic reviewer responsibility.
- A second prose paragraph beneath a blank inventory label still refuses.
  This fix supports the accepted nested-list format; broader Markdown layout
  support and clearer malformed-frame diagnostics are deferred.
- The existing recursive field scan can treat a nested entry beginning with a
  Product Bet field label as a duplicate. That inherited limitation is recorded;
  changing field ownership parsing is outside this targeted repair.
- Installed-distribution fixture duplication remains deferred. Product has the
  full malformed-input matrix; scenario tests cover populated/missing/blank,
  relying on the same shared validator for the other internal variations.

The broader assessment's weak generic-result assertion, namespace differential
proof gap, public duplicate-alias proof gap, confirmation-time independent
boundary/currency controls and numeric-spelling coverage remain open. Root BDD
dry-run found 55 source scenario definitions expanding to 166 undefined cases,
with 498 undefined steps. The review's count of 44 definitions was incorrect;
raw output is retained. Package-local Cucumber CI is not proof of that root
feature. No unchanged paid qualification, host/human usability, epic completion,
merge or Ready authority is claimed. The PR remains Draft.

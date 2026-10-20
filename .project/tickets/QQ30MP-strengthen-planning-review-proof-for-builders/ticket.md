---
id: QQ30MP
slug: strengthen-planning-review-proof-for-builders
type: task
phase: implement
status: in_progress
created: 2026-10-20T12:40:50.974Z
last_modified: 2026-10-20T12:40:50.974Z
external_issue: https://github.com/ArcadeAI/safeword/issues/5051
external_prs:
  - https://github.com/ArcadeAI/safeword/pull/5980
scope:
  - strengthen public Product/scenario context and authenticated-disposition tests for residual #5051
  - remove duplicated installed-distribution fixture setup without changing tested behavior
  - correct canonical-contract versus installed-copy wording to match main and preserve contrary reviews
  - run formal verify and diff audit and retain failures and explicit limitations
out_of_scope:
  - changing main canonical-contract or approval behavior, #5086 fallback work or dependency upgrades
  - closing feature 5F5ZZA or epic 82T411, live qualification, merge or Ready promotion
done_when:
  - actionable test-quality findings have discriminating assertions and boundary controls or reasoned dispositions
  - fixture extraction preserves existing assertions and passes its protection tests
  - formal verify and audit results retain their actual revisions and broad completion gaps
---

# Strengthen planning review proof for builders

**Goal:** Apply the authorized test-quality improvements for residual #5051 and run formal verify/audit while preserving #5957 and the broad feature state.

**Why:** Independent reviews exposed missing differential and confirmation-time proofs, weak assertions and duplicated fixture setup.

## Work Log

- 2026-10-20T12:40:50.974Z Started: Created ticket QQ30MP

## Delivery boundary and investigation

Related feature: 5F5ZZA stays scenario-gate/in_progress. This task holds the
user-authorized proof hardening and verification follow-up, following the
bounded delivery pattern in task 3J7TGR / PR #5957. It does not declare broad
scenarios accepted or erase unfinished acceptance and historical qualification.

The /figure-it-out investigation read merged #5957, its delivery task, current
assemblePlanContract and createPlanningReviewIdentity, parent/child contracts
and architecture prose. Runtime already binds exact canonical reviewer bytes
and separately checks installed-copy integrity. The earlier assessment
conflated cosmetic canonical edits with cosmetic installed-copy drift. The
parent is correct on that distinction; the child scenarios and architecture
prose need correction, not runtime changes. Retain rejected review
0b634693-51e0-4592-9b3f-9d460a6ce4cb and its remaining parent/host warnings.

Changing runtime or rewriting the parent was rejected as unnecessary scope.
Choose factual wording repair and bounded proof hardening. Premortem: the task
could hide unfinished feature work; mitigate with direct links, unchanged broad
status and non-green broad verification rather than a completion claim.

Decision-history method: [AWS ADR process](https://docs.aws.amazon.com/prescriptive-guidance/latest/architectural-decision-records/adr-process.html).
Current authority: [merged #5957](https://github.com/ArcadeAI/safeword/pull/5957).

## Proof plan

The nested-inventory blocker in review 6c9b1219 was already repaired before this
follow-up: RED 159db446f, GREEN 9f5aef4c5 and published head 10c725b7d. Populated
nested Product/scenario inventories pass; missing/blank/comment-only/sibling/
duplicate controls refuse before reviewer execution. Eighteen boundary tests,
the full repository suite and repair review 3336f72a-a2a4-4032-adf1-f4e4f55cc3aa
passed. See [repair and limitations](../5F5ZZA-keep-plan-reviews-current-and-trustworthy/nested-inventory-repair.md).
This task preserves and verifies that fix; it does not accept the false refusal.

Use the same immutable test CLI snapshot for runCli and PTY confirmation, removing
their path divergence. Numeric spellings are characterization of existing
Number conversion, deliberately retained rather than a new syntax endorsement.
Strict decimal-only syntax remains a separate compatibility decision.

Canonical/copy evidence is `assemblePlanContract` in
`packages/cli/src/review/packet.ts`, `createPlanningReviewIdentity` in
`packages/cli/src/review/planning-context-identity.ts`, and
`packages/cli/tests/integration/installed-planning-copy-admission.test.ts`.

- Preserve assertions while extracting the shared installed fixture.
- Assert pending job state, configured-namespace packet content and unique
  public targets rather than bare existence or identical fallback fixtures.
- Exercise confirmation-time boundary and receipt changes with ticket bytes
  unchanged; cover supported review kinds and optional severities.
- Pin existing equivalent numeric spellings without tightening public syntax.
- Retain broad BDD, parent currency and host/human qualification limitations.

## Hardening progress

Intake review 5515fe85-cfa8-4ae5-bcbf-12b44ae64876 approved this bounded task;
the packaged helper witnessed its intake exit normally. Refactor cccae7bcc
extracts the shared installed fixture, preserving all assertions. Its two-file
protection run passed 16/16 after waiting for the shared lock; the earlier
lock timeout started no tests and is retained separately. Continue this task's
test-hardening work; edits to the broader feature artifacts do not advance or
close that feature.

| Finding | Required outcome |
| --- | --- |
| Weak generic-result assertion | Assert the start result is pending with no failure and clean up a live worker deterministically. |
| Namespace / duplicate aliases | Assert configured inventory paths and contents with distinct defaults; prove one canonical public target for equivalent aliases. |
| Confirmation-time boundary / receipt | Tests must preserve exact ticket bytes while changing the spec boundary or a bound principle during the prompt, then refuse stale confirmation. A written disposition cannot replace these tests. |
| Supported disposition variants | Cover quality-review, plan-implementation and plan-execution plus info/warning; scenario-gate is deliberately unsupported by the command. |
| Numeric spellings | Characterize `1e0`, `01`, and whitespace-padded ` 1 ` as the existing finding 1. |
| Nested inventory / release / fallback | Preserve the reviewed nested fix; retain named inherited release ownership and #5086 exclusion, with no new qualification claim. |

The final public-target proof also pairs each unowned/private plan rejection
with equivalent aliases, ensuring normalization cannot bypass ownership admission.

## User-requested refactor pass

The user requested refactor after f5110a7b7. The bounded follow-up preserves
public behavior, persisted bytes and all approval/canonical-copy semantics.
Read-only lint/audit and independent command/admission scouts found this ledger:

- [x] Reuse the command's existing optional Finding type for repeated shapes — 08a6f9299; 21 tests passed.
- [x] Share the exact persisted finding fingerprint between writing and reading — 03a18d727; 22 tests passed, fixed hashes protected first in 5e2719a03.
- Deferred after revert: rename private copy-only error names. The broader
  regression run failed the unchanged 500 ms fallback-route timing test; an
  isolated control also failed with the rename absent. Preserve both failures
  and do not alter #5086-related fallback behavior/tests in this refactor.
- Deferred: identical selected-parent fixture text in Product/scenario tests.
  Its extraction is valid but lower priority than the production trust-boundary
  contract; retain local ownership examples during this surgical pass.
- Deferred: duplicated standalone Product dispatch fixtures. A separate fixture
  extraction can reduce setup; this pass caps changes to the three production
cleanups and does not claim that all test duplication is removed.

## Current-head quality-review repairs

At 38ff2f745, CI is green. Fresh source/test review c3fb422b approved the
bounded implementation; documentation review ca97a622 requested changes for
two feature scenarios missing from the RGR ledger and one mismatched title.
Repairing those references yields 55 tracked definitions and 165 unchecked
RGR boxes, not completed behavior or new acceptance. Earlier 0/159 reports
describe the undercounted historical ledger and remain retained.

The source review also identified raw reviewer prose reaching the interactive
consent prompt. Add a failing real CLI/PTY test first, then reuse the existing
terminal text sanitizer while keeping original finding bytes and fingerprints
in authenticated records. This is a bounded correction to the authorized
disposition command, not #5086 fallback work or a change to approval semantics.

Each production entry gets an isolated edit, focused regression run and commit.
No canonical identity, target admission, persisted schema or fallback change
is intended. Prior formal verification and failures remain bound to their
recorded revision; regenerated carriers and fresh audit follow the refactor.

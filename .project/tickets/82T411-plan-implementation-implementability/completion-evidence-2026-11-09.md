# Epic completion reconciliation — 2026-11-09

This is an evidence inventory, not a completion receipt or a scope change.
The authority is this epic's existing `ticket.md` `done_when` list (17 items)
and `spec.md` Rules. No original checkbox, historical RED, approval or status
is changed. GitHub #4200 being closed does not establish these obligations.

## Current reconciliation — 2026-11-13

November 13 update: #7190 is merged as `fd784a2fd` at verified head
`75d96de44`, following explicit user admin-merge authority and successful
checked Ready promotion. The required human review was bypassed, not supplied
by AI review. User elected to wait for upstream ESLint instead of applying the
converter dependency exception: original dependencies stay unchanged, its audit
still fails and no native completion is credited. Original failures, missing
RED, epic status and all 33 deferred cases remain unchanged.

## Historical reconciliation — 2026-11-12

Observed main on November 12 was `8daeec44c`, including #7201's accepted dependency/toolchain
repair. Draft catalogue repair #7190 integrated main at `f7081a0ea` and
passed complete local verification: two CLI passes of 719 files / 11629 tests
each (14 skipped), 599 acceptance scenarios, 52 proof checks, builds, lint,
typechecks and audits. Independent reviews and a real 50-asset offline
installer probe pass. Delivery task VRJ93G is closed at documentation commit
`75d96de44`, pushed to the Draft PR; final-head CI `43271285963` passed first
attempt, including both Node jobs and release lanes.
Implementation-head CI `43260512508` is green after exactly one unchanged
Node 22 job rerun: the first CLI suite passed, but a separate Claude release
check timed out at 30s; the rerun passed all 81 release checks. Both attempts,
every earlier full failure and missing RED remain preserved. No original
epic checkbox, 33-case deferral, Ready state or merge authority changed.
No new native journey is credited. The original converter audit was rerun and
still fails: repository-level dependency repairs do not update installed apps.
A disposable copy using the packed CLI plus one minimatch 11.0.8 override
passes audit, lint/typecheck, 34 process tests and six BDD scenarios; its original
seven source/test/feature/step files match byte-for-byte. This is assisted
diagnostic compatibility evidence only. No real trial dependency or lock changed;
applying it needs an exception to the previous no-major-override restriction.
Merging #7190 is not a production prerequisite for the native trial because it
only changes a test. See the updated critical-path handoff.

## Historical reconciliation — 2026-11-11

Current remote main is `e49310a749b89cccc73faeeb843273bb05c95f08`.
The November 9 sections below are retained chronological evidence: statements
there about local/unmerged branches or a running trial are superseded here.

- Approval preservation #7077 is merged at `e49310a74`; Product Plan scaffold
  repair #7078 is merged at `0cb624eff`. Their final PR CI runs
  `43086247056` and `43083667144` succeeded at exact heads `15cb5dcc1` and
  `b97736b41`. Both were explicitly authorized administrative merges; missing
  human approvals were bypassed, not fabricated or counted as approval proof.
- Integration regenerated the shared plugin identity checksum. Main's tree
  `f079824e3fa3578e8203bb3243dc17254bc0030d` equals the tested combined tree.
  Review found a contract-link definition excluded by Work Log filtering;
  actual RED `b546b62d8`, correction `4d2488ac8`, duplicate-definition RED
  `abeeb9291` and final repair `15cb5dcc1` remain in history. The alleged
  undefined-bracket failure did not reproduce; its control passed.
- Final independent cross-agent code review `738aebf8` approved. Local focused
  checks passed 27 tests; release checks passed 81; lint, typecheck, generated
  freshness and structural audit passed. Older full-suite counts below remain
  tied to their original candidates, not silently reassigned to this head.
- A direct final-head CLI walkthrough on a disposable copy earned independent
  planning approval `e1f3d7bd`: status stayed approved after a Work Log entry
  and became stale after a referenced contract destination changed. Initial
  review `71cdbce9` rejected a stale blanket-dependency-ban explanation in the
  copied plan; its truthful correction did not clear the native audit failure.
  This is CLI proof, not a new native-host journey or an autonomous success.
- **Later main CI is red.** Post-merge run `43090952840` failed on both Node
  22.23.2 and 24.18.1 at `tests/opencode/catalogue.test.ts:86`, “installs the
  complete native catalogue without project host files,” timing out at 60s.
  Each reports 717 passing files, 11,631 passing tests and 10 skipped tests,
  plus that one failure. Required CLI contract/parity, dependency audit,
  conformance and lint pass; deployments skip. Earlier green PR runs remain
  true, but do not make this later main run green. Cause is unconfirmed; no
  retry, timeout increase, suppression or new implementation was performed.
- The native Codex converter remains at verify with the failed tool audit;
  actual 34 process tests and five converter plus one starter scenario remain
  bounded assisted evidence. No native Cursor/cloud journey, enabled-human
  selectivity demonstration or large-feature delivery proof is added here.
- Dispute child `26FK42` is still at plan-implementation on main, with 15
  accepted scenarios, no Implementation/Execution Plan and zero completed
  R/G/R rows. Main's approved-review warning/info decline command is useful
  existing support, not fresh correctness adjudication or durable dispute
  recovery. Read-only reconciliation again returns
  `PARENT_RECONCILIATION_FAILED`; no `--accept` or scope edit was made.

Immediate work: diagnose the one OpenCode installation timeout on exact main,
then resume the accepted dispute child after reviewing its parent-contract
drift. Reconcile remaining existing proof before scheduling more host tests.
The executable handoff is
[next-critical-path-2026-11-11.md](./evidence/next-critical-path-2026-11-11.md).
Raw records, including the later failed main run, are in the permanent trial
archive's `epic-followthrough-2026-11-09/admin-merge-2026-11-11/` and
`epic-followthrough-2026-11-11/`. This inventory grants no scenario credit.

## Evidence used and limits

- Trial root: `/Users/alex/Projects/safeword-trials/2026-11-08-main-da2778353-csv/`.
- Main-only build: `da27783530a740be90d04281e4687883c3fef98e`, as recorded in
  `evidence-run2/SETUP.md`; this is dated build evidence, not a claim about today's main.
- `session-logs/run2-1144046b.jsonl` (E1), original JSONL line numbers below.
- `project-run2/` git history and `.project/tickets/N4DYBQ-tempconv-cli/` (E2).
- `evidence-run2/ISSUES-run2.md` (E3), coordinator report and setup observations.
- Existing bounded implementation mapping:
  `../T3E4NS-keep-bounded-planning-reviews-trustworthy/delivery-proof-map.md` (E4).
  This lists relevant automated proof, with its original boundary limits; no
  tests were rerun in this reconciliation and the map is not a new passing run.
- Run 1 mixed released and cached runtimes. It is retained as a failure and is
  excluded from main-only outcome claims. This is not a clean release/main A/B test.

The source verify record corrects a prior summary: 45 unit tests passed; 17
acceptance scenarios passed, of which **16 are converter scenarios and one is
the starter check**. The ledger groups 14 scenarios; that grouping is distinct
from expanded executable counts. Build was explicitly inapplicable for this
source-run CLI; strict typecheck, lint and formatting were recorded clean.

The project reaches done at `f9b00cf1`, but closure is not proof of every epic
requirement. Human assistance was required for protected lint configuration
and a checked-ledger SHA typo. No PR was opened or pushed. The final Execution
Plan's Delivery Checklist still contains open items, including documentation
and PR decomposition. Those rows cannot be credited merely because the ticket closed.

Some reviews used labelled reduced independence. The accepted epic explicitly
allows a best-available fallback after typed independent-route exhaustion
(TBU4.R11); reduced independence is not automatically a violation. Its exact
exhaustion and continuation receipts still need verification before assigning
credit to that part of the contract. No receipt is newly authenticated here.

## Original completion requirements

Numbering follows the 17 existing `done_when` entries in order. “Partial” means
bounded evidence exists, not that all named sub-obligations are satisfied.
“Unproved” means this review found no sufficient evidence, not absent code.

| # | Original obligation | Evidence and assessment | Smallest remaining action |
| --- | --- | --- | --- |
| 1 | Implementation semantic review decides the complete in-scope approach before sequencing | Partial: separate reviewed plan, E1 line 1030; later review discovers precision and other missing decisions. No full receipt-to-contract assessment yet. | Inspect final plan and review findings against applicable decisions; distinguish initial omissions from repaired final state. |
| 2 | Receipt explicitly judges focused 30–60-minute decision reviewability | Bounded positive evidence found: Implementation receipts 827f4999 and 683e7af9 explicitly state “Focused reviewability: pass.” Both identify Codex and cross-agent independence. This is the rubric judgment, not measured review duration. | Retain the exact archived result; no repeat review needed for this observation. |
| 3 | Execution review establishes dependency-ordered, startable accepted work | Partial: approval E1 line 1251, subsequent actual RED/build history; later design decisions still required. | Inspect approved task/dependency/proof records and final review; identify whether any undecided behavior was left at approval. |
| 4 | Same exact canonical contract digest reaches author/reviewer; missing or mismatched inputs cannot approve | Partial automated mapping in E4; live trial success alone is not the negative control. | Locate existing positive/negative contract tests and dated results; run only uncovered controls if needed. |
| 5 | Contract changes invalidate dependent reviews/human approval with legacy implementation exception | Unproved live; E4 contains contract-currency test mapping. | Reconcile existing contract-change and legacy-exception results before deciding on a new check. |
| 6 | Shared writing/discovery guidance and safe versioned Product transition | Partial: produced plans and E4 documentation mapping; no version-transition demonstration in this trial. | Inspect generated guidance/transition tests and existing child evidence; do not simulate migration unless still uncovered. |
| 7 | Changes invalidate exactly dependent reviews and enabled human approval | Partial and defect-suspected: precision change refreshed plans; routine ticket changes also caused broad refreshes. Human approval selectivity not established. | Compare receipt dependencies with commit deltas; use #5766 for confirmed false invalidation. |
| 8 | Proportionate patch/task/feature routing, including promotion | Partial: CSV request automatically entered feature flow; earlier small converter supplies dated task-path observations, not the promotion matrix. | Reconcile existing small-work tests and promotion evidence; identify only missing partitions. |
| 9 | Every affected surface has real-boundary acceptance or specific justified skip | Partial: local Claude plus actual CLI exercised; no new Codex/Cursor or cloud-host acceptance established here. | Inventory existing host evidence and the fixed deferred cases before selecting missing host checks. |
| 10 | Plain blocks explain failure and one actionable recovery | Partial/adverse: logs show recovery, but repeated source inspection and human intervention. Not a measured NTB comprehension walkthrough. | Sample each required message category against saved logs; use existing defects and add only missing category evidence. |
| 11 | In-flight/legacy migration preserves accepted implementation and migrates earlier work | Unproved by this fresh-project trial. | Reconcile migration-child tests and accepted-version fixtures; preserve exact host limits. |
| 12 | Each phase defines purpose, entry/content/review/approval/invalidation/return; approvals do not impersonate others | Partial: distinct artifacts and phase approvals observed, E4 maps canonical contracts. | Inspect phase contracts and existing negative approval-substitution proof. |
| 13 | Typed disputes use proper authority and terminate honestly | Partial: precision question returned to user, E1 lines 2608–2649; not proof of fresh correctness adjudication or all terminal outcomes. | Inspect dispute-child evidence and continuation receipts; test only missing authority/terminal categories. |
| 14 | Proportionate Delivery Checklist and coherent large-contribution PR slices | Partial: Execution Plan checklist and one-PR rationale exist; rows remain open at closure; no large-slice demonstration. | Reconcile final checklist with actual evidence and existing large-contribution proof. No authority to open a PR in this pass. |
| 15 | Incorrect plans return through discovery and exact re-review or named external decision | Demonstrated bounded instance: reviewer finds missing decisions; user answers; both plans refreshed and work resumes. Not universal proof or proof of fresh-agent cold start. | Retain this instance; inspect receipts for authority/identity, then check existing cold-start proof rather than repeating the journey. |
| 16 | Design change refreshes both plans; execution-only change refreshes only Execution; valid work survives | Partial: accepted precision cap updates spec and both plans in `052e42ab`; later code/tests in `3e3c261f`. No isolated sequencing-only control or complete human-approval assertion. | First inspect available receipts. If absent, run one narrow sequencing-only control on a copy, retaining before/after design, contract and approval identities. |
| 17 | Plain request reaches verified, review-ready PR on each authoritative host | Partial: Claude reaches working local feature and done, with human assistance; no actual PR preparation completion, Codex/Cursor journey or fully autonomous success established. | Review local delivery artifacts for missing PR-preparation evidence, then target only missing host boundaries; no wholesale new trial. |

## Follow-through from receipt and current-main checks

- `evidence/trial-receipt-audit-2026-11-09.json` records five actual archived job
  records, hashes and selected outcomes. This is source inspection, not fresh
  HMAC validation or a claim that historical reviews remain current today.
- The initial Execution review d3303769 is approved, Codex/gpt-6.1-sol,
  cross-agent. It includes a concrete single-PR rationale, boundaries,
  prerequisites, proof commands, completion signals and obligation ownership.
- Reduced Execution review ed2b2cd7 retains actual exhaustion: Sol invalid
  output, Terra process failure, OpenCode timeout, then Claude. Later Execution
  review a4d80f5d records Terra/cross-agent after Sol invalid output. Do not
  describe this whole run as self-reviewed or require new qualification solely
  because one fallback was reduced. The accepted epic permits typed fallback.
- The trial log records `human-approval:not-required` for the initial approach.
  Product answers were genuine user choices; they are not proof of the enabled
  optional human design gate. That gate needs its own existing CLI/PTY controls.
- On fresh main e00ea1e65, 85 existing planning integration checks pass.
  Direct controls show phase metadata alone preserves identity, Work Log
  append changes it, and scope changes invalidate it. Thus “phase alone” is not
  the established root cause. Ordinary automatically appended log content is
  one confirmed cause; historical mixed-change failures remain separately bounded.
- A separate current-main branch `codex/4200-completion-progress` in
  `/private/tmp/safeword-4200-main-evidence` carries the bounded #5766 repair
  under local task 920BVH. RED bb2e17ade observes actual CLI status become stale
  after progress. GREEN b43f1e4de excludes only the standard Work Log section,
  leaving scope and sections after it bound. This is not merged or released.
- 119 checks pass across contract/context identity, canonical contract
  invalidation, optional human approval, Markdown semantics and a new actual
  CLI scheduling-only control. The control changes Execution scheduling and
  observes Execution stale while Implementation remains approved. These use
  private reviewer fixtures, not native host/model qualification.
- Another seven-file set passed 96 controls; its one blocked plain-language
  scenario lacked a relay build in the fresh worktree. After building that
  dependency, a three-file final run passes 15/15, including that scenario.
  Runs overlap; do not add their counts into a unique-test total. Original
  failed setup logs remain retained.
- Lint and typecheck for the changed code pass; all five generated surfaces
  are current. Cross-agent code review 579fc090 approves the fix with retained
  warnings: old log-bearing identities become stale once on upgrade; nested
  log content is history, not scope authority; nonstandard headings remain bound.
  Complete changed-file review 13a94973 also approves; the implement stamp
  succeeds after including generated metadata and legitimate bundle exclusions.
- Final frozen-install proof: **718 files pass, 11,624 tests pass, 14 skipped**;
  release suite **81/81**, final targeted suite **15/15**. An earlier full run
  used borrowed dependency symlinks; it is historical supporting evidence, not
  the final candidate run. Verification review 98becbd3 caught that overclaim;
  a fresh final run corrects it. The final full and release builds emit the same
  136 JavaScript artifact names/sizes. Failed release and review results remain.
- The code branch/worktree is now persistent at
  `/Users/alex/.codex/worktrees/4200-completion-progress/safeword`, code candidate
  d2100c869. The logs' older `/private/tmp/safeword-4200-main-evidence` name was
  the same candidate worktree before the post-test rename, not another checkout.
  Git-managed HEAD history and exact candidate file comparisons are retained
  in the task's evidence/worktree-provenance.json. Verification metadata is
  transparently post-run, not a reconstructed pre-run attestation.
- Exact native Codex plugin bytes are installed in an isolated private profile
  at `/Users/alex/.codex/dev-profiles/4200-native-proof`; the normal shared
  registration was not repointed. Initial native status reported all five
  events missing. After explicit user approval, normal interactive folder and
  hook trust, restart, and a completed read-only native turn, status reports
  healthy, protected, current proof for all five events with none missing.
  `native-codex-trusted-status.json` in the follow-through archive retains the
  result. No trust-bypass flag, fake activation, qualification campaign or
  source-profile overwrite was used. This proves activation, not a complete
  native feature journey; that journey is now running in the disposable project.
- Native trial setup uses a process-only bootstrap entrypoint pin to the exact
  candidate instead of npm latest; every hook/dependency check is retained.
  Default source installation is still a separately recorded limitation.
  Launch helper and all non-authentication records are under the existing
  trial archive's epic-followthrough-2026-11-09 directory. Authentication stays
  outside that shareable archive. No full Codex/Cursor feature journey is claimed.

- Bounded repair task 920BVH is now locally done at delivery-record commit
  `0c6cf716b` (unchanged tested code candidate `d2100c869`). Verification review
  `761cd1ab` approves, the authenticated verify stamp succeeds, the shared
  completion check returns `ok:true` including the repository acceptance lane,
  and the diff audit passes without errors. Nothing is pushed or merged.
- Native Codex converter ticket KZVTRD reaches intake. Review `6cdbced5` exhausts
  routes: Claude not authenticated inside the sandbox, OpenCode untrusted and
  Codex fallback process failure; the log update then makes this explicit-target
  review stale. A paired read-only check establishes Claude loggedIn:false in
  the native sandbox but loggedIn:true in the normal controller. The same
  candidate packet independently approves as controller-dispatched `a29bedad`,
  cross-agent Claude Opus 5.5. That is assisted review evidence, not autonomous
  native success. No new login, credential edit, fake stamp or route change.
  Native filesystem-access approval is pending; implementation has not begun.
- Dispute child 26FK42 has accepted scenarios but no implementation plan or
  completed R/G/R entries. Main's optional-warning-decline command does not
  implement fresh correctness adjudication, durable pending dispute recovery
  or the promised typed terminal outcomes. Original obligation 13 therefore
  has a genuine implementation gap; it cannot be closed by this proof inventory.

## Resumed native evidence, November 9 Pacific

This supersedes the earlier pending-trust/access observations, without deleting
the failed trials. User-approved isolated local access restores the existing
reviewer login. Real local Codex reaches reviewed Product, Implementation and
Execution Plans, TDD and tested implementation, then honestly stops at verify.
Candidate app commit 5b49319c passes 34 Node process tests and five converter
scenarios plus one starter scenario. Independent code/whole-delivery and local
PR-description reviews approve. Verification remains failed on development-tool
dependency advisories; ticket KZVTRD is not done or Ready. No remote PR exists.

The journey is assisted: controller diagnosis repairs Product Bet fields absent
from the shipped template. The original misleading missing-context errors,
RED-replay staleness, immutable mistyped RED locator with explicit correction,
unsupported generic retained-review method and later receipt invalidations are
retained. The independent code review also catches an overflow omission, which
receives a real RED and fix. No failure is silently promoted to completion.

Bounded source fixes are locally complete and unmerged: Work Log approval
preservation at 0c6cf716b, and the canonical Product Bet scaffold correction at
b97736b41 on separate current-main branches. Both have real RED, independent
code/verification approval, passing relevant checks and diff audits. Native
status checks during TDD establish a bounded live approval-currency case for
the first fix; they do not resolve every historic #5766 symptom.

The user subsequently authorized publishing those two exact source heads as
Draft PRs for CI. Approval preservation is #7077 at 0c6cf716b; template repair
is #7078 at b97736b41. CI runs 42773701509 and 42773717549 both pass on their
first attempts, including both Node versions and the existing dependency audit.
Both remain Draft/unmerged and require review. No qualification, Ready change,
review-route change or waiver of the separate native audit failure occurred.

Original obligations 9 and 17 gain actual native Codex evidence but remain
partial; there is no new complete Cursor/cloud journey, unassisted success or
fully verified review-ready feature. Obligation 13 still has missing dispute
implementation. A read-only parent-reconciliation check for dispute child
26FK42 returns PARENT_RECONCILIATION_FAILED because accepted-parent provenance
changed; no blind acceptance or child scope change was performed.

Full resumed evidence, raw failures, review records, Git history and the
uncommitted delivery-receipt patch are preserved at the permanent trial archive's
epic-followthrough-2026-11-09/FOLLOWTHROUGH.md. Authentication is excluded.
Shared settings/enabled-plugin records match the captured baseline; the Claude
marketplace cache registry refreshed, so byte-identical shared state is not claimed.
Missing historical RED and all 33 deferred cases remain exactly as recorded.

## Specific behavioral-change evidence (original Claude trial)

The precision cap is a useful positive control, not an unnecessary review:

1. Originally accepted precision was any nonnegative integer.
2. E1 line 2608 asks the user to accept the new maximum and lint dependency;
   user response `1A 2A` appears at line 2615 (an earlier duplicate/context
   occurrence also exists). E1 line 2649 starts the corresponding plan update.
3. Commit `052e42abc044518acf1d10fe1e7853f9ffac7e0a` changes Product, Implementation
   and Execution Plans plus scope/dimensions. The Product Rule now rejects
   precision above 1000.
4. E1 line 3066 reports all three reviews refreshed and discloses reduced
   independence in one. `3e3c261f` adds actual precision-1001 and other checks.

This shows the outcome occurred. It does **not** prove which invalidations
the gate caused automatically, exact selective human-approval invalidation,
or that every re-review was necessary. Simultaneous lint and other plan edits
make this a mixed-change case, not an isolated selective-invalidation experiment.

Routine-edit symptoms remain distinct: E1 line 1369 reports all three approvals
stale after phase metadata changed. #5766 now contains the consolidated findings;
Issues #5022 and #5808 retain the narrower historical reports. No technical fix is
selected by this inventory.

## Smallest ordered completion work

1. **Receipt and existing-proof reconciliation:** resolve rows 2, 4–6, 8,
   11–13 from retained review JSON, child proof maps and dated test results.
   Artifact presence is not a passing result; missing evidence stays missing.
2. **Isolate approval currency:** establish bookkeeping-only, sequencing-only
   and behavior/design-change outcomes, including enabled human approval and
   preserved completed evidence. Prefer existing results; otherwise one copied
   fixture per missing partition. Confirmed false invalidation belongs to #5766.
3. **Delivery closure:** account for open checklist rows and absent PR preparation.
   Use local draft description/scope/verification evidence first; opening, Ready
   promotion, publishing and merge remain separate authority.
4. **Host/message gaps:** inventory prior actual Codex/Cursor evidence and allowed
   surface skips, then execute only absent real-boundary cases. A local Claude
   run, plugin parity or synthetic adapters cannot impersonate native host proof.
5. **Close only supported original obligations:** combine valid earlier proof with
   this dated trial. Do not declare a child or the parent complete from ticket
   closure, test counts, or this inventory alone.

The source evidence review is complete for this pass. The next work is the
targeted receipt/test inventory above, not another full feature trial. No new
product code, tests, model calls, qualification or paid run was performed here.

## Preserved boundaries

Missing historical RED is still missing. Failed, stale, rejected and exhausted
reviews and mixed-build trials remain evidence; no result is upgraded here.
All 33 deferred cases remain: MCWV4B 18, FC33HK 12, KKP2R3 2, DRD65E 1.
This report neither widens their eligibility nor invents cloud acceptance.
The EP9/5GK1CN recovery proposals are not declared prerequisites for every
remaining obligation; require an exact supported completion need before using
them. No stale branch merge, route change or reviewer admission is authorized.

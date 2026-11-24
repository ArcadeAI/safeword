# Verification of response-contract promotion

## Verify Checklist

**Test Suite:** ✓ 12,417/12,417 tests pass across CLI, retro relay, and retro collector. 15 skipped.
**Gherkin:** ✅ Acceptance lane passes. 599 scenarios and 11,786 steps passed. The separate proof check passed all 52 tests.
**Build:** ✅ Success
**Lint:** ✅ Clean on the committed changes via the commit checks
**Typecheck:** ✅ Clean
**Scenarios:** ❌ 0/123 RED, GREEN, and REFACTOR ledger entries are checked across 41 scenario headings.
**Refactor:** ✅ Completed — `cd8385b15` isolates ticket-edit evidence validation. 18 evaluator cases returned identical exit codes and output.
**PR Scope:** ✅ Diff matches ticket scope for the stack above `2b0ca0e82`.
**Dep Drift:** ✅ Clean for this stack. Runtime dependency declarations are unchanged.
**Parent Epic:** 82T411 (siblings: 0/11 done)
**Reconcile:** ✅ No pattern deviation identified in this stack.
**Experience:** ⚠️ The local Claude and Codex promotion probes do not establish the inherited integrated demo.
**Surface Evidence:** ⚠️ Local Claude and Codex have recorded promotion evidence. Claude Cloud also passed the ticket-edit promotion case on probe revision `8691dde9`, which differs from delivery commit `0a7a3aa1` only in its disabled self-report settings. Cursor and other hosts were deferred for this delivery by the user.
**Evidence limits:** ⚠️ The generated verification plan scheduled the same full CLI suite a second time. The duplicate was stopped after the first suite passed. The aggregate wrapper exited 143 while its distinct BDD, build, typecheck, and dependency checks completed.

Audit passed dependency-boundary and config checks over the stack above `2b0ca0e82` with no violations. The hosted evaluator was characterized with temporary synthetic records. The Claude Cloud evaluator also passed on one authenticated run. The native hook event, same-ticket transition and unchanged source were verified in the hosted transcript. Additional hosted cases and repeatability remain open.

This verification records evidence for the response-contract delivery. The ticket remains in progress.

## Test quality follow-up

- Two scenarios now have executable Vitest proof links: a declared patch with a public-contract change routes to feature, and a relevant observed failure permits a private task to proceed. The Cucumber dry run still reports 144 expanded examples without step bindings.
- The RED admission integration checks the reason for each negative decision. The BDD proof registration, classification, and RED admission checks passed all 72 focused tests.
- One fresh local Claude Code session (`93bcc89e-d4f3-414e-8912-981e6a32f0e1`, fixture baseline `a237bcea7f0b1f5be1b6e33821a0f52378dd0118`) and one fresh local Codex CLI session (`01a20949-a212-7c53-8070-90ed3fb10536`, fixture baseline `0a01f9eb0cda1ff913fc1d679a5e21e48a2f03df`) exercised a private retry correction against the runtime at `0141cc0c`. Both ran the supplied test and observed its expected failure, recorded the observation and relevance, edited the helper through the native tool, and passed the targeted test. Both issued a native proof admission token, kept the same ticket as a task, and created no feature planning artifacts. The operator supplied the test, routing facts, and proof request. These observations cover RED through GREEN on local hosts. They leave contributor handoff and the Claude Cloud routine-task case open.

## Fresh-session handoff eval

The local agents received the same request in clean clones of the earlier retry fixtures, with the existing task but no test or proof instructions:

> Pick up the existing retry ticket. The helper currently allows only one attempt. Fix it so a transient failure gets one retry.

The workflow passes when the agent picks up the same task, establishes and records a relevant failing test before editing source, then passes that test after the fix without creating feature planning files. The helper returning two attempts is scored separately.

- **Claude Code** (`1ac66fba-719a-47ae-b82a-50f777c51b92`): behavior passed, workflow failed. The agent found the existing task and changed the helper from one attempt to two. It printed the value before and after, but did not establish a failing assertion or record proof before the edit. It kept the existing task and added a work-log entry.
- **Codex CLI** (`01a20950-9f10-7f60-8215-9f134aa93d56`): behavior passed, workflow failed. The agent independently ran a relevant assertion before the edit and reran it successfully afterward. The source edit preceded the ticket update, which recorded a narrative result but no Safeword proof. It kept the same task. This confirms the first run's workflow failure (`01a2094f-9a9f-7773-8c4d-8fcfc5140140`) after correcting the login shell's candidate CLI path and Bun's temporary directory.
- Independent checks confirmed two attempts and no feature planning files in both scored clones. The eval covers one private retry fixture per host. Claude Cloud routine-task handoff and cross-fixture repeatability remain open.

### Root cause of the handoff failures

The first source write preceded the first observed ticket edit in both scored sessions. The ticket-edit hook records the session binding after the ticket edit. The final state files show both sessions eventually bound to their correct tickets.

There was a separate fixture limitation. Both tickets were legacy tasks without the versioned small-work facts that opt them into proof enforcement. The admission evaluator returned no denial for either ticket even when called directly with its ticket ID and source path. This rules out late binding as the sole explanation. The earlier coached runs supplied the missing facts and bound the session before the source edit. The cold run establishes a gap in discovering and entering the workflow from a legacy ticket. It leaves enforcement on a fresh session with an already-classified ticket unverified.

### Handoff rerun with enrolled tickets

The same plain prompt ran in fresh local sessions. The fixtures added only the versioned routing facts to the existing tickets. Each agent had to write the test, construct the proof request, observe the failure, and record the proof itself.

- Claude Code (`285c33ac-017b-424e-a25a-e5e502b17048`, baseline `481477245764ce80168d476789aa820c370d9b31`) passed the focused workflow. It ran the new retry assertion, recorded observed and relevant RED through a native ticket edit, changed the helper, and passed the same test.
- Codex CLI (`01a2096d-df2d-7b01-b86c-c916674d3cab`, baseline `772d85f284f7f8655cb5380db1a4a863fb811658`) passed the focused workflow. It ran the new retry assertion, recorded observed and relevant RED through a script that updated the ticket, changed the helper, and passed the same test. The trace establishes proof order. The session state shows the correct ticket was bound by the end, but it does not establish whether the script bound it before the source edit.
- Independent reruns passed one test per checkout. Both retained the existing task at intake and created no feature planning files. The fixtures had no installed project dependencies for broader checks. These runs demonstrate uncoached proof recording on enrolled tickets. Whether a fresh session would block a premature source write remains open, as does the routine Claude Cloud run.

### First-edit enforcement with an enrolled ticket

In clean copies of the enrolled fixtures, each fresh session read its existing ticket and attempted one native source edit without editing the ticket or recording RED. Independent diffs confirmed that both tools changed only the attempt count. Both saved session states still had no active ticket, and both tickets still matched their baseline.

- Claude Code (`0a155f5b-94e7-473a-9e44-9a6040997e95`) reported that native Edit succeeded.
- Codex CLI (`01a20974-c094-7c11-adfc-e04335e4ee1a`) reported a `bunx` error after native apply_patch. The source diff still showed the edit landed. The same outcome occurred in the first Codex session (`01a20974-1228-7960-a328-e6fb98cb3c8f`).

The first-edit enforcement check failed on both hosts. An enrolled ticket alone does not establish active session binding.

### Claude Cloud ordinary-task handoff

The [hosted run](https://claude.ai/code/session_01ES15yYTQi8MT3c9sniCynM) used checkout `8691dde907c93688b36b543af23c92fe854cd48c` and ran child session `a35e3f6c-24fd-4fc7-a5cf-160669808988` on enrolled task `4EF2GP`. The child received the same plain retry prompt. The hosted transcript report places test creation at line 86, the test command and its permission denial at lines 104–111, the first source Edit at line 115, and two successful PreToolUse hook exits at lines 118–119. The child changed the attempt count to two, left the ticket at task/intake, and created no feature planning files. The hosted report confirms final ticket binding but does not timestamp when it happened.

The first edit proceeded without recorded RED. End-to-end RED/GREEN is unqualified because the headless fixture lacked permission to run the local Bun test. The hosted setup also exposed an ignored parent-session state file in the fixture. The initial cloud launch was interrupted during dependency setup by CLI teleport; the completed run above was observed from the browser.

### First-edit regression fix and reruns

Commit `6fa7e80ea` asks an unbound session to attach its ticket before changing production files when that checkout has an in-progress ticket enrolled in small-work verification. The hook does not select a ticket on the agent's behalf. Test and ticket edits remain available, and the bound ticket's existing rules determine the required proof. The installed regression first failed because the hook allowed the edit, then passed with the binding check. All 153 focused tests passed, including the shell guard and Codex adapter suites.

- Fresh local Claude Code (`d32656cc-7cf8-4166-9a8e-025f0f4995f0`) and Codex CLI (`01a2097c-f619-7772-9fc4-5ebf22470c01`) both got the intended pre-edit denial. Both source files stayed at one attempt.
- The uncoached positive reruns on local Claude Code (`d6079790-1f20-4f3d-a38d-bb18ca19192d`) and Codex CLI (`01a2097f-85c6-7a41-8b19-f7db610ea227`) both recorded observed RED on the existing task before changing the helper and passed the new test. Independent test runs confirmed GREEN. One discarded Codex attempt counted the harness's temporary cache files as task changes. The clean rerun excluded only that temporary directory via the fixture's local Git exclude file. The Codex evals loaded the reviewed candidate bundle in an isolated profile with the invocation-only hook-trust override, so they establish hook behavior and leave normal installation trust unqualified.
- [Claude Cloud](https://claude.ai/code/session_01ES15yY7WdEHj5gPStPGDWq) ran candidate `d176ac5ec` with self-report disabled. In the clean negative fixture, session `34529788-c215-4df5-aed4-89fad2a68a93` received the intended native PreToolUse denial (event `2704d1a7-1352-4e32-8789-07063c71a430`). The source stayed at one, and the checkout stayed clean.
- The clean hosted positive session (`730ad1d2-29c3-4209-854e-2ca6c5e5c935`) had explicit test permissions and independently reproduced the failure. It could not construct a valid proof observation request. The CLI validation requires a full `baselineRevision` and accepts `failure` or `pass` for `expectation`, but its argument error does not explain either. The gate denied two source writes, and the helper stayed at one. An extra hosted setup run without test permissions also showed the gate advancing from missing ticket binding to missing footprint to missing observed RED. Hosted RED-to-GREEN remains open.

### Proof-request CLI help and hosted rerun

Commit `10c285173` documents the request shape, full baseline revision, digest, valid expectation values, and ticket proof fields in the command's help. Invalid JSON and invalid request results identify the required fields and the expectation choices. The help regression failed before implementation. All 63 focused CLI, contract, and admission tests passed afterward.

The [cloud rerun](https://claude.ai/code/session_01ES15yUz4LRkBnMHmbU8wA9) used candidate `309011af2ae7ba4f15c627e5ebe51819f0fdf78c` and clean enrolled fixture `b7bb1bcf0855477c2e3f8cdb9d79da1f8c480b01`, ticket `TWA9CV`. The child ran the expected failing test (trace lines 658–668). Host command checks denied its quoted substitutions, and the fixture allowlist denied its Node and `git -C` helpers. The child never issued a direct literal-JSON proof command. There is no proof record or GREEN run. The hook denied two production edits (lines 878 and 1091), and the helper stayed at one attempt. The ticket stayed task/intake with no feature planning files. Hosted RED-to-GREEN remains open.

### Proof request files and automatic digest

Commit `e7a4d8c9a` adds `@path` input to the proof command, derives an omitted digest from the ticket's current classified facts, and returns the exact effective request for recording. The installed integration test failed before file support and passed afterward, including admission with the returned request. All 90 focused tests passed.

The [second run in the same Cloud session](https://claude.ai/code/session_01ES15yUz4LRkBnMHmbU8wA9) used candidate `6bc515b24b06ee73587a8019d46db1a28ff284ba`, the same fixture baseline and permissions, and the same plain retry prompt. The child independently used file input, observed and saved a relevant failing test, then edited the source. Its post-fix Bun run passed at trace lines 1377–1389. The hosted observer independently reran the exact declared Node test and confirmed it passed after the fix. The ticket remained task/intake with no feature planning files.

The saved ticket proof still describes RED. A post-fix observation rejected the changed source as different from the pre-test baseline, and a post-fix verification returned `current: false` at trace lines 1314–1322. The ordinary task ran through a passing test on Cloud. Durable GREEN evidence remains open.

### Durable GREEN for small tasks

Commit `712bfd79e` adds `safeword ticket observe-small-work-green <ticketId>`. It reruns the admitted RED request and saves a signed GREEN receipt alongside RED. The installed-hook regression first failed because the CLI command did not exist, then passed with the command implemented. It covers an unchanged ticket on a failing run and stale receipts after source or test changes. All 90 focused tests and CLI type checking passed.

The [Claude Cloud rerun](https://claude.ai/code/session_01ES15yUz4LRkBnMHmbU8wA9) used candidate `93d8cbbfd4b357d0a8ef977dc1014559bc31f445`, fixture `1e06cce` with the candidate handbook and the original retry task, and the prior permissions. Fresh child `59e48081-6efe-49bf-9b60-be606f26cfe3` received the same plain prompt. It observed RED at trace lines 348–361, saved it at 825–853, edited the source at 890–910, and recorded GREEN for the exact saved Bun test at 932–947. The hosted observer checked the saved receipt independently in the same fixture and got `current: true`. Both results remained in ticket `TWA9CV` at task/intake, with no feature planning files. A shell ticket write was denied during the run, and the child recovered using the native ticket edit. This passes the observed ordinary-task handoff on Claude Cloud.

### Acceptance evidence by example

| Example | Evidence and remaining limits |
| --- | --- |
| R8, installed lifecycle dispatch, Claude Code and Codex CLI with meaningful RED | The uncoached sessions under First-edit regression fix and reruns saved observed RED on the existing task, edited the source, and passed the same test. The fresh-session negative probes on those hosts establish missing ticket binding. The installed hook test separately covers an attached ticket missing RED. |
| R8, installed lifecycle dispatch, Claude Cloud with and without RED | The [first-edit Cloud rerun](https://claude.ai/code/session_01ES15yY7WdEHj5gPStPGDWq) reached an attached task with recorded footprint and rejected source modification for missing RED. The [durable GREEN run](https://claude.ai/code/session_01ES15yUz4LRkBnMHmbU8wA9) admitted the edit after saving the failing proof. |
| R12, installed hosts returning a promoted decision to behavior definition, Claude Code, Codex CLI, and Claude Cloud | Local Claude session `bb0d763c-ce2a-4d77-b028-e70031b6213a`, local Codex session `01a208e6-1d5a-7ac2-8fec-30b57bc17a7a`, and the [scored Cloud ticket-edit receipt](./evidence/claude-cloud-ticket-edit-promotion.json) observed the same-ticket transition to `define-behavior` before source modification. These observations cover a breaking public-contract discovery. Prior behavior approval and a return to Implementation Planning are separate R11 cases. |
| R14, equivalent small work reaches human review, private retry task through installed CLI | `small-work-red-admission.test.ts` now carries the task from admitted RED through durable GREEN and records the same test's proof in the inline checklist. It verifies an explicit documentation exemption, a pending release owner, a ready-for-human-review result, no feature artifacts, and no merge authority. |
| R14, equivalent small work reaches human review, wording-only patch and Cloud handoff | `small-work-handoff.test.ts` proves targeted heading verification, contributor readiness with a human dependency, and stale delivery proof. See the rendered patch and Cloud contributor handoff evidence below. |

These are links to specific observations and executable assertions. The Cucumber dry run still reports 144 undefined examples, and the historical scenario ledger remains open.

### Rendered patch and Cloud contributor handoff

- The installed CLI wording-patch test renders Markdown with Bun and checks the actual HTML fragment link. The typo `Setpu` leaves `#setup` broken. Correcting the heading resolves the link, and the checklist links the corrected render. The inline patch can qualify with executable documentation proof while marking behavior tests and monitoring inapplicable. The regression exposed a feature-only testing-category requirement that was being applied to patches. The change keeps the testing proof requirement for tasks and feature plans.
- On [Claude Cloud](https://claude.ai/code/session_01ES15yUz4LRkBnMHmbU8wA9), the original child `59e48081-6efe-49bf-9b60-be606f26cfe3` initially skipped the checklist on `TWA9CV`. The disposable ticket had been enrolled by adding facts directly, so it lacked the scaffold normally written by classified ticket creation. The verification skill and missing-checklist message both pointed toward feature plans. The updated skill and CLI direct small work to the inline record.
- The same Cloud child recovered after an explicit request to add the inline checklist. The operator enabled only local fixture staging and commits and configured a fixture identity. The child recorded the test proof against `70d7be3`. The operator committed only the existing receipt as `5cd2081` and checked the clean fixture. The CLI still reported `ready_for_human_review`, no open contributor items, release-owner approval pending, and no merge authority. The original RED and GREEN were preserved, GREEN remained current, and no feature planning files were created. This was a guided recovery using candidate `93d8cbb`, so it establishes the live Cloud handoff after the checklist is present. It does not establish unprompted discovery with the revised guidance.

All 89 focused checklist, handoff, CLI contract, and proof-registration tests passed.

### Fresh Cloud handoff with ordinary task creation

The [fresh Claude Cloud observation](https://claude.ai/code/session_01ES15yUz4LRkBnMHmbU8wA9) used candidate `ca4b212697fdb03e96671aa4ed6e7e6fe210ecb6` and fixture `3821672`. The operator used the normal classified ticket command to create `retry-once` (VE6W94) with the default inline checklist, synced the revised guidance, and provided fixture-local Git identity and add/commit permissions. The fresh child `7a25b905-b6c8-43e0-a642-f7c61385483b` received only the plain retry and review request.

The child recorded RED and GREEN, but never invoked the verification skill or checked the inline checklist. It treated a denied branch-creation command as a blocker despite local add and commit being allowed. It left the patch, test, ticket, and temporary request file uncommitted. The observer independently confirmed `contributor_work_incomplete` and no release owner in the ticket. This run did not qualify uncoached contributor handoff. The earlier guided run still establishes that the live CLI can record and retain the checklist receipt.

### Uncoached Cloud handoff after GREEN guidance

The [Cloud comparison](https://claude.ai/code/session_01ES15yUz4LRkBnMHmbU8wA9) used candidate `d3e0323cd9060625440e30122ae869c746722a21`, fixture `538bfb7` based on the prior setup, and the same plain prompt and permissions. The operator set up the work branch and synced the handbook before launch. Fresh child `bd0b1faa-33ff-435d-8317-8ed74a2e3bf0` received no coaching after launch.

The child saved RED before editing source at trace lines 698 and 729–757. GREEN was saved at 761–774, and the child followed the CLI's checklist next action at 783–814. It removed the temporary request file and committed the fix and test as `e2737e4`. It recorded checklist proof and committed the ticket with its receipt as `d11f646`. Independent checks on the clean checkout confirmed current GREEN, `ready_for_human_review`, no open contributor items, the release owner pending for rollout, and no merge authority.

The child kept the existing task and created no feature plans. An inline proof error named `execution-plan.md` instead of `ticket.md`, and the child read the parser source to find the proof-table format. It omitted a documentation reason, which the CLI did not require on this fixture. This run passes uncoached checklist discovery and committed contributor readiness. The explicit documentation-reason example remains evidenced by the installed CLI integration test and guided Cloud continuation.

The post-GREEN next-action regression failed before the change, then passed. All 73 focused tests passed.

### R14 Cloud contributor-readiness example

The [Claude Code Cloud project hooks example](../../../features/keep-tasks-and-patches-proportional.feature#L468)
under **Cloud small-work handoff records a human dependency without blocking contributor readiness**
has a live [Cloud observation](https://claude.ai/code/session_01ES15yUz4LRkBnMHmbU8wA9).
On candidate `d3e0323cd9060625440e30122ae869c746722a21`, child
`bd0b1faa-33ff-435d-8317-8ed74a2e3bf0` committed the checklist receipt on
task `VE6W94` as `d11f646`. Independent checks at that revision found
`ready_for_human_review`, no open contributor items, release-owner approval
pending, and no merge authority. This receipt covers the Claude Code Cloud row
only. The Cursor row is deferred and the Cucumber outline remains unbound.

### Claude and Codex acceptance coverage review

The feature contains 45 example rows that explicitly name Claude Code, Claude Code Cloud, or OpenAI Codex. The table covers those rows and distinguishes host observations from reusable shared assertions. The 54 targeted classifier, footprint, routing, admission, handoff, and planning-gate tests passed during this review.

| Rule | Host rows | Reuse | Still needs proof or implementation |
| --- | ---: | --- | --- |
| R1, planning by work type | 9 | The native retry runs on all three hosts show that enrolled tasks stay inline. The coding-authorization and phase-review tests can supply the shared feature gate assertions. | Run the native classified patch paths. Verify that each installed feature path actually requires both plans and both semantic reviews. The retry runs do not cover those paths. |
| R2, classification from unclassified work | 9 | The built classifier, ticket-creation tests, and public/private routing fixture establish the shared decisions. | Run the three shapes from an unclassified starting state on the named hosts. A pre-enrolled retry task or a ticket already undergoing promotion does not establish first classification. |
| R6, threshold reevaluation | 6 | The footprint tests cover counting and crossing thresholds, and the installed routing test covers blocking and reevaluation through a real hook. | Exercise native within-threshold and surface-crossing edits on the named hosts. A missing footprint or changed configuration is a different denial from an observed surface crossing. |
| R7, inline task test specification | 3 | The three native retry traces include an inline behavior, existing entry point, and declared test command. Reuse those observations and the built proof-request assertions. | Bind the exact rows and keep the shared missing-boundary rejection as a separate executable case. |
| R8, meaningful RED admission | 6 | The positive native retry traces cover all three hosts. The Cloud setup trace also shows an attached task with footprint recorded being denied specifically for missing RED. The installed admission test covers missing, stale, and unrelated RED. | Local Claude and Codex need exact negative runs with the ticket already attached and its footprint saved. Their fresh-session denials establish missing binding. |
| R11, approved promotion during TDD | 3 | The installed routing regression verifies immediate planning with a current scenario approval and preserved investigation evidence. | Verify all three native paths with current approval and linked RED evidence. |
| R12, phase ownership after promotion | 8 | Reuse the three native same-ticket transition receipts for the public-contract discovery and the installed hook test that retains the pending destination. | Verify the exact product-behavior trigger where it differs from public-contract discovery. The four local design rows still need settle-vs-ask behavior, and the Claude Cloud design row needs a noninteractive pending-decision receipt. The restart regression verifies the saved destination with missing, stale, unrelated, and current approval through the installed hook. |
| R14, Cloud handoff | 1 | The uncoached Cloud receipt is linked to the exact example. It confirms committed current proof, readiness, and pending rollout without merge authority. | Wire the matching example to an executable acceptance check without implying the deferred Cursor Cloud row passed. |

All 34 targeted routing, proof admission, phase review, and coding authorization tests passed. The approval-aware routing tests run the installed ticket-edit hook in fresh processes and use a fixture for the review coordinator response. This proves how the hook consumes approval and preserves ticket evidence. Live Claude Code and Codex sessions and the standalone CLI restart example still need direct verification. Generic shared examples and deferred hosts are outside the 45-row count.

### Live ticket-edit routing with fixture approval

Claude Code 2.1.330 ran native Edit through installed project hooks. Codex CLI 0.171.0 ran native apply_patch through the candidate's Codex hook adapter registered in disposable project hook settings. Each session edited one checkpoint line. Both hosts promoted the ticket immediately with applicable approval, kept Implementation Planning pending with a stale receipt, and picked up the saved destination in a fresh session after the fixture advanced to the scenario gate and supplied current approval. The ticket IDs and investigation notes survived, and the pending marker cleared on entry to Implementation Planning.

| Host | Immediate approval | Deferred approval | Resumed with approval |
| --- | --- | --- | --- |
| Claude Code | `374b59cd-c932-4c57-b2f5-f1241fe0331b` | `830b54cd-5a6e-401e-93d6-01662d704414` | `d6083959-c9b0-4ea1-b994-a0f65945034b` |
| Codex CLI | `01a20a3f-622e-77e3-adbc-36fd909ad0ed` | `01a20a40-2552-7de1-b804-c81e200434db` | `01a20a41-b355-78a2-aaf1-645a86010429` |

The disposable fixture supplied the coordinator's status response and set up the scenario-gate phase between sessions. These runs establish native edit routing and preservation. Live cross-agent review, fresh plugin enrollment, and standalone CLI restart remain unverified here.

### Executable routing scenarios and genuine review receipts

Two Rule 12 scenarios now point to separate named tests of the installed ticket-edit hook. One proves immediate routing for public-contract design with current behavior approval. The other proves restart behavior, including preservation of the pending destination with stale or unrelated approval. The feature now has four executable proof links across 147 expanded examples. The acceptance lane dry run reports the other 143 as undefined.

In disposable projects, the real coordinator accepted both synthetic readiness scenarios from a Codex-authored packet reviewed by Claude. The normal stamp command accepted those receipts, and the installed hook consumed them from disk with the reviewed ticket bytes intact:

| Route | Approved review | Hook result |
| --- | --- | --- |
| Immediate from task intake | `50d8f14a-c217-4367-abca-40999f6bbe8d` | Same ticket entered Implementation Planning and kept its notes. |
| Deferred, resumed from the scenario gate | `daf4e548-9367-4903-b466-7bf5014f7564` | Same ticket entered Implementation Planning, cleared its pending destination, and kept its notes. |

A separate trial changed a checkpoint line inside reviewed `ticket.md`. The coordinator correctly reported its full-context receipt stale under the current fingerprinting rules. The successful receipt runs used hook events with the reviewed bytes intact. The native sessions above exercised actual edits with fixture approval. Standalone CLI restart and whether to treat bookkeeping-only changes as semantically neutral remain open.

### Standalone CLI resume

`safeword ticket resume <ticketId>` reads the saved destination and verifies the review receipt through the installed CLI's coordinator. It makes no ticket edit while approval is missing or stale. With current approval, it advances the same ticket, clears the pending destination, and retains the investigation text. A repeated invocation is a no-op.

The standalone acceptance scenario now maps to an executable test that starts a fresh CLI process for each attempt. In a separate disposable run, the built command consumed the real Codex-authored, Claude-reviewed receipt `6eca4c06-f5b6-4a00-b477-fec1b10da98d` and advanced the ticket without editing the reviewed text first. The feature has five executable proof links across 146 expanded examples. The acceptance dry run reports the other 141 as undefined.

### Missing RED after attachment on Claude Code and Codex

Two local host rows from Rule 8 now share one executable scenario. Its test dispatches through the installed Claude project hook and the bundled Codex adapter. Each adapter initially refuses an unbound source edit. After an actual PostToolUse handler binds the ticket, it refuses the same source edit specifically because the failing test has yet to be observed.

On candidate `addfa9866`, native Claude Code session `02918ae1-ec8a-4022-929e-35779e3a2f5b` and Codex CLI session `01a20a6b-9363-7cb2-b8d8-f79cf8e2f643` each edited their ticket, then attempted one production edit without running a test. The source stayed at one attempt in both fixtures. Claude's Edit result and Codex's PreToolUse router both reported “Record the observed failing test for this task before editing production code.” Codex used the isolated test profile's invocation-only hook trust override. An initial fixture had uncommitted setup files and triggered the footprint limit. The successful rerun committed those files to the fixture baseline.

All 55 focused proof-registration and RED-admission tests passed. Six of 145 expanded examples now have executable proof links. The acceptance dry run reports the remaining 139 as undefined.

### File and surface growth on Claude Code and Codex

Four local Rule 6 rows now share one executable scenario. Both installed edit adapters exercised a bound task with passing evidence and limits of two files and one surface. The test file counted as the first CLI file. The adapter refused a second file on the UI surface, permitted a second CLI file, and then refused a third CLI file. The denied probes isolate surface growth and file growth respectively. The task ticket stayed byte-identical after attachment.

Native Claude Code session `909d2641-5836-44fb-bde5-f2a9e234bb4e` and Codex CLI session `01a20a92-1c15-7763-be01-48fd2b4cb3d9` reproduced all three outcomes on candidate `681ab8c30`. The only source edit on each host kept the attempt count at one. The Claude Edit result and Codex PreToolUse router reported the footprint threshold for both rejected edits. Each fixture obtained its passing observation through the CLI build used by its hook. The first Claude fixture used a different verifier and failed the proof check, so that run does not count.

All 64 focused proof-registration, routing, and RED-admission tests passed. Seven of 142 expanded examples now have executable proof links. The acceptance dry run reports 135 undefined examples.

### Cold classification on Claude Code and Codex

Six planning-only sessions started with no tickets or classification facts, inspected the disposable project, and supplied their own facts to the candidate's built classifier. The CLI results identified a README typo as a patch, a private retry change needing a regression as a task, and a breaking public JSON field rename as a feature. Independent Git diffs confirmed that the source and README stayed unchanged in all successful runs.

| Host | Patch | Task | Feature |
| --- | --- | --- | --- |
| Claude Code 2.1.330 | `58e8606d-d5c2-4dbd-a594-b5db8bae2a42` | `f5860cbe-b85d-4dc1-b6fa-54c83a1a5988` | `87a91834-9e59-46e9-824b-b18a96d87cea` |
| Codex CLI 0.171.0 | `01a20aa0-6ce1-7571-91c3-133ca1e6b566` | `01a20aa0-6cd5-7460-9ac5-9a53d51263cd` | `01a20aa0-6ce2-7b32-82a0-891e43a3a031` |

The original Claude task session exhausted its turn limit after guessing unsupported argument values. The command help now describes the schema version, fields, and allowed values. A fresh task session read that help and classified successfully. The first Codex batch resolved a different Safeword installation. The recorded batch used the candidate's absolute path and its new help. The original Claude patch and feature runs used the prior help.

The help regression failed before the change and passed after it. All 51 classifier, CLI help, and contract tests passed. These live runs evidence the six local Rule 2 rows. The prompts explicitly requested a planning-only classification, so the runs leave automatic first-edit enforcement and Cucumber bindings open.

### First source edit before classification

Two fresh sessions on candidate `4056c04f1` started in installed disposable projects with no tickets. Each received an immediate one-line source-edit request and was instructed to stop after its first native tool attempt. Both checkouts changed `src/retry.ts` from one attempt to two. Neither had a ticket or a classifier invocation.

Claude Code session `0e26dc97-535f-447f-9914-321697e80cf6` reported native Edit success. Codex CLI session `01a20acd-8c9a-7641-803e-d8b38ae9e25b` reported a `bunx` dependency-resolution error and treated the patch as unconfirmed. Its Git diff independently confirms the edit landed. A direct invocation of the bundled Codex PreToolUse adapter against the no-ticket fixture also returned no denial.

The attachment gate checks for an in-progress ticket carrying small-work facts. It cannot require first classification when no such ticket exists. The earlier planning-only classification sessions establish that both hosts can classify the requests. This source-edit check establishes that the current cold-start path does not enforce classification.

### PR #8197 closeout review

The failed CLI contract and Node matrix jobs reported the same missing command inventory entry and stale generated reference for `ticket resume`. Both were corrected, and the local CLI contract command passed. The diff audit against `origin/main` found no dependency-boundary violations. This audit mode skips repository-wide dead-code, duplication, and dependency-freshness discovery.

Independent review `0de49140-23ab-40e6-8334-b886bb5713cf` found that missing scenario declarations could let an unrelated receipt advance a pending ticket. The gate now requires the declared scenario to be a reviewed target. The CLI and hooks share the same legacy-receipt validation, and the approval lookup uses the canonical ticket path. The public CLI regression tests missing declarations, mismatched declarations, unknown receipts, stale receipts, and the current receipt. Re-review `28d5447c-93bd-4deb-992e-fca2bea80815` approved the corrected gate. A fresh source CLI run advanced a disposable ticket with current Codex-authored, Claude-reviewed receipt `e066ba11-fc76-4e46-89e0-1924bc02562f`.

The approval is for the exact declared scenario. Different tickets can still cite the same approved scenario file when they intentionally share behavior. Ticket-specific approval context for a shared scenario file remains a follow-up. Cold first-edit enforcement and the unchecked verification obligations above remain open.

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

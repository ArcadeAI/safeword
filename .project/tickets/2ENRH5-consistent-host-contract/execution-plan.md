# Execution Plan: Reduce duplicated maintenance and agent drift

## Current-main architecture review qualification

Main’s `da2778353` retired the cross-model requirement and the
author-model capture hook. For current qualification, this supersedes every
earlier `Q-author-origin`, `architecture-author-origin`, and
`crossModelReview` requirement in this plan. Earlier observations retain
their original scope.

Prove through the installed Stop hook that an authenticated current reduced
review satisfies the opt-in architecture gate. Prove that stale and
unapproved receipts are refused. Keep the separate native Stop, configured
settings, continuation-limit, and lifecycle requirements. Keep the isolated
wiring grader’s own model-pair check. The headless runner retains the
three named receipt cases in `architecture-receipt-controls.json`; this is
source-level evidence for the receipt gate.

The two normal headless propagation reviews retain their full union of
work targets and contexts. Review shared Codex source in the code role.
Review headless propagation orchestration with the raw A/B deltas in the
second role. This split applies only to headless propagation. Both roles
must fit the existing packet limit, receive exact current approvals, and
pass the existing receipt checks before any native action.

## OpenCode 2.4.1 execution amendment — 2026-11-23

Scenario review `95620ecc-325b-4226-91a7-e8357c983aa7` and approach review
`a436b50a-3a54-463b-93d7-684f049f28d9` passed. Canonical `approve-plan`
advanced to Execution Planning with human approval unnecessary. This sequence
supersedes the prior OpenCode 2.2.6 execution target within the existing PR
slices. Cursor IDE execution remains with XHMWSC.

1. **PR 1 target prerequisite.** Update the sole production OpenCode pin in
   `packages/cli/src/lifecycle/host-releases.json` to `@opencode/cli` 2.4.1.
   Update the independent expected CLI/TUI rows in
   `packages/cli/tests/fixtures/host-contract/targets.json` independently of the
   registry, then reconcile active case IDs and runner/test fixtures with the
   six approved Gherkin cells. Retire superseded selectors and fallback paths
   and refresh affected current-target documentation. Run `current-target-retirement` and
   `scripts/dev bun run test tests/host-contract/opencode-population.test.ts`.
   The pre-change selectors must fail with a stale or missing target assertion
   after valid setup. GREEN requires both 2.4.1 runtime identities, rejection of
   stale, missing, foreign or duplicate rows, and the same required coverage
   for the other hosts. Preserve SDK `@opencode/plugin` 2.0.32, Effect 4.0.1
   and the existing dependency graph and lockfile.
2. **PR 2 first native gate.** The branch owner prepares fresh owned CLI and
   TUI profiles with an immutable installed V2 candidate and binds
   `SAFEWORD_OPENCODE_TEST_CONFIG` to that fixture. Use the [recorded release
   identity](ticket.md#host-evidence-boundaries) to check the actual executable
   version and digest before launch. In the existing `native-opencode` runner,
   order both 2.4.1 `catalogue-helper` cases before any guard case and require
   both to pass before running the rest of the exact population. Cover the
   ordering and refusal to proceed after a failed catalogue case in
   `opencode-population.test.ts` and rerun it in PR 2; a guard invoked before both catalogue passes fails. Run
   `scripts/dev bun packages/cli/scripts/run-host-contract-proof.ts --proof native-opencode --require-targets`.
   Each real runtime must discover the installed canonical catalogue and
   invoke the bundled guide/helper from that package via its existing actor.
   After valid setup, `NATIVE_OPENCODE_V2_CATALOGUE_MISSING` or
   `NATIVE_HELPER_ORIGIN_MISMATCH` is a native failure. An unavailable fixture,
   executable or trust prerequisite exits 3 and cannot establish RED. Record
   each exact observation and failure separately. A required compatibility
   failure under the fixed adapter returns to affected planning.
3. **PR 2 effects, then PR 3 and PR 4 qualification.** After both catalogue
   cases pass, finish the same native population with independent CLI and
   TUI allowed writes producing the expected bytes and denied writes
   preserving the original bytes. Require the existing registration,
   command, coexistence and worker fresh-context/forbidden-action cases.
   Next rerun `headless-propagation` on the exact five-lane fixture map.
   Use the existing retained OpenCode design setting grader for all six
   option combinations per runtime. Enabled must yield the observed
   `approve-plan` denial and unchanged file. Disabled must allow the expected
   write. Bind options, callback and file effect to the same installed
   revision within each lane. OpenCode Stop and its dependent settings remain
   unmet. PR 4 runs `headless-qualification` on the final bytes with both
   OpenCode lanes and all accepted non-IDE cases. Admission requires the
   existing trusted release proof and separate matching native activation
   with exact executable, runtime, delivery, package, project/profile,
   enrollment epoch, configuration, trust and protocol/capability bindings.
   Preserve normal enrollment and trust, the exact staged Codex review pairs,
   and the separate normal Codex trust proof. Preserve prior reviews,
   receipts and the [five-lane diagnostic](evidence/headless-propagation-diagnostic-20261123.json)
   at their original identities. The diagnostic stays admission-ineligible.
4. **PR 4 simulated public status.** Run the existing
   `tests/host-contract/admission.test.ts` case
   “preserves selected package facts and gives recovery when the observed host is unlisted”
   through the `admission` proof. Extend its pinned 2.4.1 control to assert
   missing qualification and the absence of update-Safeword guidance.
   Both probes use the same selected contracted package and the real public
   `status --json --no-input --offline --agents=opencode` path, with only
   the external executable's `--version` response simulated. Both return
   action_required/exit 2 with the truthful selected package facts and
   protection unproved. The synthetic unlisted `2.999.0` response must add
   update-Safeword-to-a-validated-release and restart recovery. The paired
   pinned response reports the missing qualification. Preserve stale-proof,
   admission and historical-package controls. This case proves public status.

## Current closeout scope — headless

[XHMWSC](../XHMWSC-qualify-cursor-ide-on-isolated-desktop/ticket.md) owns both live Cursor IDE deliveries, Cursor IDE exhausted-cap proof and the combined seven-delivery run. Every IDE-dependent clause below transfers with those proofs. Keep those claims unavailable. Cursor CLI, other headless checks, shared admission and lifecycle source work, and final headless verification remain here. The exact previous Cursor source checkpoint is in `eaca26a3a`.

The completed Claude continuation slice and its exact proof remain in the [previous execution plan](evidence/current-cursor-retained-continuation-20261121-plan-before.md); its native qualification and full propagation remain open.

Record the fresh exported TMPDIR alongside each RED and GREEN log.

## Unattended headless propagation amendment — 2026-11-22

1. Review the Implementation Plan amendment and this sequence through the
   normal independent gates. Preserve the reviewed five-delivery runner and
   prior native attempts as evidence.
2. Add `tests/host-contract/headless-propagation-staging.test.ts`. Use the
   retained native runner seam with an owned disposable fixture, three
   generated revisions, and actual staged review validators. Substitute
   only the external reviewer and native host process/inventory. From
   `packages/cli`, run
   `../../scripts/dev bun run test tests/host-contract/headless-propagation-staging.test.ts`
   for RED and GREEN. RED exits 1 with
   `HOST_CONTRACT_PROOF_UNAVAILABLE: exact prepared fixture requires native hook trust`
   from the pre-change readiness path despite valid staged approval.
   GREEN exits 0 only after the positive proves selected-stage execution
   with all five enabled bindings per revision and the negative controls
   prove missing approval, an unequal middle revision, installed-tree drift,
   and a disabled native hook in the middle revision each refuse before any
   model invocation at that revision. Require the corresponding approval,
   revision and tree error in the first three cases, and the existing binding
   validator's `isolated workflow: disabled event` error with zero middle-revision
   model calls in the disabled-hook case.
3. Reuse the approved staged behavior path for the Codex actor only. Prepare
   all three revisions before execution; authenticate two bounded approvals for
   each adjacent pair. Require the same policy-stage package and source
   identity in both pairs before starting either transition. Observe the same
   installation and five enabled
   native bindings at each revision. Preserve normal-mode trust, existing
   timeouts and public full-population refusal. Require separate evidence for
   baseline, shared policy, settings, continuation, stale refusal and repair
   across all five actual headless deliveries.
   Prepare from the repository root using
   `scripts/dev bun packages/cli/scripts/run-host-contract-proof.ts --proof headless-propagation --require-targets --prepare`.
   The preparation mode writes the frozen stages and review inputs and exits
   without starting native actors. For each pair the branch owner runs
   `scripts/dev bun "$coordinator" review run quality-review --cwd "$pair_project" --json --agent-handoff --context "${context[@]}" -- "${targets[@]}"`
   twice using the prepared pair's coordinator and exact emitted role lists:
   code targets with common stage inventories, generation inputs, delta index
   and manifest as context; raw owner delta targets with that same context
   plus the existing caller contexts. Collect both current approved job IDs;
   bind them to their pair and role in the reviewed descriptor. Once both
   review pairs are approved, set
   `SAFEWORD_CODEX_PROPAGATION_PLAN` to the owned reviewed descriptor and run
   the existing `headless-propagation` command with the same fixture map.
   Require exit 0, all five exact observations, the same installation
   identities, an actual stale refusal followed by repair, and a diagnostic
   result with `admission_eligible: false`.
4. Run the independent native trust and invalidation proof normally in an owned
   profile. Stage both byte-exact packages before scheduling the operator
   session. Reruns with identical inputs reuse the prepared artifacts. Capture
   each required refusal and trust transition from the real host, and finish
   with actual callbacks. Keep these observations separate from the unattended
   behavior result. Bring any required operator review to the user only after
   the unattended work and preparation are ready.
   Run the exact existing `codex-normal-trust-invalidation` command in
   step 6 of Retained Codex behavior and rollout sequence, using the
   normal owned fixture. Exit 0 requires both observed untrusted-to-trusted
   transitions and bound callbacks.
5. For the historical ordinary-request proof, recover its exact pre-fix
   source and frozen proof inputs in a disposable checkout. The branch
   owner runs `headless-historical-red` there against the original scenario
   ledger. If no authenticated receipt exists, obtain an executable-RED
   review of the actual failing command there, then rerun the gate. Keep
   this item open when inputs or authority are absent.

## Completed source slice — retained Codex continuation

The completed Codex source sequence and exact proof remain in the [previous execution plan](evidence/current-claude-retained-continuation-20261121-plan-before.md); its registered proof and outstanding native qualification remain below.

The completed native settings diagnostic entry and its exact proof sequence remain in the [previous execution plan](evidence/current-codex-retained-continuation-20261120-plan-before.md). Its public refusal and native, continuation and cap limitations remain unchanged.

The two completed source-only settings checkpoints, including their exact proof and review sequence, remain in the [archived execution text](evidence/current-retained-native-entry-20261120-plan-before-condense.md); the registered proof rows and outstanding native and continuation obligations remain below.

The completed normal-trust window work and its exact earlier plan text are [archived](evidence/current-settings-join-20261119-execution-before.md); its decision, proof and checklist remain below. ROOT's subsequent native result is separate.

## Current bounded repair — staged outcome collaborators

The completed 44-code/21-raw staged scope, six common and three supplemental contexts, two distinct current approvals, exact capture requirements and ROOT-owned native work are preserved in the [exact prior execution plan](evidence/current-settings-join-split-20261119-execution-before.md); its proof and checklist remain below.

## Current bounded repair — mixed current review call

The completed mixed-call repair and its prior source sequence, controls, proof and native limits remain in the [exact archived plan](evidence/current-settings-join-split-20261119-execution-before.md); its proof and checklist remain below.

## Current bounded source repair — early bound cwd status

The completed early-bound status repair and its exact controls remain in the [previous execution plan](evidence/current-cursor-retained-continuation-20261121-plan-before.md); native and admission proof remain separate.

## Current bounded source repair — isolated model-turn budget

The completed timeout repair and its exact source proof are preserved in the execution plan at commit `4641cbd76`. Its proof, deadlines, and outstanding native obligations continue below.

## Current bounded source repair — testing navigation

The completed navigation repair and its exact earlier proof sequence are preserved in the [previous execution plan](evidence/current-codex-retained-continuation-20261120-plan-before.md); the registered proof and outstanding current native qualification remain below. The initial fragment-only link failure and the [approved assertion correction](evidence/current-root-wiring-navigation-explicit-link-user-approval-20261118.json) remain historical evidence; no other assertion changes are authorized.

## Current bounded source sequence — 2026-11-18

The [approved exact correction](evidence/current-root-static-preservation-grader-user-approval-20261118.json) was implemented in three independently reviewed GREEN commits, followed by the input-readiness repair at `67ca77e`. The historical [proposal](evidence/current-codex-static-preservation-replan-20261118-unapplied-full.diff), archived test and frame, failed native seven-of-ten run and prior REDs remain preserved; no new commits are required for that completed source sequence. The current testing-navigation repair is separate and does not qualify native execution.

The completed grader, resource producer, and picker source procedures are recorded in the execution plan at commit `4641cbd76`. Their proof and checklist rows below continue to govern closeout.

**Current amendment:** 2026-11-17, the two isolated fixture corrections below follow the completed raw-target and two-review source checkpoints. Raw delta JSON files remain work targets of the second required bounded review; code targets, exact two-review binding and earlier behavior/trust and other-host obligations remain.

## Next bounded amendment: judged raw targets

**Historical, completed:** ROOT archived/restored the rejected overlay at bd594f2; the two-review reader was committed at 8b9159c and the raw-target correction at 90b4b6f. The following retained instructions describe those completed source slices, not the next action. The next action is the isolated fixture repair below.

The completed raw-target source and fault-control procedure is recorded in the execution plan at commit `4641cbd76`.

ROOT then commits reviewed source, rebuilds all eleven fixed pairs ONCE from final bytes, preflights both exact groups and obtains two fresh normal approvals per pair through each checked staged coordinator. Rebuild/rerun current calibration against those exact source/input identities; prior calibration and five approved pairs remain historical, not automatically current. Only then may the existing one full-ten isolated diagnostic run; separate genuine normal trust, seven-delivery/public-join/admission obligations remain. No native or bypass invocation is authorized in this planning checkpoint. Decision accounting: only raw target/context role and the required fixture traversal change; every other recorded decision, proof denominator, customer boundary, guard, cap, model and deadline is unchanged.

## Current scope and execution entry

One pinned release per surface: Claude2.1.319 CLI; Codex0.167.0 CLI; Cursor3.29.9 IDE; CursorCLI2026.11.05-86047df; OpenCode 2.4.1 CLI/TUI. Five artifact versions, six runtimes, seven deliveries including current IDE project hooks. Actual Gherkin: 70 definitions /103 expanded examples /11 outlines. Discover required sets automatically from current registry/independent target fixtures/Gherkin, no caller host list. Root has reconciled the observed Cursor build/signature and separate asset provenance before publication; the asset ...a31 is not asserted to equal the signed build ...a30. Exact identities stay in the current root inventory.

Existing source work and older native diagnostics are historical checkpoint evidence, NOT fresh exact-current native/admission proof. Root owns Git/native/UI/model/fullsuite/authcleanup; author source/tests and normal source reviews. Historical ordinary trusted-RED and security gates remain open. Existing passing baseline behavior is characterization, never manufactured RED. New primary proofs use the normal trusted executable-RED flow after full Given/When/Then support is fixed, then freeze its inputs before production GREEN.

Completed amendments, earlier implementation order and full evidence are in [the exact preceding plan](evidence/current-host-only-history/f5aaf53a4ef1ecc62e7674929971c6820453b5a30f3ce0b1bdc4ecd762eabf51.stdout). The four PR purposes/dependencies below remain. Earlier preparatory PR3 invocation work does not permit completing/merging PR3 before PR1/PR2. Immediate current-target retirement is a prerequisite inside these slices, not a new product architecture/PR.

## Next bounded repair — two required staged reviews

Implement only after ROOT commits both newly reviewed plans. The changed part of **Disposable Codex behavior automation** is two required focused normal reviews and affected fixture cardinality, explicitly [approved by the user](evidence/current-root-two-review-user-approval-20261114.json). All other recorded decisions and all assertion meanings remain unchanged. The single-review WIP is rejected by [fe99](evidence/current-codex-complete-staged-scope-20261114-qa1-auth-retry-terminal.json): complete capture cannot fit and new validators were not reached. No code/test change is part of this planning checkpoint.

1. **Preserve and isolate the rejected overlay before source work.** ROOT first verifies and losslessly archives the exact three paths in [the frozen WIP map](evidence/current-codex-two-review-replan-20261114-frozen-wip3-sha256.json), their current snapshots and the earlier complete diff. Restore ONLY `tests/helpers/codex-reviewed-workflow.ts` and `tests/helpers/codex-workflow-runtime.ts` to their exact committed 57736 baseline, using the archived before hashes; move the NEW `tests/host-contract/codex-staged-scope.test.ts` out of discovery into that owned archive. ROOT owns restoration, after this reviewed concrete plan; no broad reset, deletion of the only copy or alteration of other work. Reverify both archive and restored baseline. Planning commits do not erase the roughly 400-line carried WIP budget (ROOT measured 346 added/52 removed); never commit that failing overlay as GREEN.
2. **First small GREEN source commit: two-slot authentication on existing scope.** Reuse the existing stage descriptor, packet owner and `authenticatedReviewStatus`, with two fixed role bindings (code and raw-deltas), not arbitrary caller groups or a new writer. Preserve old helper overloads/default trust behavior. Derive the group contract from the owned descriptor: code targets the complete required source list with four inventories/index/manifest as its six contexts; raw-deltas targets every actual raw owner delta JSON file with the identical six common inventory/index/manifest contexts. No duplicate within a packet; distinct IDs, each role once. The descriptor's required scope is not replaced by whatever a caller requested. Check normal authenticated kind/current approval, exact actually captured role targets/contexts, full collective representation and common identity, allowing only the repeated six common contexts, with every raw delta judged as a target. Preserve the current checked staged-coordinator route for dispatch and verification.

   Update only affected isolated consumer/picker fixture job creation/traversal to supply/check two real normal jobs, as the explicit approval permits. Retain every existing assertion condition, expected failure, no-exclusions/full-capture/source-and-snapshot stability check, default branch and grader predicate. Preserve the existing code-review ID spelling where useful; the second fixed slot adds no generic caller scope API. If a genuinely different assertion becomes necessary, stop with its exact unapplied patch. Do not apply the separately approved obsolete-test retirement in this slice.

   Add NEW `tests/host-contract/codex-two-review-binding.test.ts`. Valid real staging/normal capture/current sealed readers must run before faults; fake only the external reviewer/CLI edge. A valid first approved code job plus a missing or genuinely rejected second job should expose the old one-record acceptance at the actual reader boundary, not a missing import/type/setup error. Mechanical type support is not RED. Prove valid two-job acceptance and each missing/duplicate/foreign/wrong-role/stale/rejected/omitted-target/omitted-context/extra-path/partial-union/changed-common-input refusal. Extra captured scope must not pass merely because the old reader checks a superset. Assert named errors and preserve current capture/source fingerprints. This checkpoint still uses the earlier partial scope; it is useful source infrastructure, explicitly NOT complete staged-input or native permission. Do not launch isolated behavior from it.

   After support exists, SAME RED/GREEN command from `packages/cli`: `env -u GIT_DIR -u GIT_WORK_TREE -u GIT_INDEX_FILE -u CLAUDE_PROJECT_DIR SAFEWORD_TEST_LOCK_MAX_WAIT_MS=1800000 ../../scripts/dev bun run test tests/host-contract/codex-two-review-binding.test.ts tests/host-contract/codex-workflow-staging.test.ts tests/host-contract/codex-isolated-behavior.test.ts tests/host-contract/codex-isolated-consumer.test.ts tests/host-contract/codex-isolated-picker.test.ts`. Finish types/scoped lint/format BEFORE freezing this single targeted Vitest process; honor foreign leases. Read-only all-five/parity, complete test/direct-input before/after maps and current whole-delta normal QA precede ROOT's GREEN commit. Keep this commit comfortably below 400 total changed project lines, including NEW tests and fixture setup changes; if necessary split at a working helper boundary, never weaken guards.
3. **Second small GREEN source commit: complete derived scope and observed validators.** Merge the archived complete-generation/directory-group hunks into the now-working two-slot path, never overwrite the newly committed authentication with the whole old file. Reapply the NEW staged-scope test only with valid two-job setup. Derive the full generation input keysets and all differences; verify both inventory trees, remaining frozen baseline inputs, complete raw A/B bytes per differing owner, and the exact index/raw correspondence. Include all owned Codex helpers and exercised observation/essential/git/Python/steps/runner/grader/coordinator/generator entries. Distinguish generated package inventories; no required raw delta becomes a hash-only or opaque substitute. Live directory and live-baseline/hash-only unchanged-input limitations remain explicit trusted-boundary warnings, not silently closed.

   Use the same deterministic two groups. The existing unsigned [capacity diagnostic](evidence/current-root-two-review-capacity-diagnostic-20261114.json) measured code 888,875 bytes/49 files and raw-deltas 597,359 bytes/15 files, exact union/no exclusions/stable source and snapshot. Recheck real normal preflight for every rebuilt pair, including both byte and file-count limits. If either no longer fits, return unavailable and normal affected planning; no automatic third group, cap change, evidence thinning or capacity exception. In the raw-deltas job, every actual complete raw A/B owner delta JSON file is a work target (nine current files); the six common index/inventory/manifest files are context, identical to code role. All 44 code targets remain work targets in the first review. Both focused reviewers judge only their own complete targets, not a holistic pair. ROOT's current eleven-pair preflight, maximum596733 bytes for nine raw targets/six contexts, establishes fit only; recheck exact final bytes with no exclusions/representations under unchanged limits.

   Close fe99's second error with an observed valid pass and discriminating fail for EVERY new validator after setup reaches it. Rejected/stale group controls must use real normal current readers; delta-index missing/extra/wrong-path, raw bytes, unlisted change, keyset/baseline, missing B and post-approval relevant source/refresh changes must reach their intended boundaries rather than all fail at size. For raw-delta faults, obtain valid current normal captured jobs over the altered test-owned inputs where necessary so a stale receipt does not mask the independent owner-correspondence check. Preserve RED1 on its earlier bytes; do not claim it proves newly added variants. Old tests remain intact except approved two-job setup/traversal.

   SAME RED/GREEN command is the step2 command plus `tests/host-contract/codex-staged-scope.test.ts`; freeze all six selected files/direct dependencies explicitly. Statically check/format first, then one targeted process, all-five read-only/parity and whole-current-delta normal QA. Reuse passing checks only when actual selected bytes remain identical. Review and ROOT commit a separate GREEN checkpoint under the ordinary total-diff budget. No source step may commit current failing WIP merely to reset that budget.
4. **ROOT rebuild/review recipe after all consumer prerequisites.** Finish the separate normal-trust qualifier and remaining producer/case dispositions in later bounded slices first. Rebuild all eleven fixed per-case/arm A/B pairs ONCE from final committed reviewed source using existing `stageCodexWorkflowInputs`; old capacity candidates/reviews are stale. For each pair, normal `review run quality-review` from its staged project via its checked staged coordinator dispatches the two derived groups, with each role and common contract explicit. Collect both normal statuses, authentic current receipts and complete captured scope; independently verify source/generator/package inventories, normal generation and raw deltas. Only then supply both IDs/roles plus the same frozen manifest in the existing explicit isolated fixture. One extra normal review per pair; source fake-review jobs grant no ROOT authority. Every action and frozen B install rechecks both jobs, common identity, full trees and five enabled sources before any bypass argv can be used. Do not call either focused reviewer a holistic pair reviewer.
5. **One full behavior run and separate genuine trust qualification remain required.** Existing `scripts/dev bun packages/cli/scripts/check-codex-internal-workflows.ts --require-targets` uses that isolated fixture only after all prerequisites, retains all ten cases/eleven pairs, actual same-thread/new-process full B startup-before-tools, nonempty Node/fault/restoration and diagnostic-only bypass labels. Validate both real approvals per pair in its original artifacts before claiming staged-review completion. A normal-mode, source-fake, filtered or plain native pass cannot substitute. Reuse this ONE actual full-ten run for its applicable evidence facets, not a duplicated behavior suite. The retained normal-trust/invalidation sequence below still runs WITHOUT bypass and needs actual refusal/review/trusted callback A/B plus restoration. Seven deliveries, customer admission, unknown author, caps, restart/full public join, PR4, security-final and historical ordinary RED remain independently open.

**Next bounded fixture repair — 2026-11-17:** Preserve the [actual full-run failure](evidence/current-root-codex-full-isolated-20261117-verified.json): seven passed, three failed; prior pair reviews and calibration are historical after source changes. Implement only the [approved](evidence/current-root-native-fixture-fixes-user-approval-20261117.json) picker and resource-only boundaries in the existing two fixture helpers and necessary tests. The isolated picker recognizes the actual selected native folder prompt only for its exact owned project, logs its single action and verifies progress before picker observation without submitting a task. Wrong folder, other prompt, repeated or unconfirmed action must refuse; normal mode remains unchanged. Only the two exact resource case IDs with completed closure/checker and existing successful product assertions may record no model invocation and bypass false. Missing checker, wrong case or absent invocation in any other case must refuse; all parent-trusted and child-enabled checks remain. Add discriminating source-boundary regressions, preserving other assertions. Run appropriate targeted tests and statics, then normal independent whole-delta review. ROOT commits, rebuilds all affected pairs, obtains two current normal reviews per pair, reruns current calibration and one complete ten-case native diagnostic; no result stitching or inference of admission.

For RED, add focused cases in new `tests/host-contract/codex-native-fixture-corrections.test.ts`, using the real picker driver and runtime actor with the existing valid staged/review setup and only external native CLI/inventory faked. The current driver must refuse the exact owned-folder prompt as an unrelated native dialog; after valid resource setup and successful actual closure/checker assertions, the current preservation must report `isolated behavior argv missing` for `internal-references-resolve-their-complete-installed-resource-closure` and `missing-internal-resources-prevent-a-clean-generated-delivery-check`. Missing setup, import or auth is not RED. Add wrong folder, other prompt, repeated action, no confirmed progress, task submission, missing checker and wrong-case controls; assert actual outcomes and preservation facts. Then make the minimum helper changes and rerun the identical command GREEN from `packages/cli`: `env -u GIT_DIR -u GIT_WORK_TREE -u GIT_INDEX_FILE -u CLAUDE_PROJECT_DIR SAFEWORD_TEST_LOCK_MAX_WAIT_MS=1800000 ../../scripts/dev bun run test tests/host-contract/codex-native-fixture-corrections.test.ts tests/host-contract/codex-isolated-picker.test.ts tests/host-contract/codex-isolated-consumer.test.ts tests/host-contract/codex-workflow-runtime-harness.test.ts`. Finish types, scoped lint and format before the frozen test command, then read-only generated/parity checks and independent whole-delta QA. Use one Vitest lease and keep the source checkpoint below the existing approximately 400-line guard; split only at a coherent GREEN boundary. This is the source proof owned by `codex-isolated-preparation`; ROOT's refreshed full-ten native diagnostic remains a separate proof.

Historically, the first source step after ROOT's planning commit was step1's exact owned archive/restoration, followed by step2's small reader/fixture port. The separate approved obsolete-test retirement was subsequently completed; those steps are not the current source entry.

## Retained Codex behavior and rollout sequence

The original Opus6338d6d0 approach and f93 execution review retain their historical bytes/provenance. The two-review sequence above supersedes only their single-record staging/cardinality and affected fixture setup. Parser and approved preservation-predicate work have since been committed; historical unapplied/permission wording in this retained sequence does not create another pending decision. Current exact approvals and later receipts control. Remaining behavior, trust, startup/fault/restoration and population obligations below stay required; no new customer command or behavior.

1. **Parser checkpoint first.** Add NEW `tests/host-contract/codex-additional-tools.test.ts` with the actual sanitized current0.167 declaration shape and complete valid rollout/read support. Reproduce `unrecognized rollout protocol` as source parser RED, not native/primary/historical behavioral RED. In `scripts/check-codex-internal-reference.ts`, recognize only validated type/id/developer-role/namespace/custom/function declarations. Malformed, unknown and execution-like extra fields still refuse; declarations alone earn no read/call/output/startup/control evidence. Keep actual call IDs/output/read matching unchanged. SAME RED/GREEN command from `packages/cli`: `env -u GIT_DIR -u GIT_WORK_TREE -u GIT_INDEX_FILE -u CLAUDE_PROJECT_DIR SAFEWORD_TEST_LOCK_MAX_WAIT_MS=1800000 ../../scripts/dev bun run test tests/host-contract/codex-additional-tools.test.ts tests/host-contract/codex-internal-reference.test.ts tests/host-contract/codex-proof-quality.test.ts tests/host-contract/codex-workflow-essential.test.ts tests/host-contract/codex-workflow-runtime-harness.test.ts`. The new file/support must exist before attestation. Review/ROOT commit this useful independent checkpoint first if required by size or assertion authority.
2. **Assertion permission before isolated implementation.** The [exact preservation-grader diff](evidence/current-codex-isolated-behavior-replan-review-fixes-20261114-proposed-preservation-grader.diff) is UNAPPLIED and requires matching human approval. Normal `fiveTrustedBindingsUnchanged` stays unchanged; isolated mode instead requires `persistedHookTrustBypassed`, original fixture genuine trusted bindings and child enabled-binding preservation. No isolated pass counts until approved. Existing test assertions/fixtures remain frozen; propose any additionally necessary exact assertion patch before application. See the [baseline/hash/authority record](evidence/current-codex-isolated-behavior-replan-review-fixes-20261114-proposed-preservation-grader-authority.json). New tests may discriminate both branches; plan approval is not test-change authority.
3. **Prestage and vet both packages.** Extend the existing explicit engineering fixture and actor seams, reusing canonical copies/generator/inventories. Stage A/B ONCE with fixed per-arm resource/essential markers BEFORE A; retain both source snapshots/packages in existing owned artifacts. Both judgment arms need their own exact reviewed pair. Normal source/generator/staging QA precedes the staged-input normal coordinator `quality-review`: actual non-generated source/generator/staging inputs are targets, with complete actual A/B input deltas and full package SHA inventories as project-contained context. Normal packet/generated rules apply. ROOT independently verifies both complete staged trees and inputs against that approving authenticated job and freezes its review ID/inventories in the existing descriptor. The actor uses existing `reviewJobStatus`/source-fingerprint validation and checks kind/status/reviewer/target-context coverage plus exact expected identities; missing, stale, rejected, foreign or incomplete review, absent B or any drift refuses launch. A same-driver digest is not review. Generated bytes are qualified through deterministic generation and whole-tree comparison, not line-by-line model reading. If normal capture cannot bind the required inputs, return unavailable rather than inventing a seal, registry or capture exception.
4. **Concrete helper branches and source controls.** In `CodexInternalWorkflowActor.prepare()`/`requirePreparedTrust`, add an explicit isolated readiness branch requiring current binary, owned child paths, reviewed candidate/cache trees and five enabled source-bound events. Normal mode keeps its trusted barrier/assertions. In `CodexWorkflowRuntimeActor.refresh()`, isolated mode installs prestaged B at the same paths and rechecks all identities/inventory; it skips fresh `markRevision()`/generator calls and retains actual A/B trust statuses separately. `run()` adds the documented flag only for this explicit disposable invocation, never a global environment/sourceguard/default flag. `preserve()` retains normal assertions/output; the isolated branch independently observes original fixture config/runtime/package and original five genuine trusted bindings before/after, plus child enabled/source bindings unchanged. Keep grader child path/arm/count/raw-file verification unchanged. Any change to an existing assertion requires its exact approval before application.

   Add NEW `tests/host-contract/codex-isolated-behavior.test.ts` using real actor preparation/refresh/argv/capture and only fake external native CLI/inventory. Controls must catch absent/foreign/stale/rejected/target-incomplete review, self-populated expected input, missing B, source/generator/package/marker drift, wrong binary/profile/project, disabled/missing/foreign events, refresh skipping readiness, default-mode bypass or untrusted normal action, and incorrect mode/preservation facts. Prove fixed identities before A, no regeneration and unchanged default behavior. SAME source RED/GREEN command from `packages/cli`: `env -u GIT_DIR -u GIT_WORK_TREE -u GIT_INDEX_FILE -u CLAUDE_PROJECT_DIR SAFEWORD_TEST_LOCK_MAX_WAIT_MS=1800000 ../../scripts/dev bun run test tests/host-contract/codex-isolated-behavior.test.ts tests/host-contract/codex-fresh-trust-preparation.test.ts tests/host-contract/codex-workflow-runtime-harness.test.ts tests/host-contract/codex-workflow-essential.test.ts tests/host-contract/codex-proof-quality.test.ts`. Missing imports/types/setup/trust are not primary RED. Freeze every selected test/direct dependency before/after, ONE Vitest, types/scoped lint/format, all-five read-only/parity and normal whole-delta QA before ROOT commit. Inspect any generated difference; no hand-edited mirrors.
5. **ROOT behavior qualification after commit.** Supply the reviewed fixed A/B descriptor through existing `SAFEWORD_CODEX_GUARD_FIXTURE`, then run unfiltered `scripts/dev bun packages/cli/scripts/check-codex-internal-workflows.ts --require-targets`. Mode/argv/actual inventory/callbacks/effects/identities remain in original diagnostic artifacts before grading. `admission_eligible: false` stays fixed: isolated results NEVER feed conformance receipts, declarations, activation or admission. Same actual thread/new process/full B essential startup context BEFORE tools, real nonempty Node/fault/restoration remain required; no B guide/helper read. B must remain absent from A's history: if A reads the prestaged B, preserve the contamination and return unavailable, without hiding it or retrying to win. No stronger sandbox isolation is claimed. Filtered runs remain diagnostic, not full-ten credit.
6. **Owned normal trust/invalidation proof before completion.** `codex-normal-trust-invalidation` is a separate root-native qualification of the existing restart case, not a second full behavior suite. ROOT supplies the normal owned current0.167 fixture via `SAFEWORD_CODEX_GUARD_FIXTURE` with an explicit test-only `normalTrustQualification: true`, WITHOUT isolated mode or bypass. Exact command from the repository root: `scripts/dev bun packages/cli/scripts/check-codex-internal-workflows.ts --case a-restarted-session-receives-current-essential-workflow-instructions --require-targets`. Reuse existing child generation/install, `requireCodexNativeTrust`, inventory and unchanged bounded operator-review descriptor; no public command or new trust writer. Add only qualification capture/validation to those existing actor seams: before A and after changed-script B refresh record actual inventory and the readiness refusal while untrusted, normal human `/hooks` review only when inventory requires it, then actual five enabled/trusted bindings and genuine bound callback execution. Preserve the raw pre/post identities and script hashes; never infer invalidation from a changed hash alone. Require distinct observed untrusted→trusted transitions for A and B; if either is absent, foreign, already trusted without an observed transition or malformed, leave qualification unavailable (3), not satisfied. No model When may run during the readiness refusal. The source controls in step4 must exercise these actual actor qualification branches with only external CLI/inventory substituted, including normal wait/deadline forwarding and post-refresh faults; they do not qualify native trust.

   The normal actor's existing restart/After assertions additionally validate all required qualification stages and original fixture restoration before this selected run can exit0. Actual wrong behavior after valid setup remains2; missing review/observation or preservation failure remains3. ROOT verifies those raw inventories, normal review and callback identities against the exact staged package. The named proof/checklist item cannot complete from a plain `native-codex` pass, a normal run without the qualification field, or isolated diagnostics. The focused result remains filtered and not admission-eligible; the unchanged full-ten and normal `native-codex` groups are separately required. Do not predeclare a human trust block or retry until a desired transition appears. Root resource precedence, author/worker/caps/full-seven/public join/PR4/security-final/historical RED obligations remain unchanged.

Step4's intended source-only RED is `ISOLATED_BEHAVIOR_FLAG_MISSING` after valid installed preparation/current approving input review and a positive fake-native trusted inventory allow the old actor to reach the actual exec boundary. It discriminates missing explicit-mode argv wiring, not a missing method/import or untrusted setup. Preserve matching normal-mode/no-flag and isolated prepare/refresh tree/binding controls. Other inherited tree-check/synthetic-fault timing and outer-deadline warnings remain unwaived.

## Retained Cursor handoff generation eligibility sequence

The single design decision is **Cursor handoff current-turn eligibility** in `impl-plan.md`. This sequence repairs existing Task6 history isolation; it changes no Product/Gherkin/ledger, option default, target population or hook declaration. Prior source/native component approvals remain bound to their original bytes. The security sequence below is retained context, not permission for further dependency changes.

1. **Planning checkpoint and exact existing-fixture authority.** ROOT commits both normally reviewed plans before implementation. The [concrete proposed fixture patch](evidence/current-cursor-handoff-eligibility-replan-proposed-existing-fixture-patch.diff) remains unapplied. Before changing either existing test, [The user explicitly approved the prepared fixture-only patch](evidence/current-cursor-handoff-generation-fixture-user-approval.json) on 2026-11-13; it remains unapplied. That approval covers exactly its two paths: two empty marker writes in `architecture-review-owner.test.ts` become `generation_id: 'architecture-turn'` metadata (the helper already supplies that generation); `cursor-quality-runtime.test.ts` supplies the same `cursor-feedback-turn` generation in its existing edit and Stop payloads. No assertion changes. No approval is inferred from either plan review. The default-off review/retro fixtures and `cursor-state.test.ts` path assertions remain unchanged. If more existing fixtures need change, prepare their exact patches and obtain matching approval; do not add an unknown-generation fallback to keep old fixtures green.
2. **Valid installed-boundary RED.** Add a narrow source test using existing ordinary project/native-extension setup, real registered `afterFileEdit` and generated/installed Stop on BOTH IDE deliveries. Fake only the external file-edit/transcript/window transport. Start from a complete valid workspace, enabled option, actual edit callback generation A and malformed READY reply; genuine guard correction establishes that the evaluator and setup work. With no managed Stop1 (the actual host skips it at cap1), a new generation B in the SAME conversation with no edit must return `{}`. The current implementation genuinely fails that named stale-current-turn assertion. Add matching-generation, foreign-conversation, missing/blank/nonstring/legacy/malformed metadata and mismatching/raw-whitespace identity controls; no source-created approval/receipt/model tags. Keep structured-verdict eligibility with no edit as an independent shared-evaluator control. Do not use missing import/method/trust/auth/type failure as RED. Run the normal trusted executable-RED review where required, freezing complete valid support before the production fix. Source evidence is not native/primary/historical ordinary trusted RED.
3. **Minimal owner GREEN.** Modify only the existing `templates/hooks/lib/cursor-state.ts` metadata helpers and the writer/reader in `templates/hooks/cursor/after-file-edit.ts` and `templates/hooks/cursor/stop.ts`. Keep the conversation-scoped path and marker-presence cleanup semantics for every other consumer. Compare the original raw hook `generation_id` strings after type/nonblank validation, without transforming them; **do not use `resolveRunIdentity().turnKey`**, which trims. Unknown metadata gives no current-turn-edit evidence while marker presence still supports existing quality/retro behavior. No public schema/registry/store/new hook, alternate state path or change to the shared presentation predicate. Native and project bindings continue calling the same owner. Run the SAME source command GREEN, not a replacement population.
4. **Concrete source/regeneration boundary.** RED and GREEN command from `packages/cli`: `env -u GIT_DIR -u GIT_WORK_TREE -u GIT_INDEX_FILE -u CLAUDE_PROJECT_DIR SAFEWORD_TEST_LOCK_MAX_WAIT_MS=1800000 ../../scripts/dev bun run test tests/host-contract/cursor-handoff-generation.test.ts tests/host-contract/architecture-review-owner.test.ts tests/host-contract/cursor-quality-runtime.test.ts tests/hooks/cursor-state.test.ts tests/integration/cursor-stop-review.test.ts tests/integration/cursor-stop-retro.test.ts tests/host-contract/propagation-handoff-settings.test.ts tests/host-contract/propagation-settings-oracle.test.ts`. The new file must exist with valid support before attestation. After the fix, run focused existing `architecture-review-owner.test.ts`, `cursor-quality-runtime.test.ts`, `hooks/cursor-state.test.ts`, `integration/cursor-stop-review.test.ts`, `integration/cursor-stop-retro.test.ts` and the existing handoff/oracle settings regressions through the same pinned launcher, one Vitest only. Preserve done-before-architecture-before-handoff precedence, enabled/OFF/ON/OFF controls, original-loop-only handoff, cap1, marker-presence nudges/retro and default-disabled behavior. The existing fixture patch cannot be applied before exact human approval. All five generators run in normal safe order before final frozen tests; inspect every lifecycle result change and project-only parity. Never refresh original302 or hand-edit mirrors. Writer and reader are a matched generated pair: new reader plus stale empty-marker writer provides no current-turn evidence and is unqualified, not a healthy enabled guarantee. Old reader with new metadata still sees marker presence but retains its old history bug; rollback is not a repaired guarantee. Reject stale generated/mixed packages through existing generation/parity checks and require the exact matching pair in native qualification.
5. **Retained adapter checkpoint.** After the owner fix is reviewed, reuse `CursorNativeCatalogueActor`, retained factory/capture/shared settings grader and the existing scoped native Stop/cap decoder for six documented combinations plus a history-only no-current-tool observation. Preserve all four actual config bytes/configAfter, independent expected copies, original observations/raw before grading and the same retained installation. Use an actual supported edit action for edit-based eligibility; a read-only helper does not count as an edit. Do not infer generic tool eligibility, add expected decisions, clear state from the observer or require a fabricated second Stop. Record the actual initial followup, same-conversation automatic completed reply and exact installed cap1 skip. Meaningful captured faults independently pin each new outcome/config/correlation predicate without overlapping missing-reason/permission faults. Wrong actual outcomes remain2; missing current native observation/provenance remains3. Cursor CLI/OpenCode CLI/TUI have no Stop port. ROOT commits the reviewed source checkpoint before actual native execution.
6. **Root-only current native qualification.** First observe actual current3.29.9 `afterFileEdit` and completed Stop raw generation identities for one action in each delivery; docs and preToolUse/beforeShell samples alone cannot qualify that equality. If identity is absent/different or transcript shape is unknown, keep the path unavailable/unmet and return to normal affected investigation; never guess a generation, borrow another turn, change the cap or shrink the denominator. Then run both deliveries separately through the existing guarded window actor on the exact staged matched pair, six actual settings plus the same-history/no-current-edit control, preserving raw callback origin/status/conversation/generation, independent edit effects, configAfter and real host response/skip evidence. Same installation and per-action native provenance are mandatory; no universal same-chat promise outside the explicit history case, no model/tool/deadline/guard changes. Preserve every failed setup and whole attempt; no winning-case stitching. Only terminal-option consumption is claimed. Bare full propagation remains unavailable3 until supported continuation/caps/settings/full required population are joined; author-origin/cross-model, PR4, security-final, historical ordinary trusted RED and final fullsuite stay open.

## Retained dependency security sequence — approved records

The approach is **Narrow DOMPurify/Zod security update** in `impl-plan.md`; its decision status is unchanged. This is a bounded prerequisite within the existing PR2 dependency/security obligation, not a new PR or approach. Root commits both reviewed plans before implementation. The [user approval](evidence/current-security-update-user-approval.json) authorizes only two root override fields and three lock package records; all other lock/dependency entries, SDK2.0.32, Effect4.0.1, host pins, CI audit threshold and its two ignores remain fixed. No Product/Gherkin/ledger/testing-rule changes, new version-tripwire tests or global dependency update.

1. **Retain the baseline and use the existing audit boundary.** Before editing, archive exact `package.json`/`bun.lock` bytes and hashes and run `scripts/dev bun audit --audit-level high --ignore GHSA-vfj7-8cjw-p6xm --ignore GHSA-ch52-4w7c-c8xp`, retaining complete stdout/stderr/status. Also retain `scripts/dev bun audit` output without new ignores; its moderate findings remain open. A real named pre-fix high-severity advisory on the unchanged graph may supply the appropriate normal executable-RED evidence if required by the active gate. An OOM, setup/auth failure, old disposable output or already-passing audit is not behavioral RED. No fabricated BDD/version assertion or test-only defect.
2. **Apply only the authorized resolution delta.** Update the existing root DOMPurify override3.4.13→3.4.17 and add Zod override4.6.6, replacing Zod4.4.3. Produce the lock resolution through `scripts/dev bun install --lockfile-only --ignore-scripts`, never invented integrity data. Accept only matching lock override metadata and the DOMPurify/Zod package records, removing only the redundant `astro/zod`4.6.5 record. Inspect the exact diff against the archived baseline before a frozen install; reject any unrelated record drift instead of accepting a blanket update. Zod changes minor version within major4. Run `scripts/dev bun install --frozen-lockfile`; expected exit0 and unchanged candidate package/lock hashes. A required unrelated dependency/source change stops this slice for affected planning.
3. **Prove existing consumer compatibility.** Sequentially run `scripts/dev bun run build`, `scripts/dev bun run typecheck`, `scripts/dev bun run --cwd packages/website build` and `scripts/dev bun run --cwd packages/website typecheck`; each must exit0 on the candidate. Run the existing schema/lifecycle/plugin consumer tests through `env SAFEWORD_TEST_LOCK_MAX_WAIT_MS=1800000 scripts/dev bun run test tests/schema.test.ts tests/schema-projection.test.ts tests/lifecycle/ tests/claude-plugin/ tests/codex-plugin/ tests/opencode/ tests/plugin-resource-contract.test.ts`, with only one Vitest process. These are actual CLI/schema/install and Astro build/type compatibility checks, not runtime Mermaid sanitization or native proof. No existing assertion is weakened. Root later owns final fullsuite and existing-regressions confirmation.
4. **Retain bundle identity and verification limits.** Run the existing read-only `scripts/dev bun packages/cli/scripts/check-generated-surfaces.ts` and `scripts/dev bun scripts/parity-check.ts`. Source search found no direct production DOMPurify/Zod import, but that is not proof of transitive bundle neutrality. If generated payload bytes must change, stop before accepting extra generated changes under this package/lock-only authority; return through affected planning for normal generation and exact-current component requalification. Never reuse old native proof for a changed payload. Run configured targeted lint/format on the actual changed files, then the exact audit command from step1 again; expected audit exit0, no new ignore or threshold change. Capture unfiltered audit findings separately. Full lint remains unresolved: original and disposable updated graphs both OOM134 at unchanged limits ([comparison](evidence/current-security-update-lint-baseline-comparison.json)); neither run is GREEN, matching failure class does not prove matching cause, and no heap increase or waiver is authorized.
5. **Review and hand back the bounded candidate.** Normal current whole-delta quality review includes the exact override/lock diff, actual tests/build/type/audit logs and full prior warnings. Bind source/dependency hashes before and after final checks. Owner: source author for this bounded repair/checks/review, root for Git/posthooks/final fullsuite/native requalification if needed. Completion signal: exactly authorized graph installed, all named compatibility/high-audit checks0, immutable raw failures retained, unchanged SDK/Effect/pins/ignores and clear unresolved whole-lint/moderate/security/native obligations. The disposable trial ran no tests and cannot close this sequence. On failure, restore only the owned archived package/lock delta and report the consumer; no source workaround, extra upgrade or risk acceptance. Stop for root commit after reviewed checkpoint; no full7/admission/PR4 or historical ordinary trusted-RED claim.

## Next bounded repair — shared architecture review, then retained settings

This is the next Task6 dependency, not a new feature or permission to edit production during this planning checkpoint. Root first commits the current reviewed Implementation/Execution Plans. Preserve the seven failing Codex-port source files, original counterexamples and type failures until the source slice begins; none is GREEN or native evidence. The exact plan decision is **Shared architecture-gate owner and lane disposition** in `impl-plan.md`. Existing Product, Gherkin69definitions/101examples, ledger, SDK2.0.32/Effect4.0.1/lock, models, limits and selection remain unchanged.

1. **Freeze support before RED.** Archive the original port and current applicable source/fixtures, both documented-option JSON fixtures and generated input identities. Resolve the mechanical widened-handoff result type only through a scoped test-harness slice preserving all existing helper/Stop assertions; an import, type or absent-method failure cannot earn RED. Use the existing canonical feature/verify architecture Given, installed hook declarations, runtime and per-action raw/session origin. Capture the generated Codex Stop returning `{}` while the actual unchanged config has the gate on; retained prior counterexamples are source-process evidence, not native or historical ordinary trusted RED. Before changing the missing production route, complete normal executable-RED review wherever the active gate requires it, with valid full support and a named missing-cited-evidence outcome. Never retrofit old receipts or break an already passing baseline.
2. **Protect and extract the existing owner first.** Add `tests/host-contract/architecture-review-owner.test.ts` using ordinary disposable projects and the real installed/generated hook subprocess; fake only the external vendor edge when needed. Characterize Claude with architecture disabled/enabled, task/no-spec/nonapplicable-phase exemptions, missing/malformed/unimplemented plan precedence, uncited Decisions and current reasoned skip. Then extract the existing prerequisite and citation/review/model decisions once into the canonical shared hook library; retain Claude cumulative/parent/prerequisite ordering and hard-block behavior. Do not copy policy into callers or author approval/reviewer/model receipts. Review/model tests use existing normal trusted producers and verified-stamp readers in owned fixtures; never original302/profile keys. Unknown original-author or reviewer provenance must fail closed, including a changed current model that cannot prove the original author.
3. **Thin supported Stop calls.** Codex resolves only its session-bound ticket and calls the shared architecture entrypoint at feature verify as well as done, independently of the done-evidence branch and before done mutation and preserves its existing `stop_hook_active` one-correction behavior and done/handoff/retro order. The owner handles disabled options before prerequisites, so Codex gains no new default-on block. Current Cursor native and project hooks both call the same Cursor Stop owner: existing valid workspace/completed status and done-evidence checks first, shared architecture at loop_count0 next, terminal handoff after it, then existing edit/phase short-circuits/nudges/retro. Do not spend two followups, reset/increase caps, relabel a continuation as transition prevention, or change pre-tool policy in this repair. New Cursor architecture origin/order remains a qualification task, not assumed from the existing continuation positive.
4. **One RED/GREEN command and normal derivation.** From repo root run `env -u GIT_DIR -u GIT_WORK_TREE -u GIT_INDEX_FILE -u CLAUDE_PROJECT_DIR SAFEWORD_TEST_LOCK_MAX_WAIT_MS=1800000 scripts/dev bun run test tests/host-contract/architecture-review-owner.test.ts tests/host-contract/propagation-codex-policy.test.ts tests/host-contract/propagation-claude-policy.test.ts tests/host-contract/propagation-settings-oracle.test.ts`. Use that same launcher and paths for reviewed RED and GREEN. A setup/type/import/trust failure is unavailable, not product RED. New source negatives must detect an omitted shared call, option dropping, bypassed prerequisite and wrong/bound-exceeding outcomes after valid setup; repair through normal source changes and observe GREEN. Preserve existing frozen assertion sets and all prior failures. Register a new template module only if necessary through schema, then normal all-five generation in safe order; inspect every lifecycle result hash move as a behavior change. Project-only parity never refreshes original302/global plugins. Check types/configured lint/format plus targeted Codex done/handoff/retro and Claude regressions, and obtain current whole-delta normal quality review before root commit.
5. **Concrete settings and root native qualification.** Reuse `prepareNativeResourceActor`, retained adaptation, `captureNativePropagationActor` and `runArchitectureSettings`; no public command, observation importer, host checklist or new writer. All six documented combinations write/capture all four actual options unchanged during each native turn; compare immutable expected copies, retain original observations and persist raw/effects before grade. The same retained installation supplies each observation; per-action actual session/turn/runtime is required, not one universal chat. Codex's explicitly accepted same-thread restart proof remains separate. Architecture on must produce the canonical missing-cited-evidence outcome, off its unchanged legitimate control. That first failure cannot prove independent cross-model selection. Wrong observed behavior after valid setup is2; missing native dispatch/trust/provenance is3. Preserve the configured Claude forbidden-write capture2 and true-unobserved3 paths, other settings and resource/policy behavior.
6. **Root stages exact bytes before native actions.** Root prepares separate owned Codex guard/catalogue fixtures through normal installation. Any changed bundled script requires normal human `/hooks` review, followed by actual five-event inventory and exact staged package checks; never copy/write trust or regenerate random payloads during the unchanged bounded wait. Root runs the concrete factory/capture/settings methods from the reviewed immutable source on current Claude2.1.319, Codex0.167.0 and separately both Cursor3.29.9 IDE deliveries. Bind original native callbacks, actual outcome/continuation and independent per-action evidence; no CLI Stop claim. Q-author-origin must be qualified using existing trustworthy host/session metadata before real cross-model selection can pass. Unknown origin remains unproved/unmet, not a picker/config/env-injection success. No new identity store/writer is authorized. The root-native component harness is diagnostic until the existing required propagation runner includes these outcomes with its automatically discovered seven deliveries.
7. **Join only when honest.** Preserve the existing separate policy-only/resource-only/stale+normalrepair phases on retained installations. Keep default `--component resources` behavior and bare `--proof propagation --require-targets` unavailable3 until all applicable settings, supported continuation/caps and the full actual required population are joined. Cursor CLI and OpenCode CLI/TUI remain in the population with explicit architecture/cross-model completion limitations; their pre-action proofs cannot satisfy Stop. Status distinguishes Claude hard blocking from bounded Codex/IDE correction and reports each affected unproved guarantee/recovery once per installation/configuration/guarantee using existing presentation. It cannot present a bounded alternative as non-bypassable protection unless the existing central binding expressly permits it. PR4 admission, final fullsuite/security and the historical ordinary trusted RED remain gated.

### Current qualification work, not inherited proof

Read-only launcher verification: the root `package.json` test script forwards arguments through its CLI package test command; `run-vitest-with-build-lock.mjs` runs Vitest with the CLI package as cwd and rebases an optional `packages/cli/` prefix. Thus the `tests/host-contract/...` paths in the same root RED/GREEN command are CLI-relative filters, not repository-root files. The existing approved OpenCode design final54/9 log is supporting execution evidence of that launcher, not a new test run in this planning task.

| Gate | Concrete completion / consequence |
| --- | --- |
| Q-Codex-architecture | Normal trusted exact generated package; real six-config Stop outcome/callback and existing bound, with default/handoff/done regressions intact. Until then the new route has no native claim. |
| Q-Cursor-architecture / Q-Cursor-project-architecture | Independent current IDE native versus installed-project origin/callback, phase/ordering and loop0/loop1 controls through existing guarded window/actor. Root observes any unknown native payload before source adaptation; no guessed schema/history/UI framework. |
| Q-author-origin | Qualify original author metadata and verified reviewer identity through existing normal host/session producers, including unknown/model-change negatives. No fallback to the current Stop model; unresolved origin prevents the enabled cross-model claim. |
| Q-Codex-root | Keep the required root-origin resource/metadata-precedence row separate from compatibility-container hook evidence. Current0.167 root-format behavior is unqualified by container positives. Continue required isolated resource proof; use the accepted single native container for guard evidence. Any demonstrated all-facet root-format alternative returns to normal Implementation Planning review before a carrier switch; no execution-time packaging choice or older binary fallback. |
| Q-OpenCode-worker | Qualify the current 2.4.1 exported API and actual worker/tool-isolation semantics under fixed SDK2.0.32/Effect4.0.1. Existing scripted-loopback CLI/TUI callbacks prove only their observed transforms/effects. Use a proved current host projection or leave unsatisfied guarantees unmet; an incompatible API returns to affected planning, never an SDK upgrade or invented agent API. |

Before PR4 status-compatibility proof, resolve the remaining reviewed warning about which historical Safeword package inventories the existing catalogue actually covers. Do not assume a Claude-scoped inventory recognizes Codex/Cursor packages or invent another support list. If actual coverage needs a changed recognition owner, return to affected approach review before that implementation; preserve current-host existing activation semantics and do not claim unqualified packages recognized. Current component evidence and source identities are in the Implementation Plan evidence table. The current-root records do not authorize final package admission, shrink any existing required group or turn a known missing mechanism into a passed case. No other accepted obligation is deferred.

## Current-target removal and retargeting prerequisite

1. Snapshot current target fixtures/readers/controller/test IDs and discovered required sets. Compare independent intended target/delivery oracle against immutable root current inventory. Use current-host-only-active-inventory.stdout and population-readers.stdout as bounded discovery seeds, not an exhaustive allowlist. Preserve historical source/tests/results and frozen manifest bytes; exact old/new supersession identifies authorized older-host expectations, never proof relabeling.
2. Before production edits, public target/proof-runner tests must meaningfully reject remaining active older rows/fallback selection or missing current target/delivery AFTER valid setup. Keep independent current positives and existing config/reconciliation controls. Missing/extra/duplicate/wrong-version/runtime/delivery, bypass and stale-output mutations require named failure and repair pass. Auth/binary/GUI/setup failure is unavailable3, not product RED. Existing passing guards never earn invented RED. New primary behavior requires a normal attested executable-RED against genuine missing behavior.
3. Retarget existing targets.json/fixture codec/registry selectors/actual readers/runner case IDs to the verified snapshot. Retire old3.8 row, older-host-only fallback, upgraded-host/family compatibility groups and active older-version test/doc requirements. No second maintained host list/resolver/store/keywriter. Keep current3.29.9 project-hooks delivery independently from native; current-host normal Safeword install/upgrade/repair/uninstall, authored/config preservation and selected/unselected isolation remain. SDK2.0.32/Effect4.0.1/lock/toolchain/default customer selection unchanged.
4. Wire named `portable-components` in the EXISTING required runner to actual portable source scenarios through Codex plus BOTH current Cursor CLI and IDE; keep guard/continuation separate. Wire `cursor-project-hooks` as the current-IDE project delivery group replacing older-version group IDs. No new command, proof writer or caller population is added. Required independent population and real runner wiring controls cover six runtimes/seven deliveries; no silent skip/denominator drop. Native actors retain actual version/origin/session/trust/options/cap checks and root must observe unknown current mechanics before adaptation. Source fake-vendor records remain explicitly process-edge integration evidence, never native receipts. New code stays within existing owners/codecs/controllers; a divergence trigger in the approved implementation plan returns to normal affected planning before coding a changed design.
5. Run targeted target/retirement/runner and affected original regressions sequentially, then types/lint/format/generated/parity. Template changes use normal all-five generators and inspect lifecycle result SHA moves. Root commits reviewed slices, runs current native groups, actual immutable repository-current/owner-current and final fullsuite. Original302/cache/keys/profiles never become test targets. No author native/model/UI/Git/fullsuite/authcleanup.

## Pull-request slicing

**Decision:** multiple pull requests.

**Rationale:** native Cursor discovery and native OpenCode V2 transport have
separate host acceptance risks and can be proved while remaining ineligible for
normal activation. Full shared ownership then removes parallel authoring across
existing integrations. Finally, evidence admission and lifecycle activation make
those proved mechanisms available to customers. Each boundary has independent
proof and a safe baseline. These are conceptual boundaries, not size limits.
The entire accepted scope stays in these four local slices; no other ticket
discharges an obligation. No slice is automatically merged or published.

## PR 1 — Prove native Cursor delivery without changing default authority

### CLI-first execution supplement (accepted 2026-10-20)

Add the independent exact Cursor CLI 2026.11.05-86047df target to the existing
native catalogue and paired write outlines. Preserve the IDE rows and their
required proof unchanged. `native-cursor-cli` runs the actual source rows through
Cucumber and a native CLI actor, using fresh workspaces/config directories and
`--plugin-dir` for the generated portable core and Cursor extension. No test
relay may supply the candidate's policy or permission decision. The existing
four-mode CLI controls remain setup/supporting evidence only.

The first CLI primary RED selects the denied and allowed write rows together:
a test-owned empty
baseline package is loadable before the production generator exists, while a
separate observational native plugin proves the exact shell attempt occurred.
The requested shell write targets absent `.project/tickets/sentinel-write/ticket.md`;
shared policy should deny it. A real CLI tool result showing successful shell
execution and the sentinel reaching disk is `NATIVE_GUARD_DISPATCH_MISSING`,
exit 2. Missing binary, wrong version, login, model failure, missing native
observer or no actual attempt is unavailable, exit 3. Independently review this
executable RED before production integration. The required command is:
`scripts/dev bun packages/cli/scripts/run-host-contract-proof.ts --proof native-cursor-cli --require-targets`.

Generate one `packages/cli/cursor-plugin` extension from `CURSOR_HOOKS`, with
package-origin runtime dispatch calling the existing Cursor adapters and shared
decision owners. Keep skills solely in the portable core. CLI and IDE load the
same extension. Retain legacy project delivery/default selection unchanged.
GREEN must show the actual CLI shell result rejected for the shared ticket
policy and no sentinel, with a permitted contrast producing exact bytes. The
guard actor loads the native extension and observational control; catalogue
proof additionally loads the portable core. The actor parses actual stream-json tool results; model prose or a test-owned
decision record cannot stand in for production dispatch. Catalogue/helper cases
join the CLI group before full CLI conformance. Continuation remains required
only in the IDE native-cursor group; no CLI continuation claim is introduced.

Final gate-bearing CLI confirmation belongs to PR 4 task 3. PR 1 retains its
pre-gate diagnostics without claiming customer activation or relying on PR 4
for the safety of its preliminary delivery.

- **Purpose:** prove the highest-risk native Cursor boundary before migrating
  the catalogue and policy graph.
- **Boundary:** add the small delivery/enforcement binding types to the existing
  registry, canonical portable-core projection, thin Cursor hooks/worker extension, package
  resource closure, isolated native dispatch and its conformance capture. Add
  only the shared authority-gate mechanics needed for the isolated proof.
  Shipped project hook configuration and dispatch remain byte-unchanged in PR 1;
  bootstrap/gate experiments live only in isolated fixture packages. PR 4 owns
  publishing the project bootstrap and installing enrollment writers.
  Existing installations keep their current delivery; absent admitted package
  evidence leaves the native mechanism ineligible under the accepted selector.
  PR 1 root-format/extension experiments stay in isolated generated test bundles;
  current shipped native Codex identity and activation routing remain unchanged.
  Later activation uses the same proven generator, not a hand-maintained bundle.
  Do not switch live customer enrollment or claim full consolidation here.
- **Prerequisites:** none.
- **Proof:** current-target-retirement, the PR 1 headless portable cases,
  native-cursor-cli, native-codex and existing-regressions. XHMWSC owns the native IDE proof.
- **Completion signal:** exact Codex and Cursor CLI prove their required resource
  origins and guard outcomes. Codex also proves native continuation. Carry the
  unchanged IDE completion criteria from the prior plan at `eaca26a3a` into XHMWSC.

- **Relies on an unmerged successor:** no. The native mechanism remains an
  isolated proved candidate; default installation/status semantics are unchanged.

### First PR1 task — current-target retirement and portable proof wiring

Own `current-target-retirement` in PR1 BEFORE its existing target publication/native tasks. Execute the five numbered current-target prerequisite steps above in that order. Root first reconciles Cursor observed build/signature versus vendor asset provenance; completion is a root-owned verified provenance record bound to the new fixture, not a guessed URL/build equality. Target publication cannot precede it. This changes only target selection/proof population, not the PR1 frozen shipped project-hook configuration/default-authority boundary.

RED command from repository root: `env SAFEWORD_TEST_LOCK_MAX_WAIT_MS=1800000 scripts/dev bun run test tests/host-contract/target-version.test.ts tests/host-contract/repository-boundaries.test.ts`. Extend those existing test boundaries to invoke the actual current target/required-runner discovery with an independent 2026-11-07 intended oracle. After valid fixture setup, remaining active older rows/fallback/group requirements fail the exact `RETIRED_HOST_TARGET_REQUIRED` assertion; missing current host/runtime/delivery fails `CURRENT_HOST_TARGET_MISSING`. Vitest exits1 for the failing assertion; auth/import/GUI/setup errors cannot earn RED. Public source/completion checks retain named exit2 errors and unavailable3 for absent proof. Normal trusted primary executable-RED attestation is required before a new primary production repair, with its complete support frozen. Already passing controls remain characterization.

GREEN retargets only existing fixture/registry/reader/runner owners, removes older-host-only groups/tests and preserves current user-config/lifecycle/guard negatives. Run the SAME command; both files must pass, plus the named public missing/extra/duplicate/wrong-target/bypass/stale mutation/repair controls and required current runner wiring. Completion requires an exact independent five-version/six-runtime/seven-delivery set; counts alone cannot pass. Record scope supersession and preserve old raw results/maps. Root reviewed commit is required before fresh actual native proof.

PR 1 owns the two headless portable cases `codex-0.167.0-portable-components` and `cursor-cli-2026.11.05-86047df-portable-components`. Run each exact profile through the existing portable Cucumber config and validate one complete passing scenario with the matching case ID and real catalogue/resource origin. Missing setup is unavailable, and wrong content/precedence is a mismatch. XHMWSC owns `cursor-ide-3.29.9-portable-components`. The existing full `portable-components` command still requires all three and contributes to full-set proof. PR 1 completion uses the two headless results independently of PR 4. Portable loading grants no guard or continuation claim.

The IDE-only Accessibility work and real `native-cursor` parts of tasks
2, 3, 5, 6 and 8 below belong to XHMWSC. Their shared source and CLI parts
remain here. Four exact IDE case IDs remain required for XHMWSC.

### Tasks and tests

1. Prepare test infrastructure first, with no production edits. Add
   packages/cli/tests/fixtures/host-contract/targets.json for the five current artifact versions, six runtime rows and seven delivery cases, synthetic project builders, and a
   required-mode runner at packages/cli/scripts/run-host-contract-proof.ts.
   Resolve official exact-version distributions into an isolated test cache;
   verify binary-reported version, recorded artifact identity and vendor signature
   where provided. Use the existing pinned Codex binary. Never replace the user's
   application, alter their shell profile, or silently select a different target.
   Native target unavailability is a failed prerequisite, not a skipped pass.
2. Create packages/cli/tests/smoke/host-contract.live.test.ts with a Cursor IDE
   fixture using an isolated user-data/extensions directory and synthetic
   workspace. Drive the actual macOS IDE Agent controls through Accessibility
   automation; observe readiness and hook/session signals rather than fixed
   sleeps. Use the version-matched observed UI controls, a real agent turn and
   real filesystem sentinel checks. CLI cursor-agent execution is not this proof.
   Use the existing authenticated host boundary without exporting credentials or
   receipt integrity keys into the project. Required OS/host trust remains a real
   prerequisite; do not auto-grant it.
   Bind the first native-catalogue outline row through thin
   steps/consistent-host-contract.steps.ts glue before requesting executable RED
   review. A test-owned Cucumber configuration under the host-contract fixture
   selects that exact feature/outline row and imports the real step actor; it
   permits the ticket's in-progress source without changing the ordinary
   acceptance exclusions. The required runner executes this Cucumber proof,
   checks the selected row actually ran, and retains its actor-boundary failure.
   Undefined/pending steps are preliminary wiring failure only. Vitest supports
   the harness; it does not replace this executable scenario boundary.
3. Regression: rerun the historically passing, current-target unproved exact CLI and IDE write/catalogue
   cases using their normal native-cursor-cli and native-cursor commands. Keep
   their existing case IDs, actual tool-result/side-effect assertions and
   resource-origin checks. The production generator now exists; never stage
   the historical empty candidate to manufacture another missing-dispatch RED.
   Retain the original independent RED receipts. Existing passing cases need no
   new production implementation. Setup/login/version failures remain unavailable
   (3); an observed regression must reach its specific boundary assertion before
   being treated as product failure. The runner still requires all three CLI
   IDs and all four IDE IDs; diagnostic success alone cannot admit a package.

4. GREEN: extend packages/cli/src/lifecycle/integrations.ts and schema.ts with
   the accepted binding declarations; add the canonical render primitives and
   generators for the portable core and packages/cli/cursor-plugin projection.
   Generate package assets, never hand-edit them. Keep native Cursor skills
   exclusively in the shared core; the extension owns hooks/workers and only
   necessary non-overlapping rule facets derived from canonical content.
   It emits no duplicate public command for a core workflow. Retain existing
   project wrappers and static references unchanged in legacy/Cloud fixtures;
   their presence makes native registration ineligible. The native fixture is
   an eligible clean project with no competing project registrations. Test-owned
   bootstrap scaffolding may establish discovery but cannot implement a guard.
   Enumerate the actual IDE rules, commands, skills and wrapper resource origins;
   any duplicate public workflow/content owner rejects cutover.
   Resolve helpers from package origin using the existing installed-CLI resolver,
   and include complete templates in every standalone-runtime bundle.
5. Wire Cursor workspace discovery and host codecs to the existing shared
   decision owner. Use the supported workspaceOpen/pluginPaths contract only
   after the exact host accepts it. Required registration rejection keeps the
   mechanism ineligible. Capture observed host/package/workspace identity in the
   declared activation family and sealed originating conformance receipt.
   Keep the shared project compatibility hooks and reachable assets intact.
   For the historical guard RED, the existing allowed-action control ran in its
   separate legacy setup, then exercise the clean native fixture with test-only
   observers and bootstrap, without legacy guard dispatch supplying the result.
   Add thin steps for the exact Cursor denied/allowed outline rows and required
   IDs cursor-3.29.9-native-denied-write / cursor-3.29.9-native-allowed-write.
   Fixture cursor-native-write uses a synthetic .project/tickets/sentinel-write/
   directory and absent ticket.md sentinel: request one Shell write to that
   ticket artifact, letting current shared shell-ticket policy govern it; the
   allowed contrast writes exact random content to allowed-sentinel.txt.
   The native actor must attempt the actual tool once, not merely refuse in text.
   Missing native dispatch with the denied sentinel created is exit 2,
   NATIVE_GUARD_DISPATCH_MISSING; no actual attempt, login or discovery failure is
   unavailable (3). GREEN requires the native hook's shared policy reason and
   absent denied file, plus the allowed file's exact content and genuine native
   dispatch traces. Observers never decide permission. The original executable
   RED and implementation receipts are preserved in cursor-native-guard-proof.md
   and cursor-continuation-proof.md; current runs are regression confirmation.
6. Regression: retain the historically passing, current-target unproved native allowed/denied cases;
   then invoke a changed canonical skill and referenced guide/helper marker.
   Attempt actual turn completion and observe the bounded subsequent host turn.
   Required IDE case cursor-3.29.9-bounded-continuation belongs to native-cursor
   and all-hosts. Fixture cursor-unfinished-ticket-stop in
   tests/helpers/cursor-native-continuation.ts uses a synthetic unfinished ticket,
   clean native-eligible workspace and owned user-data profile. Bind the actual
   completion outline through steps/consistent-host-native-continuation.steps.ts.
   Run the exact native-cursor command after catalogue and guard setup controls.
   The historical RED was HOST_CONTINUATION_MISSING (exit 2); its approved
   executable receipt and passing implementation are recorded in
   cursor-continuation-proof.md. Do not seek a new missing-behavior RED for this
   existing passing case. Setup failures remain unavailable (3). Passing proof requires an actual subsequent
   IDE turn with the unmet verification requirement and no manual resubmission.
   Missing this case leaves native-cursor incomplete, never success. This is
   distinct from PR 4's continuation-cap exhaustion case.
   A command listing, simulated hook payload or model saying it was blocked
   cannot satisfy these assertions.
7. GREEN: rerun the pre-existing step-3 Codex root-format/extension-precedence
   cases with scripts/dev bun packages/cli/scripts/run-host-contract-proof.ts --proof native-codex --require-targets.
   Force root discovery rather than accepting compatibility-overlay loading.
   The earlier RED names root-format rejection or compatibility-overlay fallback
   after the pinned host launches. GREEN requires root-origin resource
   markers and extension precedence, not merely a successful native command.
   Keep that root-format case a resource-only capability fixture. Add required
   codex-0.167.0-denied-write / codex-0.167.0-allowed-write cases using the actual
   native compatibility container and the same synthetic shell-ticket-write
   policy/allowed contrast. Native hooks/list must first show the expected
   package-bound hooks enabled and trusted; otherwise unavailable (3), never
   product RED or a trust bypass. Retain a passing pre-existing guard baseline
   as regression evidence. Required missing behavior is exposed by the relevant
   current boundary proof; do not make an already passing native case fail.
   Before closing this native-codex group, add required case
   `codex-0.167.0-bounded-continuation` in host-contract.live.test.ts, fixture
   `codex-unfinished-ticket-stop` (isolated installed/trusted target, synthetic
   unfinished ticket and current shared completion bound). Use the real native
   completion boundary within one Agent invocation. RED is exit 2 with
   HOST_CONTINUATION_MISSING when the rejected stop ends the invocation, or
   CONTINUATION_BOUND_EXCEEDED when further automatic turns exceed that bound.
   GREEN requires the actual subsequent host turn, native stop/continuation
   observations, no manual resubmission, and termination at the configured bound.
   The native-codex required manifest and all-hosts require this ID alongside
   portable/resource/allow-deny IDs; missing trust/setup is unavailable (3).
   Preserve a passing baseline as regression proof; do not fabricate a failure.
8. REFACTOR: keep host event decoding/encoding and paths in the adapter; remove
   pilot-only duplicated policy or resource rewrites. Preserve the accepted
   policy inputs/outputs. Rerun native-cursor, native-codex and existing-regressions
   after any changed production bytes.
9. Regenerate and run the per-slice verification sequence below. Missing native
   proof leaves this slice incomplete; manual observation cannot clear its
   automated obligation. If IDE automation or pluginPaths is infeasible on the
   accepted target, return the affected engineering decision to Implementation
   Planning; do not change the target or substitute manual proof silently.

## PR 2 — Prove native OpenCode V2 and retire V1

- **Purpose:** establish the sole supported OpenCode V2 transport and remove V1 active support under the 2026-11-06 user approval.
- **Boundary:** isolated Promise SDK 2.0.32/Effect 4.0.1 package, native transforms and typed denial; exact V2 CLI/TUI proof, shared sealed local-run capture/read, fresh native activation and registration/public status. No unrelated shared policy migration or dependency upgrade.
- **Prerequisites:** PR 1 — Prove native Cursor delivery without changing default authority; current retirement scenario, implementation and execution reviews before removal.
- **Proof:** opencode-retirement (public selection/generation/population and unsupported/admission controls), native-opencode (V2 CLI/TUI complete feature-derived population), opencode-registration-status, coexistence (V2 selected/unselected project isolation and unrelated configuration preservation), existing-regressions. Historical V1 evidence stays archived and cannot satisfy V2.
- **Completion signal:** both exact V2 runtime rows pass their catalogue/resources/allowed-denied/worker/registration/status controls on a fresh current package. Independent retirement oracle proves no active V1 generation, registration, selection, schema ownership or required proof cases. V2 dependency audit risks remain explicit; no self-issued shipping acceptance. Required/optional native rejection and separate activation still reach truthful public status.
- **Relies on an unmerged successor:** no. Candidate remains customer-ineligible until PR4; normal install reports admission-unavailable instead of generating V1 or silently enabling V2.

### Tasks and tests

1. Preserve exact prior plans/scenarios, old review inputs and unfinished V1 callback WIP in the retirement history/hashmap; remove obsolete unreviewed callback additions. Keep the independent unresolved-scope wording correction. Amend current scope, scenarios, implementation/execution plans and affected ADR through normal reviews/stamps before production removal. No old result or ledger success is rewritten.
2. RED: add tests/opencode/retirement.test.ts with an independent literal V2-only target oracle. Invoke actual integration/profile install in a private marked project/profile: normal install must not write V1 delivery or report healthy/changed V2 activation without admission. Inspect actual generated handler/schema/resource and required proof case population; no V1 case may be selected or required and V2 CLI/TUI cases must remain. Exercise the public required population and selection boundary with independent V2-only oracle: no V1 active delivery/case can be required or selected; current missing-admission must still fail closed. Run scripts/dev bun run --cwd packages/cli test tests/opencode/retirement.test.ts. Intended initial failure: OPENCODE_V1_ACTIVE_DELIVERY_REMAINS after valid setup, never import/setup failure.
3. GREEN: remove V1-only plugin/identity/catalogue/config/schema/runtime/status/conformance/activation producers/readers and active exports; update actual generation, integration, package and proof selectors. Retain shared codec/dispatcher/process/model/content/sealed owners still used by V2 or other hosts. Previously copied external V1 profile assets remain untouched; no V1 classifier/cleanup layer is added and no command claims they were disabled, migrated or removed. Retired V1 evidence is excluded from current protection; no old binary execution or external-file deletion is required. Keep schema-format v1 markers that are not OpenCode V1 host support. Normal public install returns actionable admission-unavailable until current V2 admission is implemented; retain existing internal nativeV2 selected-candidate staging for bounded proof. No new wrapper/service/compatibility layer, automatic network install or V2 guard relaxation.
4. Retire V1-only tests, helpers and runner requirements only after removing their active implementation; preserve their prior bytes in history. Recompute the exact required case population from the amended canonical feature/population policy and record removed case identities with reasons. Update affected step wiring and current scenario/ledger names without manufacturing RED/GREEN annotations. Keep all remaining other-host cases, V2 registration required/optional controls, worker fresh-context/forbidden, commands, guides/helpers, Write/Edit and Bash allowed/denied boundaries. Unknown V2 Patch remains unproved.
5. Positive component controls: reuse actual SDK setup/callback, V2 enrollment/native activation/sealed status, tool-codec, dispatcher, lifecycle/config preservation and other-host tests. Private installed fixtures prove current canonical decisions/effects; stubs do not prove native delivery or customer admission. Root later builds a fresh immutable current candidate and runs unchanged retained V2 probes plus revised complete V2 population; authors do not run actual native/model/fullsuite.
6. Preserve the full locked audit and narrow repair outcomes: exact SDK2.0.32/Effect4.0.1 lock identity, current two moderate glob/minimatch risks open, no suppression/risk acceptance. Retirement removes only dependencies actually made unused by removal; no broader upgrade.
7. REFACTOR/verification: normal scripts/dev scoped types/lint/format, all-five generation and parity, inspect/explain lifecycle result SHA changes caused by intentional retirement. No generated hand edits. Normal independent current-source QA includes complete prior findings, user approval, retirement inventory and all source/generated hashes; root commits via normal hooks and verifies review freshness afterward. Pause at a coherent ~400 authored-line checkpoint if necessary; unfinished V1 removal remains explicitly open.

## PR 3 — Remove parallel authoring across the complete shipped inventory

- **Purpose:** make one authoritative content/policy edit reach every host.
- **Retained bounded amendments:** normal Claude stream confirmation, canonical
  testing payload and invocation-harness corrections are implemented; the broader
  slice's owner/disposition/adoption obligations remain incomplete.
- **Boundary:** complete discovered content and handler inventory, all host
  dispositions, shared owner adoption, generator/architecture checks and
  before/after ownership evidence, including TBU2.R3's native Codex invocation
  projection, bounded existing SessionStart essential delivery and all ten required
  cases. Keep live native customer cutover ineligible. The current bounded
  supplement above is PR 3 work; interim checkpoints do not complete this slice.
- **Prerequisites:** PR 1 — Prove native Cursor delivery without changing default authority;
  PR 2 — Prove native OpenCode V2 and retire V1.
- **Proof:** native-claude, repository-boundaries, repository-current, headless-propagation, owner-delta,
  owner-current, policy-options, codex-startup-essential, codex-internal-workflow-wiring,
  native-codex-internal-workflows and existing-regressions. Fixture mutations diagnose mechanisms;
  repository-current and owner-current prove the actual repository's adoption.
- **Completion signal:** every source facet and configured handler has exactly one
  owner and complete lane dispositions; the existing shared-policy and shared-skill
  changes propagate without per-host authored edits; all deliberate drift/bypass
  mutations fail for their named reason and pass after repair. Recorded owner
  deltas identify removed independent maintenance, not fewer emitted files.
  All ten TBU2.R3 cases must also pass through their named actual boundaries;
  narrower diagnostic or structural results cannot complete that amendment.
- **Relies on an unmerged successor:** no. Current default deliveries use the
  consolidated sources and remain supported; new native mechanisms stay
  ineligible until admission, rather than needing a successor to be safe.

PR 3 owns `headless-propagation`. Extend the existing runner and retained
controller for a registry-derived non-IDE diagnostic. Prove the five exact
lanes, same-installation policy/resource/settings effects, supported Claude
and Codex continuation, stale-lane refusal and normal repair. The new
`headless-qualification.test.ts` runner-boundary tests begin here with the
propagation fixture and expand in PR 4. The full public propagation proof
keeps its current required population and refusal.

### Tasks and tests

Before PR3 completion, execute every named retained contributor proof for the completed harness/preparation/checked-cd/literal-grouping/validation/output controls in the Proof specifications against current source; their former build chronology is historical. A proof command, not archive prose, closes each corresponding checklist item. Fresh current native groups remain independently required.

1. RED: add packages/cli/tests/host-contract/repository-boundaries.test.ts using
   disposable source trees and the real required repository check. Seed an
   independently maintained intended-facet fixture from the accepted baseline
   and compare exact sets against source discovery, configured handlers,
   declarations and generated outputs. Run
   ../../scripts/dev bun run test tests/host-contract/repository-boundaries.test.ts
   from packages/cli. Expected failure names the missing current facet or
   competing owner, not an import or fixture setup failure.
2. GREEN: migrate the full canonical graph, including every actual skill,
   reference, guide, handbook, command, worker and helper. Discover the complete
   SETTINGS_HOOKS, CURSOR_HOOKS, Codex and the sole current OpenCode V2 dispatch inventories,
   including SessionEnd, async/rewake and shell facets. Stable shared IDs map to
   existing decision owners; every supported lane has an explicit disposition.
   The independent fixture is a test oracle, not a second per-host production
   catalogue or a place to copy workflow text.
3. Consolidate the concrete duplicate paths named in impl-plan.md: equivalent
   renderer lists/resource rewrites, OpenCode calling Codex rendering, and Codex
   adapter-local intake predicates. Replace independent predicates with calls
   to their existing shared owner, preserving workflow semantics and public
   command result/exit meanings.
4. For each host route, write a denied and an allowed behavioral control through
   its installed dispatch boundary before removing its old owner. Add mutation
   controls for missing disposition, new unclassified component/handler, second
   owner, bypass route and stale derived output. Assert exact rejection and
   successful restoration through the same public check process.
   Own the Claude exact-host controls here, before retiring its shared-policy
   path. Add the `native-claude` group to the required runner and extend
   host-contract.live.test.ts with fixture `claude-2.1.319-installed-contract`:
   isolated authenticated profile, actual generated native Claude plugin, trusted
   package registration and synthetic project with unfinished ticket/config. Reuse
   the native process/discovery mechanics of claude-plugin-discovery.live.test.ts;
   never use the global newer Claude as the target. Run
   scripts/dev bun packages/cli/scripts/run-host-contract-proof.ts --proof native-claude --require-targets.
   Required case IDs: claude-2.1.319-denied-write, claude-2.1.319-allowed-write,
   claude-2.1.319-catalogue-helper, claude-2.1.319-bounded-continuation. Each drives
   a real native Agent turn: denied sentinel stays absent with the policy reason;
   allowed sentinel appears; canonical workflow/guide/helper markers resolve from
   the installed package; a rejected completion produces another host turn in
   the same invocation up to the actual configured bound. Missing behavior exits
   2 with DENIED_SIDE_EFFECT_OBSERVED, ALLOWED_SIDE_EFFECT_MISSING,
   NATIVE_HELPER_ORIGIN_MISMATCH or HOST_CONTINUATION_MISSING respectively. Valid
   setup plus all four current-payload native observations yields exit 0. Missing
   executable/trust/auth is unavailable (3), not a pass or product RED. If baseline
   already satisfies a case, retain it as regression proof; do not invent RED.
   All-hosts requires these four IDs and PR 4 declaration admission consumes their
   originating exact-host receipts, rerun after final shipped payload changes.
5. RED/GREEN for policy-options: create
   packages/cli/tests/host-contract/policy-options.test.ts and the
   documented-option-composition fixture. Run
   ../../scripts/dev bun run test tests/host-contract/policy-options.test.ts
   from packages/cli. The fixture supplies real synthetic ticket/config files
   for terminalHandoffCorrection, architectureReviewGate, crossModelReview and
   designApprovalGate, their valid values and meaningful combined settings.
   Resolve and execute the actual installed hook command from the binding,
   feeding the declared pre-action/stop protocol; do not inject a policy result.
   This Integration proof is the helper subprocess/shared-owner boundary, not
   an installed-host claim. Expected RED is a dropped option, wrong enabled
   guarantee/bound, or adapter-specific predicate deciding instead of the shared
   owner. GREEN asserts the documented allow/deny/context/continuation result
   and actual configured guarantee for each fixture; supported non-default
   combinations must not require customer conformance. Existing passing cases
   are characterization, never fabricated RED.
   Mutate one adapter-local option predicate and one option-dropping route in
   disposable copies: the actual repository-boundaries process must exit 2
   naming the bypass, then return 0 after restoration. The propagation group
   additionally invokes real exact-version hosts with these changed policy
   inputs and observes the resulting guard outcome without adapter edits.
   Final ranking/permitted-fallback status scenarios belong to PR 4's selection
   cases below, because those require PR 4's real evidence admission reader.
6. Complete packages/cli/tests/host-contract/propagation.live.test.ts and the existing propagation runner on SAME retained installations. Policy-only preserves resource bytes; separately skill/guide/helper-only preserves policy. Require actual native permission/reason/allowed effects and documented nondefault option outcomes with exact session/runtime/helper provenance. Continuation/cap applies only on supported Claude/Codex/IDE boundaries, no Cursor/OpenCode CLI Stop claim. Use existing source prep/generators/reconciliation/controllers, no expected-label observations. The shared architecture-owner repair and per-lane qualification above precede completion of these settings; do not mark the existing failing port GREEN from option/config echo. Then mutate only the existing canonical verification-marker policy,
   refresh normally without a host list and invoke the five non-IDE deliveries. XHMWSC owns the real seven-delivery run.
   Repeat for one canonical skill plus referenced guide/helper. Leave one lane
   stale as a negative control; completion must name that exact lane. Restore
   fixture inputs, refresh and prove all rows pass.
7. RED: create packages/cli/tests/host-contract/owner-inventory.test.ts. Build
   committed baseline/candidate trees in disposable Git fixtures using the
   independently intended owner/facet mapping. Invoke the real repository
   check/capture entrypoint at packages/cli/scripts/check-host-contract.ts with
   --owner-delta, --baseline, --candidate and --json (commit identities are fixture
   inputs, never caller-supplied savings). Run owner-delta:
   ../../scripts/dev bun run test tests/host-contract/owner-inventory.test.ts
   from packages/cli. Before GREEN the expected failure is missing/incorrect
   retired-owner output or acceptance of a retained competing owner. Assert
   exact retired owner IDs and retained mechanical translations against the
   independent oracle, producing exit 0 only for the matching consolidated
   candidate. A candidate retaining the old independently authored predicate,
   even with the new interface present, must exit 2 and name that competing
   owner. Caller-supplied savings/owner assertions and a file-count-only claim
   must exit 2 with an invalid evidence/input finding. A command/setup failure
   does not count as this RED.
8. GREEN: implement the check/capture entrypoint over committed source graphs and
   the trusted sealed owner writer, never over caller-authored success fields.
   Add mutation/repair pairs: retain the old independent source, reject it for
   the expected competing-owner ID, then remove it and observe the exact owner
   delta. Preserve necessary generated/runtime translations and user assets.
   Run owner-delta and repository-boundaries to prove both the primary report
   boundary and completion rejection, not a trivial standalone test.
9. Capture the real baseline f48275b5e616010f3ce76bf5baf7329603f9ac57 and
   actual current committed source tree through that controller. Retain sealed
   before/after graph, oracle and owner-set identities. CI/review recomputes
   this exact delta from committed trees instead of authenticating another
   profile's copied HMAC receipt. Link captures/check identity in the ticket.
   For owner-current, start in the candidate repository root and run `"$SAFEWORD_REVIEWED_CHECKOUT/scripts/dev" bun "$SAFEWORD_REVIEWED_CHECKOUT/packages/cli/scripts/check-host-contract.ts" --owner-delta --baseline f48275b5e616010f3ce76bf5baf7329603f9ac57 --candidate HEAD --json`. Set `SAFEWORD_REVIEWED_CHECKOUT` to the separate full source checkout containing the independently reviewed checker and expected data. Verify generated packages with the ordinary repository check.
   Resolve HEAD to an immutable commit before capture and retain that identity.
   Require exit 0 and the independently expected exact retired-owner set,
   including codex.intake.required-fields (codex-hook.ts missingIntakeFields and
   its private required-field predicate), opencode.catalogue.codex-renderer-authority
   (OpenCode's generateCodexPluginAssets dependency) and
   opencode.catalogue.cursor-command-authority (Cursor-owned command catalogue
   used as OpenCode's authoring authority). The complete intended-facet oracle
   covers every additional consolidated owner; this list is not an upper bound.
   Necessary host codecs remain explicitly retained. A missing expected retired
   owner, retained competing predicate or incomplete baseline exits 2. This is
   the actual committed repository, not just a synthetic fixture pair.
   Also run repository-current against the actual unmutated working tree:
   scripts/dev bun packages/cli/scripts/check-host-contract.ts --json.
   Exit 0 requires complete actual source/handler discovery, exact lane
   dispositions, sole policy ownership and current generated projections.
   Missing current facets or competing current policy exit 2 with named IDs.
   Keep the fixture mutation tests as supporting diagnosis, never substitute
   their passes for these two actual-repository command receipts.
10. REFACTOR: delete retired independent authoring paths and tighten imports;
    do not delete necessary generated copies or retained shared compatibility
    resources. Run repository-boundaries, propagation and owner-delta, regenerate
    all surfaces, then perform per-slice verification.

## PR 4 — Activate truthful proof-gated delivery and recovery

- **Purpose:** let Safeword select and maintain proved delivery automatically.
- **Boundary:** evidence integrity/admission, status/doctor details, compositional
  package proof, local enrollment/handshake, selected-host migration/recovery,
  mandatory CI checks, final documentation and demo. Do not publish or merge.
- **Prerequisites:** PR 1 — Prove native Cursor delivery without changing default authority;
  PR 2 — Prove native OpenCode V2 and retire V1;
  PR 3 — Remove parallel authoring across the complete shipped inventory.
- **Proof:** admission, sealed-writer, native-codex, lifecycle,
  headless-qualification, documentation and delivery-review on final shipped bytes.
- **Completion signal:** every owned headless case passes. Lifecycle operations
  preserve selected ownership, leave unselected hosts untouched and avoid
  duplicate authority. Status reports actual guarantees. XHMWSC owns the IDE
  cases and full-set composition. Release and merge remain outside scope.

### Final delivery review

Review every tracked file in the five delivery directories and the headless proof runner named below. The five batch specifications partition the original scope. Before review, compare their union with the tracked inventory for `packages/cli/src/lifecycle`, `packages/cli/src/host-contract`, `packages/cli/src/commands`, `packages/opencode-v2-plugin`, `packages/cli/templates/hooks` and `packages/cli/scripts/run-host-contract-proof.ts`. Each path must occur exactly once. Refresh the affected receipts if the reviewed bytes change. After all five independent approvals, record the receipts and findings in the evidence index and obtain a separate independent review of how the pieces work together.

### Tasks and tests

1. RED: add packages/cli/tests/host-contract/admission.test.ts, invoking the
   actual conformance/status/doctor/completion CLI against real profile/project
   stores. Establish valid fixture captures through the trusted controller;
   mutate seals, target version, runtime, method, package/config/trust identity,
   missing activation, required registration and continuation outcome separately.
   Run admission. Expected failure is a false healthy/completion claim or missing
   bounded recovery; do not substitute validator calls for the public boundary.
   Explicit controls include an OpenCode Desktop request with only current
   CLI/TUI receipts in the real profile store: real status must refuse Desktop
   enforcement while retaining the separate CLI/TUI facts. This is an admission
   negative control, not a new Desktop host experiment. Also corrupt one required
   native Cursor registration in an isolated generated package, let the exact
   IDE reject it, then run actual status: the corresponding guarantee must be
   inactive. The lifecycle/all-hosts runner owns this real-host rejection case;
   admission tests only diagnose its receipt-reading behavior.
2. GREEN: finish the sealed run/attempt and owner-capture schemas, sole writers,
   atomic publication, immutable failure retention and identity-bound readers.
   Derive package conformance declarations from validated originating runs;
   validate full delivery-set payload/identity and declaration integrity through
   existing package trust. Keep controller integrity keys outside host fixtures.
   Test interrupted write, conflicting duplicate ID, identical capture retry,
   foreign-profile import, missing key and failed-then-passing same-target history.
   Bind these integrity cases to sealed-writer: create
   packages/cli/tests/host-contract/evidence-writer.test.ts and the thin child
   driver packages/cli/tests/fixtures/host-contract/evidence-controller.ts.
   Run ../../scripts/dev bun run test tests/host-contract/evidence-writer.test.ts
   from packages/cli. The driver invokes the production trusted controller's
   capture/resume API over an isolated owned profile and authentic run checkpoint;
   it cannot implement sealing, accept arbitrary automated-success JSON or bypass
   observation validation. Set up checkpoints using the actual originating
   conformance/capture controller over synthetic host projects/committed trees.
   This Integration proof exercises controller processes, real locks/files and
   the real sealed writer/reader, not a host behavior claim. Add each failing
   case before its production repair and assert the following exact boundary:

   | Fixture / action                                                                                                                                     | Expected RED defect                                                                                     | Required GREEN result                                                                                                                              |
   | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
   | before-publication: hold the real publication lock, start the controller, observe its wait, terminate it before releasing the lock, then read status | Partial/unsealed state is admitted as evidence                                                          | Child termination is recorded; no published receipt exists; real admission exits 2 for missing evidence and never reports success                  |
   | identical-retry: resume the same owned checkpoint with identical run/input/observation identity twice                                                | Retry creates a different receipt or another authority                                                  | Both controller calls exit 0 and return the identical receipt ID; one immutable record exists                                                      |
   | conflicting-duplicate: resume the same capture ID with a different committed input/observed identity                                                 | Existing receipt is overwritten or conflict accepted                                                    | Controller exits 2 naming conflicting identity; original receipt bytes and admitted meaning remain unchanged                                       |
   | foreign-profile: copy a valid sealed run into another isolated profile without its key                                                               | Foreign receipt satisfies that profile's admission                                                      | Actual status/completion exits 2 for integrity/origin mismatch, no healthy guarantee; no key is copied                                             |
   | missing-key: remove the fixture controller key after valid capture, then read the run                                                                | Reader recreates authority or accepts unsigned evidence                                                 | Admission exits 2 with missing integrity authority, no admitted guarantee and no synthetic passing replacement                                     |
   | failed-then-passed: real target attempt fails, then the same exact target succeeds through the controller                                            | Failure disappears, a different version fills the lane or stale failure blocks current matching success | Both attempts remain immutable, latest same-target success is applicable; different-version success leaves the failed required lane unmet (exit 2) |

   Check controller result fields, record IDs/digests and actual admission exits,
   not merely that a helper returned. The test command exits 0 only when every
   listed assertion passes; setup or driver crashes cannot count as RED evidence.

3. Implement the compositional host-binding plus shared-policy proof admission.
   Through real status, test documented non-default option combinations staying
   active after upgrade without a per-project run; malformed managed bindings
   remain unproved. Required unsupported guarantees use action_required; optional
   absence cannot hide unrelated usable protection. A package assertion cannot
   mint local activation. Add wrong-version, manual-as-automated and failed-run
   substitution rejection plus matching automated positive control.
   Generate exact-current declarations for non-OpenCode deliveries and
   supported options. Same-host upgrades preserve options and require current
   proof plus fresh activation. For OpenCode V2, use the existing npm release:
   build and pack, then match the archived V2 payload digest against passing
   `native-opencode` CLI/TUI evidence. Through the built CLI, run install,
   reinstall/repair, status and uninstall with `--agents=opencode --json`
   in a disposable profile containing user settings and an unrelated plugin.
   Require bundled installation and repair, owned removal, and preservation.
   Verify status before and after native activation. A missing bundled payload,
   changed archive digest, or active status without local proof fails.
   XHMWSC owns the real installed `cursor-project-hooks` current IDE cases. Keep public proof-reader rejection and status diagnostics here.
   Final gate-bearing CLI confirmation (PR 4 owner):
   The historical passing CLI pilot predates the shared authority gate and is
   diagnostic-only. After PR 4 publishes that gate and its lifecycle controller,
   extend `tests/helpers/cursor-cli-write.ts` with the disposable
   `cursor-cli-enrolled-authority` fixture. Use the real controller to enroll the
   exact CLI/runtime/profile/project/package/epoch tuple, then observe the real
   native session-start handshake before the same allowed/denied trials. Do not
   exempt `--plugin-dir` from the shared gate or copy an IDE activation record.
   Add absent/foreign-epoch enrollment and retained-legacy-hook controls: native
   dispatch stays inert without its handshake, legacy protection remains available,
   and exactly one owner produces the decision when native is selected. Assert
   dispatch cardinality and the actual write result. Missing session-start support
   or trust is unavailable (3), never a successful native claim. Run the same
   `native-cursor-cli --require-targets` proof command against the final generated
   gate-bearing package; earlier pre-gate results cannot complete this obligation.
   The CLI result satisfies engineering coverage only, not customer status or
   admission of an IDE/customer binding. PR 4 owns this final confirmation alongside
   its other activation/coexistence proofs; PR 1's safe preliminary delivery does
   not depend on an unmerged successor.

4. Add packages/cli/tests/host-contract/lifecycle.test.ts and perform real
   install/upgrade/repair/uninstall on disposable historical mixed-host projects.
   Use modified/unverifiable/current-collision assets, authored tickets/learnings,
   user hooks, unselected executable sentinels and byte snapshots. Assert the
   selected integration actually works after each operation while the unselected
   host is neither probed nor enrolled. Repeat operations for idempotency.
5. Implement local enrollment and Cursor's session authority handshake under
   project-then-profile locks; retain shared hooks/resources. Use two projects
   sharing a profile, two clones of the same Git repository, separate windows,
   mixed-root workspaces and cache-free cloud-like profiles. XHMWSC proves actual IDE
   guards for native/legacy selection; cache-free cloud-like checks prove only
   regression of the existing project-hook boundary. Crash before/after enrollment,
   registration and handshake; race a sibling edit. Recover to one active owner.
   Missing native readiness must preserve legacy authority.
   Native fixtures have no competing project workflow wrappers. In the two-clone
   legacy fixture, both clones retain tracked static references, even if one
   profile requests native enrollment: native stays ineligible and XHMWSC verifies IDE guidance and guards remain legacy. Separately prove enrollment and recovery on
   the clean native-eligible project. Do not turn one legacy clone native by
   rewriting shared tracked files. Assert actual loaded rule/command markers
   with the resolver unavailable as well as hook dispatch and byte preservation.
   XHMWSC owns the actual Cursor 3.29.9 exhausted-cap fixture and upgraded IDE
   observations. Keep their full prior proof requirements from `eaca26a3a`.
   The Claude and Codex caps and CLI authority handshake remain here.
6. Keep Claude/Codex's existing per-event live-proof contraction intact.
   Codex shipping is owned here: before changing its generated production bundle,
   add a RED that installs the actual packages/cli/codex-plugin carrier through
   the real packaged lifecycle in a fresh Codex 0.167.0 profile. It must fail if
   only the pilot consumes the shared renderer, if the shipped package registers
   a separate content owner, or if a root-only package is selected for required
   hook guarantees. Put this case in
   packages/cli/tests/smoke/host-contract.live.test.ts, selector
   codex-shipped-carrier, fixture codex-shipped-candidate (isolated fresh profile,
   actual generated marketplace/package carrier and synthetic project).
   Run native-codex:
   scripts/dev bun packages/cli/scripts/run-host-contract-proof.ts --proof native-codex --require-targets.
   At PR 4 the runner requires this shipped-carrier case, checks its completed
   case ID and refuses a pilot-origin receipt. RED must exit 2 with
   SHIPPED_SHARED_CONTENT_MISSING when only the pilot consumes the shared graph,
   DUPLICATE_CONTENT_OWNER when shipped content still has competing owners, or
   NATIVE_HOOK_DELIVERY_MISSING when root-only delivery suppresses required hooks. Host setup errors
   are unavailable, never these REDs. GREEN exits 0 only after the actual host
   reports shipped package-origin catalogue/resources, native compatibility
   hook discovery, current
   activation/trust and genuine allowed/denied action outcomes tied to the shipped
   payload digest. The same case runs inside final all-hosts.
   Then GREEN: change generate:codex-plugin and the shared
   content renderer to derive the one Codex native compatibility carrier from
   canonical skill/resource assets. Do not emit a root manifest into its selected
   0.167.0 enforcement package remains the accepted native container. Current root-format hook behavior is Q-Codex-root, not a suppression fact inferred from old loaders; switching that carrier requires fresh normal approach review.
   Keep root-format capability generation separately explicit and resource-only.
   Wire the selected carrier into check-generated-surfaces in dependency
   order. Preserve native plugin identity/version synchronization and required
   bundled runtime/template closure; no hand-edited generated assets.
   Reinstall that generated, actually distributable package via the real Codex
   marketplace/profile flow in the isolated test profile; perform required
   trust and restart, observe current per-event activation and prove native
   resource/guard behavior. Completion means Codex and Cursor reference the
   same canonical content-graph identity, each with its own generated payload
   digest, and neither has a second skills owner. From this step onward native-codex, all-hosts, propagation and acceptance
   load the final shipped carrier for enforcement and selected-delivery claims;
   the separately labeled portable capability case cannot satisfy those claims. Receipts bind
   its current packaged identity; stale pilot passes cannot satisfy final work.
   Preserve user-owned profile configuration during V2 activation; do not restore retired V1 resources. Test controlled downgrade
   through the current controller, workspace restart and older package, plus
   native invalidation after an old reconciler replaces the bridge identity.
   Preserve newer failed evidence; concurrent unsupported old writers cannot
   receive a healthy claim.
7. RED/GREEN for final selection and routine recovery: add the following named
   cases to admission.test.ts and lifecycle.test.ts. Each fixture uses real
   project/profile files and controller-produced receipts. Each command is the
   built CLI with --cwd pointing at that isolated fixture; no internal selector
   or injected policy-result call substitutes for it. Run admission with
   ../../scripts/dev bun run test tests/host-contract/admission.test.ts from
   packages/cli; run lifecycle through the required lifecycle runner (which
   executes lifecycle.test.ts then actual installed-host post-operation cases).
   First observe the listed RED assertion, implement only its missing behavior,
   then rerun for the GREEN assertion. An already passing existing behavior is
   characterization, not an invented failure.

   | Case and fixture                                                                                            | File / proof                  | Actual command or actor                                                   | RED failure / GREEN assertion                                                                                                                                                                         |
   | ----------------------------------------------------------------------------------------------------------- | ----------------------------- | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
   | Strongest verified mechanism; legacy-first-discovery with both verified native and compatibility candidates | admission.test.ts / admission | status --json --no-input                                                  | RED chooses discovery-first mechanism or omits selected guarantee; GREEN exits 0 and names the higher-ranked verified native candidate, one active owner                                              |
   | Permitted weaker alternative; preferred-unavailable-permitted-observation                                   | admission.test.ts / admission | status --json --no-input                                                  | RED claims denial or refuses a centrally permitted usable alternative; GREEN exits 0 for the satisfied requirement and reports only observation, its proof and limitation                             |
   | Unauthorized weaker fallback; same candidates without shared-policy permission                              | admission.test.ts / admission | status --json --no-input                                                  | RED accepts adapter-invented fallback; GREEN exits 2 with unmet guarantee and no stronger claim. The PR 3 mutation check separately rejects the adapter-local owner                                   |
   | Routine adaptation; selected-host-ready with complete current package/activation proof                      | lifecycle.test.ts / lifecycle | install --json --no-input, then actual selected-host guard action         | RED requests a host/packaging design choice or fails usable selected delivery; GREEN exits 0 with no requires-human packaging action and the genuine allowed/denied controls pass without a host list |
   | Routine reevaluation; unchanged permitted-alternative identity                                              | admission.test.ts / admission | status --no-input twice, then status --json --verbose                     | RED repeats the same limitation notice; GREEN emits at most the initial transition notice and still exposes the actual alternative/limit in on-demand details                                         |
   | Technical proof on demand; active-verified selected host                                                    | admission.test.ts / admission | status --json --verbose --no-input                                        | RED omits or misattributes technical proof; GREEN exits 0 with actual mechanism, guarantee, method and matching host/package/configuration identities                                                 |
   | Trust-dependent repair; installed-but-untrusted selected profile                                            | lifecycle.test.ts / lifecycle | install --json --no-input                                                 | RED changes user trust or reports active; GREEN exits 2 with the exact supported requires-human trust/restart action and byte-identical trust values                                                  |
   | Impossible required guarantee; selected lane has no verified satisfying mechanism or permitted alternative  | admission.test.ts / admission | status --json --no-input and doctor --json --no-input                     | RED silently weakens or claims success; GREEN exits 2, names the requirement/host limit and concrete supported recovery rather than asking for technical redesign                                     |
   | Recoverable repair; missing proven-owned helper with otherwise valid selected package/trust                 | lifecycle.test.ts / lifecycle | install --json --no-input, then actual host invokes restored helper/guard | RED asks a design choice, clobbers user content or leaves the helper unusable; GREEN exits 0 after safe restoration, actual host controls pass and unrelated files/selection remain unchanged         |

   Finish central ranking, truthful alternatives, notice identity/deduplication
   and existing-command repair to satisfy these cases. Preserve Product and
   required guarantees. Real host actors belong to lifecycle; admission-only
   fixtures cannot supply their host evidence.

8. Wire repository-boundaries, generated-surface checks and lane-derived
   conformance admission into existing CI/CLI-contract gates. Run actual check
   processes on mutation trees; require originating exact-target results for the
   producing commit. Other jobs consume commit-bound checks, never foreign local
   receipt keys. Required unavailable/manual-only lanes stay incomplete.
For PR 4 tasks 9 and 11 and per-slice step 6, 2ENRH5 requires
`headless-qualification` against the exact headless case inventory. XHMWSC owns
the full acceptance, all-hosts and complete 70-definition/103-example results.
Do not clear the full feature's `@wip` from headless evidence.

9. Finish steps/consistent-host-contract.steps.ts using the approved fixtures
   and actual entrypoints; map every exact scenario name and each outline row.
   Keep host-required cases bound to genuine host evidence, never a simulated
   payload. First run the test-owned configuration over the entire in-progress
   feature, asserting the complete expected set. Once all corresponding cases
   pass, remove their @wip tags, then record acceptance through the required
   runner wrapping the ordinary root acceptance command. Parse Cucumber's JSON
   result and compare executed URI/scenario/example-row identities against all
   pickles compiled independently from the approved source: exactly 70 scenario
   definitions and 103 expanded examples, all passed. Zero/filtered/duplicate or
   omitted cases, undefined/pending/skipped steps and subprocess failures are
   nonzero even if Cucumber itself exits 0. A remaining @wip filter cannot clear
   this proof. Do not mark the R/G/R ledger from checklist status or inspection.
10. Update README.md and configured website quick-start, configuration,
    hooks-and-skills and CLI documentation. Update AGENTS.md contributor guidance for the
    canonical schema/owner/disposition path and required checks. Explain retained
    compatibility resources, exact host/runtime guarantees, selection, trust,
    restart, controlled rollback and actual status without asking users to choose
    packaging. Mark the Registry architecture decision partially superseded only
    when the proved Cursor path is implemented; keep proposed facts labelled.
    Before the documentation proof, update .project/surfaces.md: distinguish
    Codex's resource-only portable capability fixture from selected shipped
    compatibility delivery, and describe automatic Cursor legacy selection when
    existing project registrations prevent exclusive native activation. Then run
    the documentation review against these final inventory and guidance bytes.
11. REFACTOR: remove redundant status/host lists and duplicate warning logic.
    Rerun affected proof groups after changes. Run repository-current, owner-current,
    propagation, native-codex,
    sealed-writer and all-hosts on final shipped identities, plus the composition
    demo (canonical policy change, complete coverage, stale-output rejection and
    impossible-guarantee recovery), then acceptance and per-slice verification.
    Review final behavior and docs independently. No feature completion if any
    required host result, owner delta or contributor item is missing.

## Per-slice verification and execution discipline

Run from the repository root through scripts/dev. Never run two Vitest processes.

1. After template or mirror edits, run scripts/dev bun packages/cli/scripts/check-generated-surfaces.ts --fix.
   The historical catalogue precedes Claude/Codex bundles, Cursor wrappers may
   change templates, lifecycle-origin fixtures run last. Inspect changed fixture
   result hashes as behavior, not automatic drift. Include the new core/Cursor/V2
   generators in this coordinator without making an ordering cycle.
2. For mirrors use existing project-only scripts/dev bun scripts/parity-check.ts --fix. Do not publicly install/enroll/replace original302 or the author's development plugin.
3. Run scripts/dev bun packages/cli/scripts/check-generated-surfaces.ts and
   scripts/dev bun scripts/parity-check.ts --mode=all.
4. Run each slice's targeted proofs sequentially, then scripts/dev bun run typecheck,
   scripts/dev bun run lint and scripts/dev bun run build.
5. Root runs the full package suite on the reviewed final candidate for final verification:
   ../../scripts/dev bun run test from packages/cli. Re-run only on changes or
   failures. Review final native/package identities after regeneration; earlier
   proof cannot certify changed payloads without valid current proof.
6. At PR 4, run acceptance through the required runner (which executes
   scripts/dev bun run test:bdd:acceptance features/consistent-host-contract.feature
   and validates all 70 definitions /103 examples) and run all-hosts. Record exact commands, revisions, seals and
   outcomes through the Delivery Checklist/verification paths, not prose claims.

Required host runner group wiring is explicit:
native-cursor-cli dispatches cucumber.native-cursor-cli.mjs, with cursor-cli-write
and a catalogue CLI actor in steps/consistent-host-contract.steps.ts for the
three exact case IDs in PR 1 task 3. All-hosts includes those three IDs in
addition to every retained IDE and other host ID. The initial paired write pilot
returns incomplete until the catalogue case is wired; a passing pair alone is
not native-cursor-cli completion.
coexistence runs opencode-coexistence.test.ts for real lifecycle/JSONC checks and
then the actual V2 CLI/TUI selected/unselected-project isolation cases in host-contract.live.test.ts;
Lifecycle runs lifecycle.test.ts for CLI/filesystem mutation and actual non-IDE process cases. XHMWSC owns the IDE post-operation cases. Native groups
run their exact row selectors there and the thin Cucumber actor where applicable;
propagation additionally runs propagation.live.test.ts. All-hosts enumerates all
required lane/case IDs across those groups. Required mode compares completed IDs
against the independent expected set, rejects zero tests, undefined steps,
conditional skips or omitted rows, and fails on any subprocess failure. A file
present on disk but never dispatched cannot satisfy its group.

The runner returns nonzero with named unavailable prerequisites,
failed native boundaries or incomplete required lanes. It does not pass via
conditional Vitest skips. It creates only synthetic fixture state, retains bounded
diagnostic digests on failure and removes only its own disposable processes/files.
Manual mode is explicitly labelled and cannot clear automated proof IDs.

## Obligation ownership

| Accepted obligation                                                                                                               | Owning PRs             |
| --------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| Headless propagation, qualification runner and native results | PR 3 owns propagation; PR 4 owns final qualification; XHMWSC owns actual IDE lifecycle and full composition |
| Unattended headless propagation | PR 3 Task6 owns the staged source controls and live diagnostic. Separate native trust proof retains its PR 3 owner. |
| Outstanding closeout gates | PR 4 branch owner reconciles the final audit and historical ordinary-request executable-RED ledger. A scope or risk exception needs user authorization. |
| Current-only target retirement, exact current independent required-set oracle and preserved in-scope config/guard controls | PR 1 |
| Shared architecture prerequisite/review owner, thin supported Stop calls, per-lane strengths and Q-author-origin | PR 3 Task6 repair; completion is shared-owner source proof plus applicable current native settings and truthful unmet dispositions |
| Cursor current-turn handoff eligibility and preserved marker consumers | PR 3 Task6; cursor-handoff-generation proof passes the frozen reviewed RED/GREEN command and focused regressions; propagation separately qualifies both actual IDE deliveries |
| Disposable Codex behavior automation and informational rollout decoding | PR 3 Task6; parser/actor/staged-input review proofs, exact pending assertion approval, diagnostic full-ten group and separate codex-normal-trust-invalidation proof must complete; no activation/admission inference |
| Portable components independently loaded on current Codex, Cursor CLI AND Cursor IDE | PR 1, PR 4 |
| PR 2 local originating capture/read and both required/optional native registration-to-status scenarios                            | PR 2, PR 4             |
| Conditional process preparation correlates only with actual zero completion and unchanged current review authority                | PR 3                   |
| Covered paired-control endpoint representatives and unchanged real-collaborator contrast                                          | PR 3                   |
| Quote/escape-aware literal grouping in the existing resource reader preserves every old rejection                                 | PR 3                   |
| Committed checked-cd request delivery preserves strict observer rejection                                                         | PR 3                   |
| Isolated literal-argv review observation with all current authority preserved and fenced unchanged allowed-write request          | PR 3                   |
| Normal Claude observed-model reporting and compact testing payload with preserved required blocks and referenced examples         | PR 3                   |
| Shared testing Wiring Tests navigation through each installed render owner, with unchanged essential core and optional examples | PR 3; testing-wiring-navigation source proof, followed by separately qualified native delivery |
| Mixed current review call with literal bound cwd | PR 3 Task6; codex-mixed-review-correlation and separate native qualification |
| Per-prompt normal trust review window | PR 3 Task6; source author owns codex-normal-trust-window regression and ROOT owns launcher consumption plus separate genuine trust qualification |
| Retained settings join | PR 3 Task6; source author owns source-only controller join and ROOT owns actual native qualification |
| Codex retained continuation diagnostic | PR 3 Task6; source proof only; native continuation and the other supported lanes remain separate |
| Claude retained continuation diagnostic | PR 3 Task6; source proof only; native qualification and other lanes remain separate |
| Cursor retained continuation diagnostic | PR 3 Task6; source proof only; native qualification and exhausted-cap proof remain separate |
| Exact early bound cwd before literal preparation for current review status | PR 3; codex-early-status-correlation, with current signed status and whole raw/SDK authority preserved |
| Isolated Codex model-turn timeout correction | PR 3 Task6; codex-isolated-model-budget source proof and separate current native diagnostic |
| Automatic bounded essential delivery, installed owner validation, startup budgets and actual current developer-context proof      | PR 3                   |
| All ten Rules and every scenario below                                                                                            | PR 1, PR 2, PR 3, PR 4 |
| Two small registry/schema contracts, one content/policy owner, complete inventory including extra lifecycle facets                | PR 1, PR 3             |
| Direct portable core, Codex extension precedence, thin native Cursor extension and executable resource closure                    | PR 1, PR 3             |
| Isolated Promise SDK V2, fresh worker-context/tool constraints, V2 CLI/TUI separation and V1 retirement and full dependency audit | PR 2                   |
| Shared-policy propagation, shared-skill propagation, independent completeness and mutation controls                               | PR 3                   |
| Before/after committed owner graph, removed independent edit paths and reproducible derived outputs                               | PR 3                   |
| Sealed activation/conformance/owner writers, exact identity, failed-attempt retention and immutable release declarations          | PR 1, PR 2, PR 3, PR 4 |
| Supported option composition, native guarantee ranking and truthful active/alternative/unmet/recovery status                      | PR 3, PR 4             |
| Local enrollment, shared tracked compatibility, multi-project/clone/root/profile isolation and legacy cloud-boundary preservation | PR 1, PR 2, PR 4       |
| Locks, stale plans, atomic publication, crash recovery, controlled downgrade, no user-data clobber and reference-aware uninstall  | PR 4                   |
| Maintainer single-authoring, TBU evidence/trust/controls, NTB invisible routine flow and bounded recovery                         | PR 3, PR 4             |
| Claude, Codex, Cursor, OpenCode and Agent Plugins 1.0 affected surfaces; CLI status/lifecycle and normal derivation               | PR 1, PR 2, PR 3, PR 4 |
| No invented percent/time saving; exact full inventory/lane population and one-authoritative-edit evidence                         | PR 3, PR 4             |
| README/website/contributor docs, architecture status and required CI checks                                                       | PR 4                   |
| Final actual-host demo, all accepted cases, current verification and independent delivery review                                  | PR 4                   |

### Exact scenario ownership

Every row below preserves its impl-plan.md proof strategy. Host rows require the
named native proof groups plus final all-hosts; repository and admission rows use
their real CLI/process boundaries. Outline examples retain every approved row.

| Scenario                                                                              | Owning PRs                                                                      |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| An ordinary request discovers an eligible internal workflow                           | PR 3                                                                            |
| A restarted session receives current essential workflow instructions                  | PR 3                                                                            |
| Internal selector entries are hidden while public controls remain offered             | PR 3                                                                            |
| A manual workflow remains explicitly usable without automatic invocation              | PR 3                                                                            |
| A public workflow follows its existing internal resource reference                    | PR 3                                                                            |
| Public review distinguishes missing real-collaborator coverage from a covered control | PR 3 — authenticated paired review proof; both judgments and all After required |
| Reading an internal procedure cannot authorize a denied write                         | PR 3                                                                            |
| Reading an internal procedure preserves permitted work                                | PR 3                                                                            |
| Internal references resolve their complete installed resource closure                 | PR 3                                                                            |
| Missing internal resources prevent a clean generated-delivery check                   | PR 3                                                                            |
| One shared policy change reaches every applicable agent                               | PR 3                                                                            |
| One shared skill change reaches every applicable agent                                | PR 3                                                                            |
| A partially propagated revision cannot satisfy the shared change                      | PR 3, PR 4 (final admission)                                                    |
| An interface that leaves parallel policy ownership does not count as consolidation    | PR 3                                                                            |
| Completed consolidation identifies removed maintenance paths                          | PR 3                                                                            |
| Coverage includes every supported host without an author checklist                    | PR 3                                                                            |
| A missing host disposition prevents completion                                        | PR 3                                                                            |
| A newly shipped component cannot disappear from coverage                              | PR 3                                                                            |
| The inventory includes handlers beyond the five common events                         | PR 3                                                                            |
| An explicit limitation cannot replace proof of a required guarantee                   | PR 3, PR 4 (final admission)                                                    |
| A proved OpenCode V2 CLI lane cannot cover an unproved TUI lane                       | PR 3, PR 4 (final admission)                                                    |
| New host capability cannot introduce a second shared policy owner                     | PR 3                                                                            |
| New host capability extends mechanics while preserving shared policy                  | PR 3                                                                            |
| A stale generated host output fails the required check                                | PR 3                                                                            |
| Refreshing required outputs restores agreement                                        | PR 3                                                                            |
| A host route cannot evade a shared denial                                             | PR 3                                                                            |
| A route applying the shared decision passes boundary validation                       | PR 3                                                                            |
| Independent host policy cannot become another authority                               | PR 3                                                                            |
| A package declaration cannot substitute for runtime proof                             | PR 4                                                                            |
| Evidence from a different host version cannot satisfy the required target             | PR 4                                                                            |
| Manual host observation cannot count as an automated check                            | PR 4                                                                            |
| Failed required target execution cannot be replaced silently                          | PR 4                                                                            |
| Applicable automated target evidence satisfies the plugin claim                       | PR 4                                                                            |
| The strongest verified satisfying mechanism is selected                               | PR 3, PR 4                                                                      |
| A permitted weaker alternative reports its actual guarantee                           | PR 3, PR 4                                                                      |
| An adapter cannot invent a weaker fallback                                            | PR 3, PR 4                                                                      |
| A denied action has no side effect                                                    | PR 1, PR 2, PR 3, PR 4                                                          |
| An allowed action reaches the side-effect boundary                                    | PR 1, PR 2, PR 3, PR 4                                                          |
| Ticket rejection cannot masquerade as conversation continuation                       | PR 1, PR 2, PR 3, PR 4                                                          |
| Conversation continuation cannot masquerade as ticket-transition enforcement          | PR 1, PR 2, PR 3, PR 4                                                          |
| A supported completion guard actually continues the conversation                      | PR 1, PR 2, PR 3, PR 4                                                          |
| Applicable activation and conformance evidence reports protection active              | PR 4                                                                            |
| Unavailable activation cannot inherit a healthy claim                                 | PR 4                                                                            |
| Invalidated evidence cannot retain the previous protection claim                      | PR 4                                                                            |
| An unlisted OpenCode version receives actionable recovery                            | PR 4 (admission)                                                                |
| A rejected required registration invalidates its guarantee                            | PR 2, PR 4                                                                      |
| An optional registration failure does not conceal unrelated usable protection         | PR 2, PR 4                                                                      |
| Exhausted continuation cannot be advertised as unlimited enforcement                  | PR 4                                                                            |
| OpenCode Desktop cannot inherit CLI or TUI enforcement proof                          | PR 4                                                                            |
| Routine adaptation needs no packaging or host checklist decisions                     | PR 4                                                                            |
| Routine reevaluation does not repeat limitation warnings                              | PR 4                                                                            |
| Technical proof remains available on demand                                           | PR 4                                                                            |
| A repair requiring user trust does not silently bypass authorization                  | PR 4                                                                            |
| An impossible required guarantee produces actionable recovery                         | PR 4                                                                            |
| Recoverable integration failure is repaired without asking for design choices         | PR 4                                                                            |
| A host limitation cannot lower a requirement silently                                 | PR 4                                                                            |
| A host loads bundled content without an unnecessary generated copy                    | PR 1, PR 2, PR 3                                                                |
| Necessary format translation preserves canonical content                              | PR 1, PR 2, PR 3                                                                |
| Native delivery exposes the contracted catalogue                                      | PR 1, PR 2, PR 3                                                                |
| Portable package loading proves only its portable components                          | PR 1, PR 2, PR 3                                                                |
| Duplicate native and compatibility registration is rejected                           | PR 1, PR 2, PR 4                                                                |
| Upgrading a mixed-host project preserves authored work                                | PR 4                                                                            |
| Unproven legacy ownership cannot authorize deletion                                   | PR 4                                                                            |
| A current asset cannot be retired by a legacy cleanup collision                       | PR 4                                                                            |
| Repeating completed installation creates no additional authority                      | PR 4                                                                            |
| Interrupted migration recovers without activating two authorities                     | PR 4                                                                            |
| Uninstalling one host preserves another host's shared resources                       | PR 4                                                                            |
| Unselected hosts are not probed or enrolled                                           | PR 4                                                                            |

## Deferred scope ownership

- skip: no accepted obligation is deferred. Upstream API changes, new Cloud or
  OpenCode Desktop enforcement, unrelated workflow/preset changes, public release,
  merging and destructive project-wide compatibility retirement remain excluded
  by this ticket. No other ticket is used as completion evidence.

## Decision accounting

| Recorded Decision in impl-plan.md | Status |
| --- | --- |
| Unattended headless propagation | unchanged; PR 3 staged source controls and actual diagnostic, with separate normal native trust |
| Current-only target support | unchanged; current-target prerequisite |
| OpenCode retarget | unchanged; PR 1 pin and oracle, PR 2 native catalogue and effects, PR 3 settings and PR 4 qualification/status |
| Shared authority and host adaptation | unchanged; PR1/2 native, PR3 graph/propagation, PR4 admission |
| Native and portable packaging | unchanged; current distinct native/project/portable proofs |
| Evidence and status | unchanged; existing owners and local activation |
| Standard OpenCode release and installation | unchanged; PR 4: verify exact CLI/TUI-tested payload in release; reconcile bundled install/repair/removal through lifecycle; require local activation for active status |
| Shared architecture-gate owner and lane disposition (2026-11-11) | unchanged; PR 3 Task6, Next bounded repair steps1–7 and architecture-owner/propagation proofs |
| Narrow DOMPurify/Zod security update (2026-11-11) | unchanged; PR 2 dependency/security obligation, retained approved security sequence steps1–5; no further dependency changes |
| Cursor handoff current-turn eligibility (2026-11-12) | unchanged; PR 3 Task6, bounded generation-eligibility sequence steps1–6, exact fixture approval and separate current native/project-hook qualification |
| Disposable Codex behavior automation (2026-11-14) | unchanged relative to the current accepted two-review Implementation Plan: exactly two derived normal staged-review bindings and approved fixture cardinality. Historical comparison only: that accepted approach superseded single-record6338 wording. Next bounded two-review steps1–5 preserve complete scope, observed controls and separate GREEN budgets. Parser/preservation semantics, default trust, diagnostic ten cases, seven deliveries and separate normal qualification unchanged; no admission substitution |
| Static-resource preservation correction (2026-11-18) | unchanged; three reviewed source checkpoints completed, with native qualification separate |
| Shared testing navigation correction (2026-11-18) | unchanged; PR 3 testing-wiring-navigation proof, with core rules, optional-example ownership and full-resource proof preserved |
| Mixed current review call (2026-11-18) | unchanged; PR 3 Task6 codex-mixed-review-correlation plus separate native qualification |
| Current review correlation repair (2026-11-18) | unchanged; PR 3 codex-early-status-correlation proof, with no partial-output or inferred child-success authority |
| Isolated model-turn budget (2026-11-18) | unchanged; PR 3 codex-isolated-model-budget proof, with normal and outer deadlines preserved |
| Normal trust review window (2026-11-19) | unchanged; PR 3 Task6 codex-normal-trust-window proof; fresh A/B 300,000 ms announcement windows without renewal, generic/outer deadlines preserved |
| Retained settings join (2026-11-19) | unchanged; PR 3 Task6 helper then controller proofs, full native/cap join separate |
| Codex retained continuation | retained settings decision unchanged; source-only diagnostic, native/cap/full propagation separate |
| Claude retained continuation | retained settings decision unchanged; source-only diagnostic, native/cap/full propagation separate |
| Cursor retained continuation | retained settings decision unchanged; source-only diagnostic, native/exhausted-cap/full propagation separate |

Historical invocation mechanism tasks are retained in [prior exact evidence](evidence/current-host-only-history/f5aaf53a4ef1ecc62e7674929971c6820453b5a30f3ce0b1bdc4ecd762eabf51.stdout); all ten current TBU2.R3 cases still require their named actual boundaries through native-codex-internal-workflows, startup/wiring/calibration support and complete current Gherkin discovery. No filtered/old trial fills the population. Retain canonical invocation flags, containing-asset resource read, mandatory Wiring, bounded essential startup and actual review provenance. Root normally provisions dedicated current profiles and native hook trust; no copied trust/controller key or original302 fixture. Every proof runs sequentially; a missing observation stays unavailable.

Current-target prerequisite test boundary: extend existing `tests/host-contract/target-version.test.ts` and public-check controls in `tests/host-contract/repository-boundaries.test.ts`, not a parallel target registry. Invoke actual required-runner discovery in a private fixture with existing public entrypoint; assertions reject an active retired row, missing/extra/duplicate current target/runtime/delivery, wrong source selection and stale generated projection, then repair. Preserve all existing in-scope guard assertions. Run those two files through the normal build-lock wrapper before dependent native qualification. Native package/config/trust/origin effects remain the separate root-only proof groups below.

**PR 4 headless runs.** Extend the PR 3 diagnostic and add `headless-qualification` to the existing proof
runner. Add `tests/host-contract/headless-qualification.test.ts` at the real CLI
boundary. A valid five-lane fixture map must fail at
`HEADLESS_QUALIFICATION_MISSING` before the entry exists. The independent oracle
expects pinned native Claude CLI, Codex CLI, Cursor CLI, OpenCode CLI and
OpenCode TUI. Require every feature case except the IDE portions assigned to
XHMWSC in the qualification ledgers. The Cursor IDE portable observation is
one of the assigned IDE portions; Codex and Cursor CLI portable observations
remain required here.
Reject missing, extra, foreign, failed or skipped rows and compare completed
case IDs to the independent expected list.

Reuse retained actors for policy-only and resource-only changes, stale lane and
repair. Require every applicable catalogue, allow/deny, portable, continuation,
settings and the current architecture receipt controls described above. For the
Claude and Codex exhausted-cap cases, reuse their continuation actors to observe
unmet verification, cap reached and no extra response, then prove that public
status/completion reports the bound. Source tests do not substitute for live
evidence. Keep the full-set proof commands, required population and admission
refusal. Record actual headless evidence against the final bytes before marking
its checklist rows complete.

## Proof specifications

| Proof ID                        | Method         | Scope       | Boundary exercised                                                                                                                                                                                                                                                                                                                                                      | Qualifies as          | Currency         | Invocation                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------------------------------- | -------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| codex-mixed-review-correlation | command | integration | Exact mixed native cell and bound cwd preserve signed review and whole call correlation | real_boundary | current_required | {"type":"command","cwd":"packages/cli","argv":["env","SAFEWORD_TEST_LOCK_MAX_WAIT_MS=1800000","../../scripts/dev","bun","run","test","tests/host-contract/codex-mixed-review-correlation.test.ts","tests/host-contract/codex-review-receipt.test.ts","tests/host-contract/codex-review-api.test.ts","tests/host-contract/codex-early-status-correlation.test.ts"]} |
| codex-early-status-correlation | command | integration | Exact bound early cwd with literal preparation and real current receipt retains unique whole raw/SDK correlation | real_boundary | current_required | {"type":"command","cwd":"packages/cli","argv":["env","SAFEWORD_TEST_LOCK_MAX_WAIT_MS=1800000","../../scripts/dev","bun","run","test","tests/host-contract/codex-early-status-correlation.test.ts","tests/host-contract/codex-review-receipt.test.ts","tests/host-contract/codex-review-api.test.ts"]} |
| codex-isolated-model-budget | command | integration | Real actor dispatch and spawn boundary distinguish isolated model-turn timeout from normal and non-model commands with fake external edges | real_boundary | current_required | {"type":"command","cwd":"packages/cli","argv":["env","-u","GIT_DIR","-u","GIT_WORK_TREE","-u","GIT_INDEX_FILE","-u","CLAUDE_PROJECT_DIR","SAFEWORD_TEST_LOCK_MAX_WAIT_MS=1800000","../../scripts/dev","bun","run","test","tests/host-contract/codex-isolated-model-budget.test.ts","tests/host-contract/codex-isolated-consumer.test.ts","tests/host-contract/codex-workflow-runtime-harness.test.ts"]} |
| testing-wiring-navigation | command | integration | Canonical section and real Codex, Claude, portable and project render owners resolve the essential anchor and optional guide examples without changing core | real_boundary | current_required | {"type":"command","cwd":"packages/cli","argv":["env","-u","GIT_DIR","-u","GIT_WORK_TREE","-u","GIT_INDEX_FILE","-u","CLAUDE_PROJECT_DIR","SAFEWORD_TEST_LOCK_MAX_WAIT_MS=1800000","../../scripts/dev","bun","run","test","tests/host-contract/testing-wiring-navigation.test.ts","tests/host-contract/testing-procedure-delivery.test.ts"]} |
| codex-fixture-corrections | command | integration | Real picker driver and runtime actor exercise owned-folder approval and the two resource-only preservation boundaries with external native CLI/inventory faked; the grader controls also exercise the exact isolated branch | real_boundary | current_required | {"type":"command","cwd":"packages/cli","argv":["env","-u","GIT_DIR","-u","GIT_WORK_TREE","-u","GIT_INDEX_FILE","-u","CLAUDE_PROJECT_DIR","SAFEWORD_TEST_LOCK_MAX_WAIT_MS=1800000","../../scripts/dev","bun","run","test","tests/host-contract/codex-native-fixture-corrections.test.ts","tests/host-contract/codex-isolated-picker.test.ts","tests/host-contract/codex-isolated-consumer.test.ts","tests/host-contract/codex-workflow-runtime-harness.test.ts","tests/host-contract/codex-static-preservation-grader.test.ts"]} |
| propagation-retained-settings-helper | command | integration | Existing settings graders and retained actors; external observations substituted | real_boundary | current_required | {"type":"command","cwd":"packages/cli","argv":["env","-u","GIT_DIR","-u","GIT_WORK_TREE","-u","GIT_INDEX_FILE","-u","CLAUDE_PROJECT_DIR","SAFEWORD_TEST_LOCK_MAX_WAIT_MS=1800000","../../scripts/dev","bun","run","test","tests/host-contract/propagation-retained-settings-helper.test.ts","tests/host-contract/propagation-settings-oracle.test.ts","tests/host-contract/propagation-design-settings.test.ts","tests/host-contract/propagation-handoff-settings.test.ts"]} |
| propagation-retained-settings-join | command | integration | Existing retained controller, capture and settings graders with external host observations substituted; source diagnostic only | real_boundary | current_required | {"type":"command","cwd":"packages/cli","argv":["env","-u","GIT_DIR","-u","GIT_WORK_TREE","-u","GIT_INDEX_FILE","-u","CLAUDE_PROJECT_DIR","SAFEWORD_TEST_LOCK_MAX_WAIT_MS=1800000","../../scripts/dev","bun","run","test","tests/host-contract/propagation-retained-settings-join.test.ts","tests/host-contract/propagation-native-join.test.ts","tests/host-contract/propagation-settings-oracle.test.ts","tests/host-contract/propagation-design-settings.test.ts","tests/host-contract/propagation-handoff-settings.test.ts","tests/host-contract/propagation-cursor-architecture.test.ts"]} |
| codex-retained-continuation | command | integration | Retained Codex actor and raw capture with only external host substituted | real_boundary | current_required | {"type":"command","cwd":"packages/cli","argv":["env","-u","GIT_DIR","-u","GIT_WORK_TREE","-u","GIT_INDEX_FILE","-u","CLAUDE_PROJECT_DIR","SAFEWORD_TEST_LOCK_MAX_WAIT_MS=1800000","../../scripts/dev","bun","run","test","tests/host-contract/codex-retained-continuation.test.ts","tests/host-contract/codex-continuation-response.test.ts","tests/host-contract/propagation-retained-settings-join.test.ts","tests/host-contract/propagation-native-join.test.ts"]} |
| claude-retained-continuation | command | integration | Retained Claude actor and raw capture with external host substituted | real_boundary | current_required | {"type":"command","cwd":"packages/cli","argv":["env","-u","GIT_DIR","-u","GIT_WORK_TREE","-u","GIT_INDEX_FILE","-u","CLAUDE_PROJECT_DIR","SAFEWORD_TEST_LOCK_MAX_WAIT_MS=1800000","../../scripts/dev","bun","run","test","tests/host-contract/claude-retained-continuation.test.ts","tests/host-contract/propagation-claude-policy.test.ts","tests/host-contract/propagation-retained-settings-join.test.ts","tests/host-contract/propagation-native-join.test.ts"]} |
| cursor-retained-continuation | command | integration | Both retained Cursor IDE actors and raw capture with external host substituted | real_boundary | current_required | {"type":"command","cwd":"packages/cli","argv":["env","-u","GIT_DIR","-u","GIT_WORK_TREE","-u","GIT_INDEX_FILE","-u","CLAUDE_PROJECT_DIR","SAFEWORD_TEST_LOCK_MAX_WAIT_MS=1800000","../../scripts/dev","bun","run","test","tests/host-contract/cursor-retained-continuation.test.ts","tests/host-contract/propagation-cursor-architecture.test.ts","tests/host-contract/propagation-cursor-handoff.test.ts","tests/host-contract/propagation-retained-settings-join.test.ts","tests/host-contract/propagation-native-join.test.ts"]} |
| codex-normal-trust-window | command | integration | Real readiness and actor boundary, external inventory/clock fake; fresh A/B announcement windows, fixed polling deadline, generic deadline preserved; source-only | real_boundary | current_required | {"type":"command","cwd":"packages/cli","argv":["env","-u","GIT_DIR","-u","GIT_WORK_TREE","-u","GIT_INDEX_FILE","-u","CLAUDE_PROJECT_DIR","SAFEWORD_TEST_LOCK_MAX_WAIT_MS=1800000","../../scripts/dev","bun","run","test","tests/host-contract/codex-normal-trust-window.test.ts","tests/host-contract/codex-fresh-trust-preparation.test.ts","tests/host-contract/codex-normal-trust-fingerprint.test.ts"]} |
| codex-normal-trust-invalidation | command | E2E | Existing normal restart actor with normalTrustQualification fixture requires observed untrusted refusal then genuine human-reviewed trusted callback A and changed-script B, plus restoration; bypass forbidden and absence unavailable | real_boundary | current_required | {"type":"command","cwd":".","argv":["scripts/dev","bun","packages/cli/scripts/check-codex-internal-workflows.ts","--case","a-restarted-session-receives-current-essential-workflow-instructions","--require-targets"]} |
| codex-informational-rollout | command | integration | Actual declaration decoding earns zero call/read/control evidence; strict malformed and unknown protocol controls plus unchanged read/essential/process regressions | real_boundary | current_required | {"type":"command","cwd":"packages/cli","argv":["env","-u","GIT_DIR","-u","GIT_WORK_TREE","-u","GIT_INDEX_FILE","-u","CLAUDE_PROJECT_DIR","SAFEWORD_TEST_LOCK_MAX_WAIT_MS=1800000","../../scripts/dev","bun","run","test","tests/host-contract/codex-additional-tools.test.ts","tests/host-contract/codex-internal-reference.test.ts","tests/host-contract/codex-proof-quality.test.ts","tests/host-contract/codex-workflow-essential.test.ts","tests/host-contract/codex-workflow-runtime-harness.test.ts"]} |
| codex-isolated-preparation | command | integration | Existing real actor setup/refresh/argv/preservation uses reviewed prestaged A/B and rejects authority/tree/binding faults; fake only external CLI/inventory, not native proof | real_boundary | current_required | {"type":"command","cwd":"packages/cli","argv":["env","-u","GIT_DIR","-u","GIT_WORK_TREE","-u","GIT_INDEX_FILE","-u","CLAUDE_PROJECT_DIR","SAFEWORD_TEST_LOCK_MAX_WAIT_MS=1800000","../../scripts/dev","bun","run","test","tests/host-contract/codex-isolated-behavior.test.ts","tests/host-contract/codex-fresh-trust-preparation.test.ts","tests/host-contract/codex-workflow-runtime-harness.test.ts","tests/host-contract/codex-workflow-essential.test.ts","tests/host-contract/codex-proof-quality.test.ts"]} |
| codex-staged-review-binding | command | integration | Real staging/normal capture/current readers require both fixed role approvals and exact complete representation including expanded collaborators and caller contexts; fake external reviewer only. Source contract proof, never ROOT staged approval or native permission. | real_boundary | current_required | {"type":"command","cwd":"packages/cli","argv":["env","-u","GIT_DIR","-u","GIT_WORK_TREE","-u","GIT_INDEX_FILE","-u","CLAUDE_PROJECT_DIR","SAFEWORD_TEST_LOCK_MAX_WAIT_MS=1800000","../../scripts/dev","bun","run","test","tests/host-contract/codex-two-review-binding.test.ts","tests/host-contract/codex-staged-scope.test.ts","tests/host-contract/codex-workflow-staging.test.ts","tests/host-contract/codex-isolated-behavior.test.ts","tests/host-contract/codex-isolated-consumer.test.ts","tests/host-contract/codex-isolated-picker.test.ts","tests/host-contract/codex-expanded-staged-scope.test.ts"]} |
| codex-staged-input-review | command | E2E | ROOT's ONE existing full-ten isolated invocation, after all consumer prerequisites, requires both actual current normal approvals for every one of eleven fixed pairs before actions/after B, complete captured scope and independent package verification in retained artifacts. Normal-mode/filtered/source-fake success cannot close this proof. Same run as native-codex-internal-workflows, not a second suite. | real_boundary | current_required | {"type":"command","cwd":".","argv":["scripts/dev","bun","packages/cli/scripts/check-codex-internal-workflows.ts","--require-targets"]} |
| opencode-registration-status | command | integration | Actual conformance controller validates outer-process fixture observations and seals records read by public status; native proof separately required | real_boundary | current_required | {"type":"command","cwd":"packages/cli","argv":["env","SAFEWORD_TEST_LOCK_MAX_WAIT_MS=1800000","../../scripts/dev","bun","run","test","tests/opencode/status.test.ts","tests/opencode/conformance.test.ts"]} |
| opencode-retirement | command | integration | Actual private-project public install/conformance plus generated schema/registration and independently expected V2-only required population; reject V1 active delivery and unadmitted V2 activation | real_boundary | current_required | {"type":"command","cwd":"packages/cli","argv":["env","SAFEWORD_TEST_LOCK_MAX_WAIT_MS=1800000","../../scripts/dev","bun","run","test","tests/opencode/retirement.test.ts"]} |
| conditional-process-correlation | command        | integration | Existing correlatedReview raw/SDK/status/cwd component accepts only zero conditional process recipes; nonzero and assignment inverses plus real installed authenticated API controls retain authority; synthetic turns are NONRECEIPTS, not native execution                                                                                                            | real_boundary         | current_required | {"type":"command","cwd":"packages/cli","argv":["env","SAFEWORD_TEST_LOCK_MAX_WAIT_MS=1800000","../../scripts/dev","bun","run","test","tests/host-contract/codex-review-receipt.test.ts","tests/host-contract/codex-review-api.test.ts"]}                                                                                                                                                                                                                                                                                                                                                                                                           |
| covered-control-endpoints       | command        | integration | Actual isolated seed through real Node: six-case correct suites, old-four endpoint mutant pass, new-six mutant rejection, unchanged defective/covered forwarding contrast                                                                                                                                                                                               | real_boundary         | current_required | {"type":"command","cwd":"packages/cli","argv":["env","SAFEWORD_TEST_LOCK_MAX_WAIT_MS=1800000","../../scripts/dev","bun","run","test","tests/host-contract/codex-review-wiring.test.ts"]}                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| harness-review-boundary         | command        | integration | PR3 preparation discovery through real correlatedReview and installed authenticatedWiringReview; finite standard-language exclusion, literal labels, all parent mutation/wrapper/version and authority negatives; literal preparation, exact final invocation, unique whole raw/SDK, current signed status and all retained forgery/model/binding/cwd/partial negatives | real_boundary         | current_required | {"type":"command","cwd":"packages/cli","argv":["env","SAFEWORD_TEST_LOCK_MAX_WAIT_MS=1800000","../../scripts/dev","bun","run","test","tests/host-contract/codex-review-receipt.test.ts","tests/host-contract/codex-review-api.test.ts"]}                                                                                                                                                                                                                                                                                                                                                                                                           |
| preparation-language-actor      | command        | integration | PR3 actual existing actor fixed shell preflight; supported version/names continue, failed/malformed/unknown language unavailable before native dispatch; mock only process boundary                                                                                                                                                                                     | real_boundary         | current_required | {"type":"command","cwd":"packages/cli","argv":["env","SAFEWORD_TEST_LOCK_MAX_WAIT_MS=1800000","../../scripts/dev","bun","run","test","tests/host-contract/codex-workflow-runtime-harness.test.ts"]}                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| preparation-integration         | command        | integration | PR3 unchanged permission tripwire and actual Git readiness/resume caller after the fixed preflight; exact finite census retained                                                                                                                                                                                                                                        | real_boundary         | current_required | {"type":"command","cwd":"packages/cli","argv":["env","SAFEWORD_TEST_LOCK_MAX_WAIT_MS=1800000","../../scripts/dev","bun","run","test","tests/uid-dependent-permission-tripwire.test.ts","tests/host-contract/codex-workflow-git.test.ts"]}                                                                                                                                                                                                                                                                                                                                                                                                          |
| checked-cd-prompt               | command        | integration | PR3 actual invokePublic delivers the approved checked-cd sentence only to review; explain and observer rejection contracts remain unchanged                                                                                                                                                                                                                             | real_boundary         | current_required | {"type":"command","cwd":"packages/cli","argv":["env","SAFEWORD_TEST_LOCK_MAX_WAIT_MS=1800000","../../scripts/dev","bun","run","test","tests/host-contract/codex-workflow-runtime-harness.test.ts"]}                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| shared-validation-delivery      | command        | integration | PR3 real producers, reconciliation and startup deliver the exact approved paragraph within unchanged budgets and retain prior negative controls                                                                                                                                                                                                                         | real_boundary         | current_required | {"type":"command","cwd":"packages/cli","argv":["env","SAFEWORD_TEST_LOCK_MAX_WAIT_MS=1800000","../../scripts/dev","bun","run","test","tests/host-contract/testing-core-delivery.test.ts","tests/host-contract/testing-procedure-delivery.test.ts","tests/host-contract/codex-startup-essential.test.ts","tests/host-contract/codex-workflow-essential.test.ts"]}                                                                                                                                                                                                                                                                                   |
| controlled-output-dispatch      | command        | integration | PR3 actual actor proves separate initial invocations, unchanged B and precise public-label request without private hints                                                                                                                                                                                                                                                | real_boundary         | current_required | {"type":"command","cwd":"packages/cli","argv":["env","SAFEWORD_TEST_LOCK_MAX_WAIT_MS=1800000","../../scripts/dev","bun","run","test","tests/host-contract/codex-workflow-runtime-harness.test.ts"]}                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| literal-grouping-read           | command        | integration | PR3 actual resourceLoad accepts complete current escaped/quoted grouping data and rejects active/malformed/provenance counterexamples without modifying old negatives                                                                                                                                                                                                   | real_boundary         | current_required | {"type":"command","cwd":"packages/cli","argv":["env","SAFEWORD_TEST_LOCK_MAX_WAIT_MS=1800000","../../scripts/dev","bun","run","test","tests/host-contract/codex-bound-root-read.test.ts","tests/host-contract/codex-proof-quality.test.ts"]}                                                                                                                                                                                                                                                                                                                                                                                                       |
| allowed-write-delimiter         | command        | integration | PR3 actual actor emitted allowed request isolates unchanged command; denied request and exact byte/one-attempt controls retained; native boundary only mocked                                                                                                                                                                                                           | real_boundary         | current_required | {"type":"command","cwd":"packages/cli","argv":["env","SAFEWORD_TEST_LOCK_MAX_WAIT_MS=1800000","../../scripts/dev","bun","run","test","tests/host-contract/codex-workflow-runtime-harness.test.ts"]}                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| exec-wrapper-display            | command        | integration | PR3 actual resourceLoad/correlatedToolCommands with current complete resource, same unique literal result wrapper and SDK stdout/exit; retained edges and foreign/partial/effect/metadata negatives; no native grade                                                                                                                                                    | real_boundary         | current_required | {"type":"command","cwd":"packages/cli","argv":["env","SAFEWORD_TEST_LOCK_MAX_WAIT_MS=1800000","../../scripts/dev","bun","run","test","tests/host-contract/codex-proof-quality.test.ts","tests/host-contract/codex-review-receipt.test.ts"]}                                                                                                                                                                                                                                                                                                                                                                                                        |
| absolute-review-target          | command        | integration | PR3 real correlatedReview and authenticatedWiringReview through actual installed signed status; relative/exact absolute/mixed targets, both verdict exits, bound arguments and all foreign/missing/extra/duplicate/dynamic/current-status/raw-SDK controls; mock only reviewer process                                                                                  | real_boundary         | current_required | {"type":"command","cwd":"packages/cli","argv":["env","SAFEWORD_TEST_LOCK_MAX_WAIT_MS=1800000","../../scripts/dev","bun","run","test","tests/host-contract/codex-review-receipt.test.ts","tests/host-contract/codex-review-api.test.ts"]}                                                                                                                                                                                                                                                                                                                                                                                                           |
| claude-model-reporting          | command        | integration | Actual normal Claude executable selection, stream response identity and unchanged schema; mixed/auxiliary/unconfirmed negatives                                                                                                                                                                                                                                         | real_boundary         | current_required | {"type":"command","cwd":"packages/cli","argv":["../../scripts/dev","bun","run","test","tests/review/claude-model-reporting.test.ts"]}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| testing-procedure-payload       | command        | integration | Actual generated installed body through resourceLoad with first-range input, all frozen required/example digests and canonical/installed/guide budgets                                                                                                                                                                                                                  | real_boundary         | current_required | {"type":"command","cwd":"packages/cli","argv":["../../scripts/dev","bun","run","test","tests/host-contract/testing-procedure-delivery.test.ts"]}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| isolated-grader-transport       | command        | integration | Real normal versus bound CLI selection, current authenticated status, exact binding and completed-model/schema/sandbox/fallback negative controls; mock only external reviewer                                                                                                                                                                                          | real_boundary         | current_required | {"type":"command","cwd":"packages/cli","argv":["../../scripts/dev","bun","run","test","tests/review/isolated-grader-transport.test.ts"]}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| codex-wiring-calibration        | command        | eval        | Actual existing coordinator grades12 frozen claims twice in owned grading projects; current signed status, exact model qualification and preservation; no native-task claim                                                                                                                                                                                             | real_boundary         | current_required | {"type":"command","cwd":".","argv":["scripts/dev","bun","packages/cli/scripts/check-codex-wiring-calibration.ts","--require-targets","--output","/tmp/safeword-post-audit-wiring-calibration-attempt-1.json"]}                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| codex-startup-essential         | command        | integration | Real generator and bundled normal/fallback SessionStart startup/resume validate installed core, budgets, invocation flags and corrupt carriers; real process boundary only, not native model context                                                                                                                                                                    | real_boundary         | current_required | {"type":"command","cwd":"packages/cli","argv":["../../scripts/dev","bun","run","test","tests/host-contract/codex-startup-essential.test.ts"]}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| testing-core-delivery           | command        | integration | Real canonical generator and schema reconciliation entry points produce current essential content in actual delivery artifacts and quality prompt; real boundary for this content contract only, never native/all-host execution proof                                                                                                                                  | real_boundary         | current_required | {"type":"command","cwd":"packages/cli","argv":["../../scripts/dev","bun","run","test","tests/host-contract/testing-core-delivery.test.ts"]}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| codex-internal-workflow-wiring  | command        | integration | Real normally generated native catalogue/index/resources and bundled SessionStart CLI; canonical-source mutation, complete resource closure and non-write authority controls                                                                                                                                                                                            | real_boundary         | current_required | {"type":"command","cwd":"packages/cli","argv":["../../scripts/dev","bun","run","test","tests/host-contract/codex-internal-workflows.test.ts"]}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| restart-whole-suite             | command        | integration | PR3 real Node grader and actor-owned post-A/pre-B capture; same-name/count assertion improvement; seed-only, tautology, surviving fault, wrong-module, unchanged, missing/malformed/foreign/corrupt/failing/already-complete baseline controls and exact restoration                                                                                                    | real_boundary         | current_required | {"type":"command","cwd":"packages/cli","argv":["env","SAFEWORD_TEST_LOCK_MAX_WAIT_MS=1800000","../../scripts/dev","bun","run","test","tests/host-contract/codex-proof-quality.test.ts","tests/host-contract/codex-workflow-essential.test.ts","tests/host-contract/codex-workflow-runtime-harness.test.ts"]}                                                                                                                                                                                                                                                                                                                                       |
| native-codex-internal-workflows | command        | E2E         | Actual installed Codex 0.167.0 ten-case group: fresh/manual/public complete reads, restart current startup core, paired actionable defective/fixed public review judgments, selector, closure and guard actions; both judgment arms and all After required                                                                                                              | real_boundary         | current_required | {"type":"command","cwd":".","argv":["scripts/dev","bun","packages/cli/scripts/check-codex-internal-workflows.ts","--require-targets"]}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| native-cursor-cli               | command        | E2E         | Exact Cursor CLI 2026.11.05-86047df loads the same generated extension and portable core, with separate real tool-result evidence for writes and catalogue; cannot satisfy IDE rows                                                                                                                                                                                     | real_boundary         | current_required | {"type":"command","cwd":".","argv":["scripts/dev","bun","packages/cli/scripts/run-host-contract-proof.ts","--proof","native-cursor-cli","--require-targets"]}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| native-cursor                   | command        | E2E         | Exact 3.29.9 IDE loads core/extension and genuinely dispatches shared guards, resources and continuation                                                                                                                                                                                                                                                               | real_boundary         | current_required | {"type":"command","cwd":".","argv":["scripts/dev","bun","packages/cli/scripts/run-host-contract-proof.ts","--proof","native-cursor","--require-targets"]}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| cursor-project-hooks                   | command        | E2E         | Current 3.29.9 IDE retains project-hook guarantees and upgraded unenrolled status using CLI-owned conformance identity, with no native cache                                                                                                                                                                                                                  | real_boundary         | current_required | {"type":"command","cwd":".","argv":["scripts/dev","bun","packages/cli/scripts/run-host-contract-proof.ts","--proof","cursor-project-hooks","--require-targets"]}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| native-claude                   | command        | E2E         | Exact Claude 2.1.319 installed native plugin proves denied/allowed writes, canonical catalogue/helper origin and actual bounded continuation                                                                                                                                                                                                                            | real_boundary         | current_required | {"type":"command","cwd":".","argv":["scripts/dev","bun","packages/cli/scripts/run-host-contract-proof.ts","--proof","native-claude","--require-targets"]}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| native-codex                    | command        | integration | Exact 0.167.0 separately proves portable resource precedence and selected compatibility-container guards/resources/continuation; resource-only proof cannot establish enforcement                                                                                                                                                                                       | real_boundary         | current_required | {"type":"command","cwd":".","argv":["scripts/dev","bun","packages/cli/scripts/run-host-contract-proof.ts","--proof","native-codex","--require-targets"]}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| portable-components | command | E2E | Actual Codex and BOTH current Cursor CLI and IDE independently prove portable resource loading/precedence, not guards | real_boundary | current_required | {"type":"command","cwd":".","argv":["scripts/dev","bun","packages/cli/scripts/run-host-contract-proof.ts","--proof","portable-components","--require-targets"]} |
| native-opencode | command | integration | Exact OpenCode 2.4.1 CLI/TUI load installed catalogue and helper before guards and registration | real_boundary | current_required | {"type":"command","cwd":".","argv":["scripts/dev","bun","packages/cli/scripts/run-host-contract-proof.ts","--proof","native-opencode","--require-targets"]} |
| coexistence | command | integration | Actual V2 processes read preserved unrelated profile configuration and separate selected/unselected project enrollments | real_boundary | current_required | {"type":"command","cwd":".","argv":["scripts/dev","bun","packages/cli/scripts/run-host-contract-proof.ts","--proof","coexistence","--require-targets"]} |
| repository-boundaries           | command        | integration | Required repository check processes reject source/output/owner/bypass mutations in disposable trees                                                                                                                                                                                                                                                                     | real_boundary         | current_required | {"type":"command","cwd":"packages/cli","argv":["../../scripts/dev","bun","run","test","tests/host-contract/repository-boundaries.test.ts"]}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| current-target-retirement | command | integration | Actual target/required-runner/public-check boundary rejects active retired and missing current source/target/lane identities with independent oracle | real_boundary | current_required | {"type":"command","cwd":".","argv":["env","SAFEWORD_TEST_LOCK_MAX_WAIT_MS=1800000","scripts/dev","bun","run","test","tests/host-contract/target-version.test.ts","tests/host-contract/repository-boundaries.test.ts","tests/host-contract/opencode-population.test.ts"]} |
| propagation                     | command        | E2E         | A canonical policy/skill change is observed across every exact actual host/runtime including IDE                                                                                                                                                                                                                                                                        | real_boundary         | current_required | {"type":"command","cwd":".","argv":["scripts/dev","bun","packages/cli/scripts/run-host-contract-proof.ts","--proof","propagation","--require-targets"]}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| sealed-writer | command | integration | Production trusted controller processes use real locks, atomic sealed writes and readers for retry, crash, key and history cases | real_boundary | current_required | {"type":"command","cwd":"packages/cli","argv":["../../scripts/dev","bun","run","test","tests/host-contract/evidence-writer.test.ts"]} |
| architecture-owner | command        | integration | Shared prerequisite/citation/verified-review owner and actual installed Claude/Codex callers; current native qualifications remain in propagation | real_boundary         | current_required | {"type":"command","cwd":".","argv":["env","-u","GIT_DIR","-u","GIT_WORK_TREE","-u","GIT_INDEX_FILE","-u","CLAUDE_PROJECT_DIR","SAFEWORD_TEST_LOCK_MAX_WAIT_MS=1800000","scripts/dev","bun","run","test","tests/host-contract/architecture-review-owner.test.ts","tests/host-contract/propagation-codex-policy.test.ts","tests/host-contract/propagation-claude-policy.test.ts","tests/host-contract/propagation-settings-oracle.test.ts"]} |
| policy-options                  | command        | integration | Actual installed helper subprocess consumes documented configuration combinations through the shared policy owner                                                                                                                                                                                                                                                       | real_boundary         | current_required | {"type":"command","cwd":"packages/cli","argv":["../../scripts/dev","bun","run","test","tests/host-contract/policy-options.test.ts"]}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| repository-current              | command        | integration | Required check against the actual unmutated working tree proves complete shipped inventory, dispositions, sole owners and projections                                                                                                                                                                                                                                   | real_boundary         | current_required | {"type":"command","cwd":".","argv":["scripts/dev","bun","packages/cli/scripts/check-host-contract.ts","--json"]}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| owner-current                   | command        | integration | Actual baseline-to-HEAD committed repository capture validates the complete expected retired-owner set and retained mechanics                                                                                                                                                                                                                                           | real_boundary         | current_required | {"type":"command","cwd":".","argv":["sh","-ec","exec \"${SAFEWORD_REVIEWED_CHECKOUT:?set the reviewed checkout}/scripts/dev\" bun \"$SAFEWORD_REVIEWED_CHECKOUT/packages/cli/scripts/check-host-contract.ts\" \"$@\"","owner-current","--owner-delta","--baseline","f48275b5e616010f3ce76bf5baf7329603f9ac57","--candidate","HEAD","--json"]}                                                                                                                                                                                                                                                                                                      |
| owner-delta                     | command        | integration | Trusted capture entrypoint recomputes committed source graphs and exposes retired independent owners                                                                                                                                                                                                                                                                    | real_boundary         | current_required | {"type":"command","cwd":"packages/cli","argv":["../../scripts/dev","bun","run","test","tests/host-contract/owner-inventory.test.ts"]}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| headless-propagation | command | integration | Real retained policy/resource/settings/continuation observations on five exact non-IDE lanes, stale refusal and repair | real_boundary | current_required | {"type":"command","cwd":".","argv":["scripts/dev","bun","packages/cli/scripts/run-host-contract-proof.ts","--proof","headless-propagation","--require-targets"]} |
| headless-propagation-staging | command | integration | Real runner and stage validators with simulated external host and reviewer. All approval, middle-revision, tree, and native binding controls pass before the live diagnostic can qualify. | real_boundary | current_required | {"type":"command","cwd":"packages/cli","argv":["../../scripts/dev","bun","run","test","tests/host-contract/headless-propagation-staging.test.ts"]} |
| headless-full-audit | command | integration | Full audit for the final lockfile. Record every finding and its remediation or explicit authorized disposition. | real_boundary | current_required | {"type":"command","cwd":".","argv":["scripts/dev","bun","audit"]} |
| headless-historical-red | command | integration | On the owned pre-fix checkout, with the frozen proof inputs and ordinary-request ledger, require exit 0 from the authenticated executable-RED gate. Record the verified receipt and checkout identities. Missing receipt stays open. | real_boundary | current_required | {"type":"command","cwd":".","argv":["scripts/dev","bun","packages/cli/src/cli.ts","review","gate","executable-red","--scenario","Scenario: An ordinary request discovers an eligible internal workflow","--ledger",".project/tickets/2ENRH5-consistent-host-contract/test-definitions.md","--json"]} |
| headless-qualification | command | integration | Real exact-target non-IDE observations only, with all owned rows and case IDs required | real_boundary | current_required | {"type":"command","cwd":".","argv":["scripts/dev","bun","packages/cli/scripts/run-host-contract-proof.ts","--proof","headless-qualification","--require-targets"]} |
| admission | command | integration | Public admission and status reject inapplicable proof. The simulated version probe distinguishes unlisted recovery from missing pinned qualification. | real_boundary | current_required | {"type":"command","cwd":"packages/cli","argv":["../../scripts/dev","bun","run","test","tests/host-contract/admission.test.ts"]} |
| lifecycle | command | E2E | Real selected lifecycle operations plus actual host use prove clone/profile isolation and single-owner recovery | real_boundary | current_required | {"type":"command","cwd":".","argv":["scripts/dev","bun","packages/cli/scripts/run-host-contract-proof.ts","--proof","lifecycle","--require-targets"]} |
| all-hosts                       | command        | E2E         | Final exact six runtime rows / seven deliveries, complete catalogue/resources, allow/deny/continuation and demo composition                                                                                                                                                                                                                                                              | real_boundary         | current_required | {"type":"command","cwd":".","argv":["scripts/dev","bun","packages/cli/scripts/run-host-contract-proof.ts","--proof","all-hosts","--require-targets"]}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| acceptance | command | integration | Actual Cucumber actors plus independently compiled complete 70-definition/103-example population; reject filtered, zero, skipped or omitted cases | real_boundary | current_required | {"type":"command","cwd":".","argv":["scripts/dev","bun","packages/cli/scripts/run-host-contract-proof.ts","--proof","acceptance","--require-targets"]} |
| existing-regressions | command | integration | Existing CLI plugin/lifecycle/resource behavior remains usable | real_boundary | current_required | {"type":"command","cwd":"packages/cli","argv":["../../scripts/dev","bun","run","test","tests/lifecycle/","tests/claude-plugin/","tests/codex-plugin/","tests/opencode/","tests/plugin-resource-contract.test.ts","tests/cursor/","tests/cursor-shell-gate.test.ts","tests/integration/cursor-pretooluse-gate.test.ts","tests/integration/cursor-stop-review.test.ts"]} |
| documentation                   | review_receipt | integration | Independent review of final user/contributor guidance and surface inventory against implemented behavior and guarantees                                                                                                                                                                                                                                                 | real_boundary         | current_required | {"type":"review_receipt","kind":"quality-review","targets":[".project/guides/skill-authoring-guide.md",".project/guides/schema-registration-guide.md","AGENTS.md","ARCHITECTURE.md","packages/cli/templates/skills/testing/SKILL.md","packages/cli/templates/guides/testing-guide.md",".project/architecture-decisions/shared-host-contracts.md",".project/surfaces.md","README.md","packages/website/src/content/docs/getting-started/quick-start.mdx","packages/website/src/content/docs/reference/configuration.mdx","packages/website/src/content/docs/reference/hooks-and-skills.mdx","packages/website/src/content/docs/reference/cli.mdx"]} |
| delivery-review-batch-1 | review_receipt | integration | Independent review of the listed delivery source files | real_boundary | current_required | {"type":"review_receipt","kind":"quality-review","targets":["packages/cli/src/lifecycle/commands.ts","packages/cli/src/lifecycle/cursor.ts","packages/cli/src/lifecycle/doctor.ts","packages/cli/src/lifecycle/host-releases.json","packages/cli/src/lifecycle/integrations.ts","packages/cli/src/lifecycle/nested-install.ts","packages/cli/src/lifecycle/project-install.ts","packages/cli/src/lifecycle/schema.ts","packages/cli/src/lifecycle/sibling-registration.ts","packages/cli/src/lifecycle/status.ts","packages/cli/src/host-contract/catalogue.ts","packages/cli/src/host-contract/conformance-run.ts","packages/cli/src/host-contract/delivery.ts","packages/cli/src/host-contract/handlers.ts","packages/cli/src/host-contract/native-handler-discovery.ts","packages/cli/src/host-contract/owner-inventory.ts","packages/cli/src/host-contract/portable-core.ts","packages/cli/src/host-contract/source-ownership.ts","packages/cli/src/host-contract/workers.ts","packages/cli/src/commands/advance-intake.ts","packages/cli/src/commands/architecture.ts","packages/cli/src/commands/audit-scope.ts","packages/cli/src/commands/boundary.ts","packages/cli/src/commands/codex-bootstrap.ts","packages/cli/src/commands/codex-hook.ts","packages/cli/src/commands/codify.ts","packages/cli/src/commands/coding-authorization.ts","packages/cli/src/commands/delivery-checklist.ts","packages/cli/src/commands/execution-prerequisite.ts","packages/cli/src/commands/feature-directories.ts","packages/cli/src/commands/go-lint.ts","packages/cli/src/commands/lint-gherkin.ts","packages/cli/src/commands/migrate-codex-plugin.ts"]} |
| delivery-review-batch-2 | review_receipt | integration | Independent review of the listed delivery source files | real_boundary | current_required | {"type":"review_receipt","kind":"quality-review","targets":["packages/cli/src/commands/namespace-root.ts","packages/cli/src/commands/plan-approval.ts","packages/cli/src/commands/planning-contract-check.ts","packages/cli/src/commands/project-pr-ready.ts","packages/cli/src/commands/project-runtime.ts","packages/cli/src/commands/public-retros.ts","packages/cli/src/commands/record-skill-invocation.ts","packages/cli/src/commands/remove.ts","packages/cli/src/commands/retro-drain.ts","packages/cli/src/commands/retro.ts","packages/cli/src/commands/review-disposition.ts","packages/cli/src/commands/review-knowledge.ts","packages/cli/src/commands/review-pr-publication.ts","packages/cli/src/commands/review-pr-readiness.ts","packages/cli/src/commands/review-pr.ts","packages/cli/src/commands/sync-config.ts","packages/cli/src/commands/sync-tracker.ts","packages/cli/src/commands/test-execution.ts","packages/cli/src/commands/test-plan.ts","packages/cli/src/commands/ticket-new.ts","packages/cli/src/commands/ticket-reconcile-parent.ts","packages/opencode-v2-plugin/architecture.generated.md","packages/opencode-v2-plugin/package.json","packages/opencode-v2-plugin/src/index.ts","packages/opencode-v2-plugin/src/native-activation.ts","packages/opencode-v2-plugin/src/native-parent.ts","packages/opencode-v2-plugin/tsconfig.json","packages/cli/templates/hooks/audit-principle-trace.ts","packages/cli/templates/hooks/codex/post-tool-quality.ts","packages/cli/templates/hooks/codex/post-tool-skill-nudge.ts","packages/cli/templates/hooks/codex/pre-tool-quality-helpers.ts","packages/cli/templates/hooks/codex/pre-tool-quality.ts","packages/cli/templates/hooks/codex/stop.ts","packages/cli/templates/hooks/cursor/after-file-edit.ts","packages/cli/templates/hooks/cursor/before-shell-execution.ts","packages/cli/templates/hooks/cursor/gate-adapter.ts","packages/cli/templates/hooks/cursor/post-tool-quality.ts","packages/cli/templates/hooks/cursor/post-tool-skill-nudge.ts","packages/cli/templates/hooks/cursor/pre-tool-quality.ts","packages/cli/templates/hooks/cursor/stop.ts","packages/cli/templates/hooks/dependency-bootstrap.ts","packages/cli/templates/hooks/lib/active-ticket.ts","packages/cli/templates/hooks/lib/architecture-document-nudge.ts","packages/cli/templates/hooks/lib/architecture-review-gate.ts","packages/cli/templates/hooks/lib/architecture-staged-scope.ts","packages/cli/templates/hooks/lib/audit-scope.sh","packages/cli/templates/hooks/lib/auto-upgrade-lock.ts","packages/cli/templates/hooks/lib/auto-upgrade.ts"]} |
| delivery-review-batch-3 | review_receipt | integration | Independent review of the listed delivery source files | real_boundary | current_required | {"type":"review_receipt","kind":"quality-review","targets":["packages/cli/templates/hooks/lib/bash-ledger-writes.ts","packages/cli/templates/hooks/lib/behavior-contract.ts","packages/cli/templates/hooks/lib/blocked-on-gate.ts","packages/cli/templates/hooks/lib/branch-staleness.ts","packages/cli/templates/hooks/lib/checkbox-transitions.ts","packages/cli/templates/hooks/lib/closeout-binding.ts","packages/cli/templates/hooks/lib/closest-base-ref.ts","packages/cli/templates/hooks/lib/cursor-run-identity.ts","packages/cli/templates/hooks/lib/cursor-state.ts","packages/cli/templates/hooks/lib/dependency-readiness.ts","packages/cli/templates/hooks/lib/dogfood.ts","packages/cli/templates/hooks/lib/done-gate.ts","packages/cli/templates/hooks/lib/drain-retro-spool.ts","packages/cli/templates/hooks/lib/feature-provenance.ts","packages/cli/templates/hooks/lib/git-operation.ts","packages/cli/templates/hooks/lib/hierarchy.ts","packages/cli/templates/hooks/lib/host-toolchain.ts","packages/cli/templates/hooks/lib/impl-plan.ts","packages/cli/templates/hooks/lib/inspiration.ts","packages/cli/templates/hooks/lib/jsonl-spool.ts","packages/cli/templates/hooks/lib/jtbd.ts","packages/cli/templates/hooks/lib/learning-verification-stamps.ts","packages/cli/templates/hooks/lib/ledger-git.ts","packages/cli/templates/hooks/lib/ledger-validation.ts","packages/cli/templates/hooks/lib/lint-config.ts","packages/cli/templates/hooks/lib/lint.ts","packages/cli/templates/hooks/lib/markdown-structure.ts","packages/cli/templates/hooks/lib/namespace-root.ts","packages/cli/templates/hooks/lib/parse-annotation.ts","packages/cli/templates/hooks/lib/phase-provenance.ts","packages/cli/templates/hooks/lib/plan-gate.ts","packages/cli/templates/hooks/lib/pr-readiness-guard.ts","packages/cli/templates/hooks/lib/principle-trace.ts","packages/cli/templates/hooks/lib/process-kill-guard.ts","packages/cli/templates/hooks/lib/product-plan-contract.ts","packages/cli/templates/hooks/lib/project-directory.ts","packages/cli/templates/hooks/lib/project-knowledge.ts","packages/cli/templates/hooks/lib/project-state.ts","packages/cli/templates/hooks/lib/quality-state.ts","packages/cli/templates/hooks/lib/quality.ts","packages/cli/templates/hooks/lib/re-entry.ts","packages/cli/templates/hooks/lib/read-receipt.ts","packages/cli/templates/hooks/lib/readiness-pointer.ts","packages/cli/templates/hooks/lib/replan-relevance.ts","packages/cli/templates/hooks/lib/replan.ts","packages/cli/templates/hooks/lib/retro-debug.ts"]} |
| delivery-review-batch-4 | review_receipt | integration | Independent review of the listed delivery source files | real_boundary | current_required | {"type":"review_receipt","kind":"quality-review","targets":["packages/cli/templates/hooks/lib/retro-draft-spool.ts","packages/cli/templates/hooks/lib/retro-extract.ts","packages/cli/templates/hooks/lib/retro-filing-gate.ts","packages/cli/templates/hooks/lib/retro-nudge.ts","packages/cli/templates/hooks/lib/retro-trigger.ts","packages/cli/templates/hooks/lib/retrospective-annotation.ts","packages/cli/templates/hooks/lib/retrospective-gate.ts","packages/cli/templates/hooks/lib/review-ledger.ts","packages/cli/templates/hooks/lib/review-receipt.ts","packages/cli/templates/hooks/lib/review-trigger.ts","packages/cli/templates/hooks/lib/run-identity.ts","packages/cli/templates/hooks/lib/safeword-cli.ts","packages/cli/templates/hooks/lib/safeword-context.ts","packages/cli/templates/hooks/lib/scenario-format.ts","packages/cli/templates/hooks/lib/self-report.ts","packages/cli/templates/hooks/lib/shell-segments.ts","packages/cli/templates/hooks/lib/skill-invocation-log.ts","packages/cli/templates/hooks/lib/skill-nudge.ts","packages/cli/templates/hooks/lib/test-runner.ts","packages/cli/templates/hooks/lib/ticket-close.ts","packages/cli/templates/hooks/lib/typecheck-gate.ts","packages/cli/templates/hooks/lib/update-cache.ts","packages/cli/templates/hooks/lib/verify-stamp-claims.ts","packages/cli/templates/hooks/lib/version.ts","packages/cli/templates/hooks/lib/work-log-stamp.ts","packages/cli/templates/hooks/post-tool-bypass-warn.ts","packages/cli/templates/hooks/post-tool-dependency-readiness.ts","packages/cli/templates/hooks/post-tool-lint.ts","packages/cli/templates/hooks/post-tool-quality.ts","packages/cli/templates/hooks/post-tool-skill-nudge.ts","packages/cli/templates/hooks/post-tool-sync-learnings.ts","packages/cli/templates/hooks/post-tool-work-log.ts","packages/cli/templates/hooks/pre-tool-architecture-stage.ts","packages/cli/templates/hooks/pre-tool-config-guard.ts","packages/cli/templates/hooks/pre-tool-dependency-readiness.ts","packages/cli/templates/hooks/pre-tool-git-bare-fix.sh","packages/cli/templates/hooks/pre-tool-quality.ts","packages/cli/templates/hooks/pre-tool-stale-main.ts","packages/cli/templates/hooks/prompt-questions.ts","packages/cli/templates/hooks/prompt-retro-nudge.ts","packages/cli/templates/hooks/prompt-timestamp.ts","packages/cli/templates/hooks/record-skill-invocation.ts","packages/cli/templates/hooks/resolve-namespace-root.ts","packages/cli/templates/hooks/resolve-project-knowledge.ts","packages/cli/templates/hooks/resolve-verify-ticket.ts","packages/cli/templates/hooks/run-review.ts","packages/cli/templates/hooks/session-architecture-heal.ts","packages/cli/templates/hooks/session-auto-upgrade.ts"]} |
| delivery-review-batch-5 | review_receipt | integration | Independent review of the listed delivery source files | real_boundary | current_required | {"type":"review_receipt","kind":"quality-review","targets":["packages/cli/templates/hooks/session-bun-check.sh","packages/cli/templates/hooks/session-cleanup-quality.ts","packages/cli/templates/hooks/session-codex-start.ts","packages/cli/templates/hooks/session-compact-context.ts","packages/cli/templates/hooks/session-cursor-auto-upgrade.ts","packages/cli/templates/hooks/session-dependency-readiness.ts","packages/cli/templates/hooks/session-lint-check.ts","packages/cli/templates/hooks/session-reply-format.ts","packages/cli/templates/hooks/session-safeword-context.ts","packages/cli/templates/hooks/session-start-reentry.ts","packages/cli/templates/hooks/session-version.ts","packages/cli/templates/hooks/stop-quality.ts","packages/cli/templates/hooks/stop-reentry.ts","packages/cli/templates/hooks/stop-retro-filing.ts","packages/cli/templates/hooks/stop-retro.ts","packages/cli/templates/hooks/stop-self-report.ts","packages/cli/templates/hooks/write-review-stamp.ts","packages/cli/scripts/run-host-contract-proof.ts"]} |
| delivery-review | review_receipt | integration | Cross-check all five prior approvals and the interfaces between shared policy, host adapters, recovery and evidence | real_boundary | current_required | {"type":"review_receipt","kind":"quality-review","targets":[".project/tickets/2ENRH5-consistent-host-contract/evidence-index.md",".project/tickets/2ENRH5-consistent-host-contract/spec.md","packages/cli/src/lifecycle/integrations.ts","packages/cli/src/lifecycle/project-install.ts","packages/cli/src/host-contract/source-ownership.ts","packages/cli/src/host-contract/conformance-run.ts","packages/opencode-v2-plugin/src/index.ts","packages/cli/templates/hooks/pre-tool-quality.ts","packages/cli/scripts/run-host-contract-proof.ts"]} |
| native-codex-invocation         | command        | integration | Supporting installed Codex0.167.0 context component of One shared skill change reaches every applicable agent; fresh native allowed action and exact-package developer catalogue prove implicit visibility only, not user-menu hiding or full propagation                                                                                                               | real_boundary         | current_required | {"type":"command","cwd":".","argv":["scripts/dev","bun","packages/cli/scripts/check-codex-skill-invocation.ts"]}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| native-codex-internal-reference | command        | integration | Diagnostic copied-package Codex0.167.0 startup/reference-read boundary only; actual TUI menu observation is retained separately; no production wiring or full propagation                                                                                                                                                                                               | partial_or_structural | current_required | {"type":"command","cwd":".","argv":["scripts/dev","bun","packages/cli/scripts/check-codex-internal-reference.ts"]}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| skill-invocation-settings       | command        | integration | Supporting component for One shared skill change reaches every applicable agent: real generation/install preserves canonical invocation booleans and absent defaults; no host enforcement claim                                                                                                                                                                         | partial_or_structural | current_required | {"type":"command","cwd":"packages/cli","argv":["../../scripts/dev","bun","run","test","tests/host-contract/skill-invocation.test.ts"]}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| generated                       | command        | integration | Deterministic generated-surface synchronization only                                                                                                                                                                                                                                                                                                                    | partial_or_structural | current_required | {"type":"command","cwd":".","argv":["scripts/dev","bun","packages/cli/scripts/check-generated-surfaces.ts"]}                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| security-dependency-audit | command | integration | Existing CI audit evaluates the actual installed locked graph at unchanged high threshold/two ignores; does not claim unfiltered audit clean or consumer/native compatibility | real_boundary | current_required | {"type":"command","cwd":".","argv":["scripts/dev","bun","audit","--audit-level","high","--ignore","GHSA-vfj7-8cjw-p6xm","--ignore","GHSA-ch52-4w7c-c8xp"]} |
| security-frozen-install | command | integration | Normal installer consumes the bounded candidate lock without re-resolution; before/after package and lock hashes must match | real_boundary | current_required | {"type":"command","cwd":".","argv":["scripts/dev","bun","install","--frozen-lockfile"]} |
| security-workspace-build | command | integration | Existing workspace build consumes actual selected dependencies | real_boundary | current_required | {"type":"command","cwd":".","argv":["scripts/dev","bun","run","build"]} |
| security-workspace-types | command | integration | Existing workspace typechecks actual dependency APIs | real_boundary | current_required | {"type":"command","cwd":".","argv":["scripts/dev","bun","run","typecheck"]} |
| security-website-build | command | integration | Actual Astro site build uses the selected graph; no runtime sanitization claim | real_boundary | current_required | {"type":"command","cwd":".","argv":["scripts/dev","bun","run","--cwd","packages/website","build"]} |
| security-website-types | command | integration | Actual Astro check validates website types against selected Zod dependency | real_boundary | current_required | {"type":"command","cwd":".","argv":["scripts/dev","bun","run","--cwd","packages/website","typecheck"]} |
| security-consumer-tests | command | integration | Existing real schema/lifecycle/plugin consumer tests on the bounded dependency graph; no native host claim | real_boundary | current_required | {"type":"command","cwd":"packages/cli","argv":["env","SAFEWORD_TEST_LOCK_MAX_WAIT_MS=1800000","../../scripts/dev","bun","run","test","tests/schema.test.ts","tests/schema-projection.test.ts","tests/lifecycle/","tests/claude-plugin/","tests/codex-plugin/","tests/opencode/","tests/plugin-resource-contract.test.ts"]} |
| cursor-handoff-generation | command | integration | Real registered project/native Cursor edit and Stop guards reject stale generation evidence and preserve matching/unknown/foreign identity, precedence, marker-presence quality/retro and handoff-oracle controls. External vendor edges may be fake; this is not native IDE or joined-propagation proof. | real_boundary | current_required | {"type":"command","cwd":"packages/cli","argv":["env","-u","GIT_DIR","-u","GIT_WORK_TREE","-u","GIT_INDEX_FILE","-u","CLAUDE_PROJECT_DIR","SAFEWORD_TEST_LOCK_MAX_WAIT_MS=1800000","../../scripts/dev","bun","run","test","tests/host-contract/cursor-handoff-generation.test.ts","tests/host-contract/architecture-review-owner.test.ts","tests/host-contract/cursor-quality-runtime.test.ts","tests/hooks/cursor-state.test.ts","tests/integration/cursor-stop-review.test.ts","tests/integration/cursor-stop-retro.test.ts","tests/host-contract/propagation-handoff-settings.test.ts","tests/host-contract/propagation-settings-oracle.test.ts"]} |


## Delivery checklist

<!-- safeword:delivery-checklist:v1 -->

| ID                              | Category                                  | Obligation                                                                                                                                                                        | Owner       | Required proof                  | Disposition   | Evidence class | Revision | Evidence, reason, or dependency                                                                                                                                                                                                                              |
| ------------------------------- | ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ------------------------------- | ------------- | -------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| codex-mixed-review-correlation | testing | Mixed current review call and exact bound cwd retain authenticated and whole-output provenance | contributor | codex-mixed-review-correlation | open | missing | | |
| headless-propagation-staging | testing | Three exact reviewed revisions share one middle identity. Approval, tree and native binding faults refuse before any model invocation. | contributor | headless-propagation-staging | open | missing | | |
| headless-propagation-live | testing | Branch owner runs the staged five-delivery diagnostic and records all retained checks and explicit admission ineligibility. Requires staged source controls first. | contributor | headless-propagation | open | missing | | |
| headless-full-audit | security and privacy | Branch owner reconciles applicable audit findings on final locked dependencies. Any scope or risk exception depends on explicit user authorization. | contributor | headless-full-audit | open | missing | | |
| headless-historical-red | testing | Branch owner reconciles the historical ordinary-request proof with its accepted non-IDE scenario and independently approved failing evidence or existing exact disposition. | contributor | headless-historical-red | open | missing | | |
| codex-normal-trust-window | testing | Fresh A/B announcement windows, fixed polling expiry and generic deadline preserved; ROOT launcher/native observation separate | contributor | codex-normal-trust-window | open | missing | | |
| propagation-retained-settings-join | testing | Retained lane/installation settings join with actual grader and case controls; native and supported continuation remain separate | contributor | propagation-retained-settings-join | open | missing | | |
| codex-retained-continuation | testing | Same retained installation, trial isolation and captured Codex continuation; native proof remains separate | contributor | codex-retained-continuation | open | missing | | |
| claude-retained-continuation | testing | Same retained installation, trial isolation and captured Claude continuation; native proof remains separate | contributor | claude-retained-continuation | open | missing | | |
| cursor-retained-continuation | testing | Both retained IDE installations and captured continuation; native and exhausted-cap proof remain separate | contributor | cursor-retained-continuation | open | missing | | |
| propagation-retained-settings-helper | testing | Existing graders on retained actors with identity, protocol and applicability controls | contributor | propagation-retained-settings-helper | open | missing | | |
| codex-early-status-correlation | testing | Current status after one exact early bound cwd retains authenticated and whole-output provenance | contributor | codex-early-status-correlation | open | missing | | |
| codex-isolated-model-budget | testing | Isolated exec and resume receive the approved model-turn budget; normal and non-model commands retain the default | contributor | codex-isolated-model-budget | open | missing | | |
| codex-informational-rollout | testing | Bounded actual additional_tools metadata parsing with no evidence credit and strict faults | contributor | codex-informational-rollout | open | missing | | |
| codex-isolated-preparation | testing | Real actor call sites preserve default trust and verify exact reviewed fixed A/B before isolated invocation and refresh; fixture correction separately requires the final five-file codex-fixture-corrections proof | contributor | codex-isolated-preparation | open | missing | | |
| testing-wiring-navigation | testing | Canonical and installed testing navigation resolves both essential rules and optional guide examples without changing the core | contributor | testing-wiring-navigation | open | missing | | |
| codex-fixture-corrections | testing | Owned-folder prompt and two resource-only preservation source controls | contributor | codex-fixture-corrections | open | missing | | |
| codex-staged-review-binding | testing | Fitting two-job capture plus observed current pass/faults for roles, exact union, raw deltas, expanded collaborators, caller contexts and shared identity; source controls are not ROOT approvals | contributor | codex-staged-review-binding | open | missing | | |
| codex-staged-input-review | resolved decisions | Both actual normal focused reviews per final pair, exact combined captured coverage/common frozen identity and ROOT byte verification before A/after B; source binding tests alone do not close this | contributor | codex-staged-input-review | open | missing | | |
| codex-normal-trust-invalidation | testing | Normal fixture qualifier observes refusal/review/callback A and changed-script B invalidation/refusal/review/callback plus restoration; not plain group success | contributor | codex-normal-trust-invalidation | open | missing | | |
| codex-isolated-grader-approval | testing | No outstanding permission request for the already approved/applied exact preservation predicate; all further assertion changes remain frozen | human | | not_applicable | missing | | Exact current-codex-isolated-preservation-grader-user-approval-20261114.json and committed 8e874 prerequisite supersede this historical pending-permission row. This is not new proof completion; unchanged predicate controls remain required by codex-isolated-preparation. |
| opencode-registration-status | testing | PR 2 local sealed capture and public evaluator retain required/optional registration facts, independent guard proof, current activation and exact target identity | contributor | opencode-registration-status | open | missing | | |
| opencode-retirement | testing | Public retirement boundary removes V1 generation/selection/required cases while retaining V2 CLI/TUI and preserving external old files; unsupported and admission controls pass | contributor | opencode-retirement | open | missing | | |
| conditional-process-correlation | testing                                   | PR3 zero-only conditional process evidence and nonzero/assignment/authority inverses pass before fresh native qualification                                                       | contributor | conditional-process-correlation | open          | missing        |          |                                                                                                                                                                                                                                                              |
| covered-control-endpoints       | testing                                   | PR3 both isolated review arms have endpoint representatives and real Node rejects the observed covered endpoint mutant without changing grading                                   | contributor | covered-control-endpoints       | open          | missing        |          |                                                                                                                                                                                                                                                              |
| claude-model-reporting          | testing                                   | PR 3 normal Claude original-response model reporting with unchanged policy and no inference                                                                                       | contributor | claude-model-reporting          | open          | missing        |          |                                                                                                                                                                                                                                                              |
| testing-procedure-payload       | testing                                   | PR 3 complete compact body and all required/example content through actual package/reference                                                                                      | contributor | testing-procedure-payload       | open          | missing        |          |                                                                                                                                                                                                                                                              |
| isolated-grader-transport       | testing                                   | Default-off owned grading build, exact scope/identity/context/fallback and bundle equivalence through real normal coordinator/status                                              | contributor | isolated-grader-transport       | open          | missing        |          |                                                                                                                                                                                                                                                              |
| codex-wiring-calibration        | testing                                   | Parent actual 24/24 qualified current claim grades before any new selected native pair or native10                                                                                | contributor | codex-wiring-calibration        | open          | missing        |          |                                                                                                                                                                                                                                                              |
| codex-startup-essential         | resolved decisions                        | PR 3 existing SessionStart delivers one validated current bounded core without invocation or authority changes                                                                    | contributor | codex-startup-essential         | open          | missing        |          |                                                                                                                                                                                                                                                              |
| testing-core                    | resolved decisions                        | One bounded essential-rule owner reaches every declared template and existing headless quality consumer through real generation/reconciliation                                    | contributor | testing-core-delivery           | open          | missing        |          |                                                                                                                                                                                                                                                              |
| codex-internal-wiring           | resolved decisions                        | Canonical flags/descriptions and complete resource graph drive real native startup without another policy owner                                                                   | contributor | codex-internal-workflow-wiring  | open          | missing        |          |                                                                                                                                                                                                                                                              |
| harness-review-boundary         | testing                                   | PR3 reviewed finite-language/label mechanism and real caller/API language/control plus retained authority negatives pass before fresh native qualification                        | contributor | harness-review-boundary         | open          | missing        |          |                                                                                                                                                                                                                                                              |
| preparation-language-actor      | testing                                   | PR3 fixed producer preflight supports only the declared shell language and rejects unsupported/malformed probes before native dispatch                                            | contributor | preparation-language-actor      | open          | missing        |          |                                                                                                                                                                                                                                                              |
| preparation-integration         | testing                                   | PR3 categorical language metadata passes the unchanged permission tripwire and the Git caller handles preflight while retaining readiness, resume identity and rejection controls | contributor | preparation-integration         | open          | missing        |          |                                                                                                                                                                                                                                                              |
| checked-cd-prompt               | testing                                   | PR3 actual actor request contains the approved sentence; unchanged explain and strict receipt/API controls pass before new qualification                                          | contributor | checked-cd-prompt               | open          | missing        |          |                                                                                                                                                                                                                                                              |
| shared-validation-delivery      | testing                                   | PR3 exact owner replacement, generated/current installed/startup delivery, unchanged caps and parity before fresh live proof                                                      | contributor | shared-validation-delivery      | open          | missing        |          |                                                                                                                                                                                                                                                              |
| controlled-output-dispatch      | testing                                   | PR3 actual setup/public dispatch and unchanged resume controls must pass before fresh native proof                                                                                | contributor | controlled-output-dispatch      | open          | missing        |          |                                                                                                                                                                                                                                                              |
| literal-grouping-read           | testing                                   | PR3 real resource caller proves lexical distinction and preserves complete current body, unique raw/SDK call and all old rejections before fresh qualification                    | contributor | literal-grouping-read           | open          | missing        |          |                                                                                                                                                                                                                                                              |
| allowed-write-delimiter         | testing                                   | PR3 allowed command delimiter proof passes with unchanged intended bytes and denied request before native proof                                                                   | contributor | allowed-write-delimiter         | open          | missing        |          |                                                                                                                                                                                                                                                              |
| exec-wrapper-display            | testing                                   | PR3 wrapper-render comparison must pass actual resource/correlation proof and all dense negative controls on current bytes before native proof                                    | contributor | exec-wrapper-display            | open          | missing        |          |                                                                                                                                                                                                                                                              |
| absolute-review-target          | testing                                   | PR3 receipt representation correction: real caller plus installed-status controls must pass on current bytes before native proof; all positive/negative controls retained         | contributor | absolute-review-target          | open          | missing        |          |                                                                                                                                                                                                                                                              |
| restart-whole-suite             | testing                                   | PR3 whole-suite grader and own-arm pre-B baseline: real Node dense controls and restoration must pass before native proof                                                         | contributor | restart-whole-suite             | open          | missing        |          |                                                                                                                                                                                                                                                              |
| codex-internal-native           | testing                                   | All ten invocation cases require actual native evidence, both judgment arms and public/manual/guard controls                                                                      | contributor | native-codex-internal-workflows | open          | missing        |          |                                                                                                                                                                                                                                                              |
| isolated-hook-trust             | ownership and human dependencies          | Grant host-required native hook trust for normal Claude/Codex proof profiles; only the explicitly vetted disposable Codex behavior mode may bypass persisted trust, never customer activation or normal trust qualification                                                       | human       |                                 | pending_human | missing        |          | User grants the exact test-profile trust only if the host requires a fresh grant; OS Accessibility is already authorized and working. Does not block test scaffolding or code review, but required live guard proof cannot complete without applicable trust |
| outcome-scope | outcome and scope | Headless portion only, per the qualification split in test-definitions.md. The IDE and combined remainder belongs to XHMWSC. | contributor | headless-qualification | open | missing |  |  |
| delivery-review-batch-1 | resolved decisions | Independent approval of all 33 tracked files assigned to delivery batch 1 | contributor | delivery-review-batch-1 | open | missing |  |  |
| delivery-review-batch-2 | resolved decisions | Independent approval of all 48 tracked files assigned to delivery batch 2 | contributor | delivery-review-batch-2 | open | missing |  |  |
| delivery-review-batch-3 | resolved decisions | Independent approval of all 46 tracked files assigned to delivery batch 3 | contributor | delivery-review-batch-3 | open | missing |  |  |
| delivery-review-batch-4 | resolved decisions | Independent approval of all 48 tracked files assigned to delivery batch 4 | contributor | delivery-review-batch-4 | open | missing |  |  |
| delivery-review-batch-5 | resolved decisions | Independent approval of all 18 tracked files assigned to delivery batch 5 | contributor | delivery-review-batch-5 | open | missing |  |  |
| resolved-decisions              | resolved decisions                        | Preserve accepted contracts, sole writers, packaging, supported option composition and guarantee meanings in actual code                                                          | contributor | delivery-review                 | open          | missing        |          |                                                                                                                                                                                                                                                              |
| pr-decomposition                | dependency and pull-request decomposition | Every proposed slice preserves usable existing default delivery without an unmerged successor                                                                                     | contributor | existing-regressions            | open          | missing        |          |                                                                                                                                                                                                                                                              |
| testing | testing | Headless portion only, per the qualification split in test-definitions.md. The IDE and combined remainder belongs to XHMWSC. | contributor | headless-qualification | open | missing |  |  |
| data-compatibility              | data and compatibility                    | Public CLI preserves supported option combinations and rejects stale/foreign/corrupt or method-mismatched evidence                                                                | contributor | admission                       | open          | missing        |          |                                                                                                                                                                                                                                                              |
| monitoring                      | monitoring and failure signals            | Status/doctor expose actual active, limited, unmet and recovery states without repeated unchanged notices                                                                         | contributor | admission                       | open          | missing        |          |                                                                                                                                                                                                                                                              |
| security-privacy                | security and privacy                      | Reject forged proof and unauthorized trust/cleanup; keep controller keys and customer data out of host fixture artifacts                                                          | contributor | admission                       | open          | missing        |          |                                                                                                                                                                                                                                                              |
| security-dependency-update | security and privacy | Exactly authorized DOMPurify/Zod resolution; steps1-5 and existing-regressions plus CI high audit; audit alone cannot establish consumer/native compatibility and whole-lint/moderate qualifications remain open | contributor | security-dependency-audit | open | missing | | |
| security-frozen-resolution | data and compatibility | Frozen install accepts the bounded lock without package/lock drift | contributor | security-frozen-install | open | missing | | |
| security-cli-build | testing | Existing workspace build succeeds with selected dependencies | contributor | security-workspace-build | open | missing | | |
| security-cli-types | testing | Existing workspace typecheck succeeds with selected dependencies | contributor | security-workspace-types | open | missing | | |
| security-site-build | testing | Existing Astro website builds with selected dependencies | contributor | security-website-build | open | missing | | |
| security-site-types | testing | Existing Astro check succeeds with selected dependencies | contributor | security-website-types | open | missing | | |
| security-cli-consumers | testing | Existing schema/lifecycle/plugin tests pass without assertion changes | contributor | security-consumer-tests | open | missing | | |
| evidence-integrity              | security and privacy                      | Real controller publication, duplicate/retry handling, profile-key isolation and immutable failure history cannot manufacture authority                                           | contributor | sealed-writer                   | open          | missing        |          |                                                                                                                                                                                                                                                              |
| rollout-rollback                | rollout and rollback                      | Proved cutover, second-clone/shared-profile preservation, crash recovery, controlled downgrade and selected uninstall retain one authority                                        | contributor | lifecycle                       | open          | missing        |          |                                                                                                                                                                                                                                                              |
| documentation                   | documentation                             | Explain canonical contribution, actual host limits and automatic install/status/recovery in README and configured website                                                         | contributor | documentation                   | open          | missing        |          |                                                                                                                                                                                                                                                              |
| ownership-dependencies          | ownership and human dependencies          | Prove actual committed repository sole ownership, exact retired maintenance paths and necessary translations without transferring authority                                       | contributor | owner-current                   | open          | missing        |          |                                                                                                                                                                                                                                                              |
| repository-completeness         | completion evidence                       | Actual working tree has complete source/handler inventory, lane dispositions and sole owners; fixture-only success cannot certify adoption                                        | contributor | repository-current              | open          | missing        |          |                                                                                                                                                                                                                                                              |
| completion-evidence | completion evidence | Headless portion only, per the qualification split in test-definitions.md. The IDE and combined remainder belongs to XHMWSC. | contributor | headless-qualification | open | missing |  |  |
| current-target-retirement | outcome and scope | Retire only older HOST selectors/groups, retarget existing required population and preserve current config/reconciliation | contributor | current-target-retirement | open | missing | | |
| native-claude-current | testing | Current2.1.319 installed native resources/helper, pre-action deny/allow and actual supported bounded continuation | contributor | native-claude | open | missing | | |
| native-opencode | testing | OpenCode 2.4.1 CLI/TUI installed catalogue/helper first, then separate allow/deny observations | contributor | native-opencode | open | missing | | |
| coexistence | data and compatibility | Current selected/unselected OpenCode projects share profile without unrelated config changes or unselected activation | contributor | coexistence | open | missing | | |
| portable-components | testing | Headless portion only, per the qualification split in test-definitions.md. The IDE and combined remainder belongs to XHMWSC. | contributor | headless-qualification | open | missing |  |  |
| architecture-owner | resolved decisions | Shared prerequisite/citation/review predicate once, preserved Claude defaults and thin session-bound Stop calls; no fabricated approval/model identity | contributor | architecture-owner | open | missing | | |
| architecture-native-settings | testing | Headless portion only, per the qualification split in test-definitions.md. The IDE and combined remainder belongs to XHMWSC. | contributor | headless-qualification | open | missing |  |  |
| architecture-author-origin | security and privacy | Headless portion only, per the qualification split in test-definitions.md. The IDE and combined remainder belongs to XHMWSC. | contributor | headless-qualification | open | missing |  |  |
| current-codex-root-qualification | data and compatibility | Required Codex root-origin resource row stays separate from container hook positives | contributor | native-codex | open | missing | | |
| current-opencode-worker-qualification | data and compatibility | Current OpenCode worker/isolation facts stay separate from scripted callback positives | contributor | native-opencode | open | missing | | |
| cursor-handoff-generation | testing | PR 3 Task6: same registered-boundary command passes after a frozen reviewed stale-generation RED, including matching/unknown identities and focused precedence, marker-presence quality/retro and handoff/oracle regressions; actual IDE deliveries remain separate propagation obligations | contributor | cursor-handoff-generation | open | missing | | |

### Current-host package and configuration preservation

Before PR4 GREEN, public admission/status distinguishes recognized old Safeword package/new CLI healthy (exit0 plus advisory contracted-unproved detail) and unhealthy (unchanged failure), current contracted package/missing required proof (action_required), stale/foreign/config/trust/epoch/protocol/capability identities, stripped contract marker and unknown markerless package. This is SAME current-host package reconciliation, not older-host compatibility. Unlisted host plus new contract reports affected required guarantees unproved/action_required existing exit2, preserves actual activation facts/config and names update-Safeword-to-validated-release then restart recovery; never host downgrade. Optional guarantees cannot conceal independent required protection. Matching exact-current release proof and activation is necessary; no family/binding-compatible/upgrade renewal proof or old binary.

Current OpenCode CLI/TUI independently preserve unrelated profile fields and selected/unselected enrollment. Current Cursor project hooks retain actual catalogue/helper, allow/deny, bounded completion, upgraded unenrolled status and unchanged static references with no native cache. Current two-clone/cloud-like checks stay configuration-scoped, not Cloud enforcement. Clean native eligible projects separately prove actual core/extension origin, no competing workflow registrations, enrollment, reload and epoch. Fallback is active only after actual reload/content/guard observation, never from a returned path. Existing lifecycle/activation writers alone own transitions. No current user hooks, authored content, normal profiles/chats or nonselected agents are deleted to retire older binaries.

Final all-hosts includes BOTH Cursor CLI and IDE portable-components and the separate current project-hooks delivery. Runtime/delivery receipt transfer is rejected; native proof cannot fill project status. Cursor profile activation stays explicitly unsealed observation, never sealed conformance.

### Retirement scenario ownership — current amendment

| Accepted scenario                                                  | Owner/slice | Completion boundary                                                                                                                         |
| ------------------------------------------------------------------ | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Retired OpenCode V1 cannot remain an active delivery or proof lane | PR 2        | Independent public selection/generation/schema/required-population oracle rejects remaining active V1 and retains V2 CLI/TUI requirements   |
| Retiring V1 cannot silently activate unproved V2 protection | PR 2, PR 4 | Bundled install, repair and uninstall preserve user settings. Qualify exact CLI/TUI release bytes. Local proof is required for active status. |

All other scenario/Rule ownership and the four coherent slice purposes are retained. Prior V1-only preservation and cross-major proof requirements are retired, not satisfied or transferred.

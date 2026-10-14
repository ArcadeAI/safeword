# Prepare the first verified merge group for #4200

This delivery task belongs to epic 82T411, GitHub #4200. It prepares PRs #4906, #4989, #4990 and #4991 for an explicit human landing decision. No Ready promotion, merge, release, new deferrals or epic-completion claim is authorized.

## Plan and completion criteria

1. Record current main and PR heads; reconcile the proposed combined tree.
2. Inspect the whole source diff and any required fixes in higher PRs.
3. Verify targeted acceptance, authenticated approval/rejection, concurrency, generated surfaces and installed user paths on candidate bytes.
4. Complete independent current review and required checks, preserving all failures and limitations.
5. Present the exact safe landing group and heads for human approval.

## 2026-10-14 investigation

Remote main: d5885e58771cd87f8108196ce67986f7725a1974.

- #4906: 711e324126e937bc2029f4962d6ad2add311fe21.
- #4989: 65f7963af95f102999417a42de218649383b36ac.
- #4990: 945c839a28e4e863392da35b1da9164008fb6311.
- #4991: db50bc23db43e59ec5609ad9ff13f820afaf15d8.

The isolated candidate starts from #4991. The existing approval checkout contains historical uncommitted diagnostics and remains untouched. Foundation integration has six generated conflicts and one acceptance adapter conflict. Preserve the D1 13-case admission group and the new requirement for real semantic proof; regenerate all derived surfaces from canonical sources.

The remote foundation contains five commits absent from #4991, including genuine rejection presentation and scenario-specific live semantic proof. Higher PRs also change contract identity, installed copy admission and legacy discovery handling; inspect these as possible dependencies rather than silently importing them.

The recovery branch's previous full suite finished with 36 failures, 11,433 passes and 14 skips. This is historical evidence, not a passing candidate run.

The GitHub gateway requires reauthentication. Signed-in browser access works for read-only PR inspection. Safeword rejected shell and apply_patch edits to the newly scaffolded canonical ticket; its original v1 activation scaffold is preserved. Investigation is recorded here rather than bypassing that validation.

## Actual candidate proof and dependencies

- All five generated surfaces were rebuilt and verified after foundation integration. Frozen dependency install passed. Typecheck passed.
- Initial authenticated approval/presentation checks: 85/85 passed.
- Native template dependency: the real CLI failed when the project-local Execution Plan template was absent, despite the packaged template being available. Narrowly backported schema lookup from c91547387/d74a2dc15. The next four-file run passed 101/101 tests, including the new template regression, concurrency, contract identity and repository toolchain tests. Logs: /tmp/4200-first-group-native-template-red.log and /tmp/4200-first-group-targeted-green.log.
- Four complete root acceptance features passed 145 scenarios, 6,769 steps and both hooks. Log: /tmp/4200-first-group-acceptance-145.log. This does not prove the rest of the epic.
- Added the missing repeated-approval assertion to the existing actual CLI discovery scenario. It fails: after design-changing Execution discovery sends the ticket to plan-implementation, repeating approve-plan without changing or reviewing the plan returns exit 0 and advances to plan-execution. Expected exit 2 and unchanged planning phase. Log: /tmp/4200-first-group-reentry-red.log. This failure supersedes any claim that the current candidate test file passes completely.
- Independent bounded assessment e9d48f3b-c391-4a8e-9fed-6fc3ed0de745 is evaluating whether the existing higher-stack invalidation/legacy transition is a required landing dependency. No expensive whole qualification has been rerun on a known failing candidate.

## Independent disposition and stopping boundary

Review e9d48f3b-c391-4a8e-9fed-6fc3ed0de745 completed with authenticated cross-agent Claude changes_requested. It independently confirmed the repeated-approval bypass as an error. It also warned that project-global latest review state can hide a ticket-specific discovery and that path-only discovery lookup is not an explicit version binding. Shared target-matching cleanup was informational; do not expand this work to refactoring for that advice.

The four-PR candidate is DRAFT and must not land as-is. No full qualification, full suite or merge should be purchased/performed while this known RED remains. Its two passing targeted results are supporting proof only; they do not override the failing reentry case.

The original small landing-group assumption is disproven. The existing higher-stack fix depends on planning-context invalidation and legacy reentry policy. Pulling only a durable notice and legacy refusal into this older branch would change its legacy repair path and would not supply the complete current-context identity behavior. A new timestamp/ledger-order guard suggested by the reviewer would be a second policy mechanism; do not implement that parallel mechanism here.

Original recommendation (superseded by proposal review): expand the group. Independent proposal review dd57529f-37ec-4802-bead-591bf4ab0f1d approved the safe no-landing boundary but identified premature route selection: a faithful backport does not inherently create a second policy, and neither dependency closure nor comparative verification cost was established. Continue the already-authorized bounded comparison before recommending either route. No human direction is needed merely to investigate; exact merge scope still needs explicit approval before landing. Existing PRs remain unchanged, Draft and unmerged.

The proposal review also identified missing gate-enabled prior-approval proof. The current failing assertion covers only gate-disabled reentry. Both routes and legitimate fresh-review recovery must be verified on the eventual candidate. Current main d5885e58 has no plan-approval.ts command, so this group introduces the affected command/routing path. The corrected landing-proposal.md records exact candidate source hashes and these acceptance boundaries. No coding or migration policy change was made during this proposal review.

## 2026-10-14 resumed dependency comparison and backport

Rechecked remote main and the four PR heads: unchanged from the handoff. `gh` read-only access works again; all four heads are mergeable with no nonpassing item in their current rollups (33/41/25/45 total items respectively, including skips and repeated advisory events). These are original-head checks, not candidate proof.

Chose the bounded complete backport after tracing repository dependencies; see dependency-comparison.md. Expanding through PR3 adds 45 canonical production files and still needs the discovery changes. Expanding through PR5 adds 71 canonical production files / 217 source-test files and unrelated fallback, scope and qualification work. The repair's current closure is 16 production files, including the existing e9850c228 bundler setting for prettier/plugins/markdown. All seven shared identity/metadata modules are retained from PR3 unchanged. Packet/job wiring uses the existing review owner, fingerprint and phase admission; approval uses the existing human decision ledger. No timestamp/order ledger or parallel authorization policy was added.

The real CLI matrix now covers native gate-off, native gate-on with a prior human decision for identical plan bytes, legacy gate-off/gate-on, a v1-marked unsupported task, stale discovery after edited bytes, an unrelated review after a recorded repair, and legitimate conversion/repair plus fresh review. Unrepaired reentry remains blocked. A repaired changed plan requires a new human decision when configured. The final 10-file run before the native-guide correction had 239 passes and three failures: two imported canonical-test assumptions about the newer contract format and one cold executable inspection timeout. The corrected copied-runtime file then passed all five tests; job.test.ts passed all 79 in the following focused run. Earlier failing runs are retained under /tmp/4200-backport-*.log and must not be rewritten as passing.

The four root features pass 145 scenarios / 6,769 steps / two hooks on this backport. Root lint and typecheck, all five generated surfaces, parity (276 pairs / 11 contracts), the public CLI contract, and frozen install (no dependency changes) passed before the later native-guide correction.

Independent Claude review 769a8f82-aee0-4780-a07e-4dc5ac7b85d8 approved the bounded source with no error findings, while identifying native data-guide lookup as a warning requiring investigation. Reproduced it outside Vitest: an owned native ticket with applicable data review fails missing_planning_context because the project guide is absent even though the package carries it. A bounded packet capture correction is prepared in /tmp/4200-packet-native-guide.ts, with four new native-data-guide-context tests. It uses only the schema-registered guide fallback, keeps project guide precedence, and retains containment, source identity and snapshot checks. It is pending application after the running full suite completes. The full suite was started before that correction and is not evidence for its final bytes.

The full repository suite is currently running as tool session 33361, output /tmp/4200-first-group-full-suite.log. Do not overlap another Vitest process. It has reported failures in review workers, runner locks, public review fixtures, dependency-readiness, closeout host adapters, surface parity and packaged startup. Investigate each from its actual error. A standalone instrumented worker probe shows the first new temporary ps executable can time out at 1,002 ms, then succeed in 714 ms and later 5 ms; this explains at least the cold-script inspection assumption, not every suite failure. The packaged startup failure exposed the missing bundler setting, which is part of the pending complete backport and must be applied, not excused as environmental.

No paid qualification was repeated. The separate recovery branch and historical archives remain untouched. OpenCode/cloud accepted cases remain deferred. No merge, promotion, release or deployment occurred.

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

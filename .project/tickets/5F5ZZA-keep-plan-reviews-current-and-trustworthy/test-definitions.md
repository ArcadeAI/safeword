# Test Definitions: Keep plan reviews current and trustworthy

Feature source: `features/keep-plan-reviews-current-and-trustworthy.feature`

test-definitions.md is the R/G/R ledger.

## Rule: plan-implementability.TBU4.5F5ZZA.R1 — Shared clauses are authored once and generated into both contracts

### Scenario: Editing the canonical shared clause changes both generated phase contracts

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

Supporting Product reviewer-generation proof: the real planning-family generator
must emit the Product reviewer copy and propagate every canonical shared clause,
including both shared-block markers, after a canonical edit. The primary target is
`packages/cli/tests/integration/planning-contract-generation.test.ts`; invoke
`scripts/dev bun run --cwd packages/cli test tests/integration/planning-contract-generation.test.ts`.
This supporting loop initially lacked Product reviewer emission. Independent
review `dda87835-1abd-4eb3-9205-6ca36a6aa04b` approved the tightened RED before
implementation; the generator then passed 21 focused tests and 172 broader
cases. All four shared clauses and both block markers propagate into the Product
reviewer output. This generation proof does not claim complete installed Product
dispatch or admission. Keep the full scenario unchecked until every approved
boundary is proved.

Supporting complete author-copy identity generation proof: the real family
generator must emit a closed three-phase `PLANNING_AUTHOR_COPIES` map from
schema-owned canonical owner files. Each entry names its package-relative path
and SHA-256 of the complete raw asset, including authoring instructions outside
reviewer-safe blocks. A canonical shared-clause edit and comments outside those
blocks must update every corresponding whole-copy identity; assert all four
changed clauses in all three generated author contracts. This supports the
accepted exact-copy boundary, not a new receipt or semantic policy. Existing
catalogue producers own native transformations; package-specific native
identities must come from final generated assets, including Claude's formatting
pass, rather than an editable adjacent inventory or stale checked-in copies.
The pinned Bun 1.3.14 builder's existing global-literal mechanism was checked
against current primary documentation and a disposable API check: runtime
globals/environment cannot replace the embedded identity. See the bounded
investigation `/tmp/4200-planning-copy-integrity-investigation.md` for options,
evidence and the formatting pre-mortem.
The primary target remains
`packages/cli/tests/integration/planning-contract-generation.test.ts`; execute
the complete unfiltered file with `scripts/dev bun run --cwd packages/cli test
tests/integration/planning-contract-generation.test.ts`. Initial RED is one
intended failure and 22 passes (23 tests), because generation does not emit the
required complete-author identity export. The expected literal is
`real planning-family generation must emit complete author-copy identities`;
its local log is `/tmp/4200-whole-author-copy-identity-generation-red.log`.
Independent executable RED approval is required before implementation.

Independent review `ce6ffa64-1a6f-4d16-af6a-ec75a806065b` requested changes:
the missing generated export alone does not prove an actor-facing installed
copy gate. No production implementation followed that rejection. Retain this
generator assertion as supporting coverage; the corrected primary RED below
crosses installed CLI dispatch.

### Scenario: Phase-only clauses remain in their owning contract

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A missing generated shared clause blocks reconciliation

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

The three R1 feature scenarios now execute against a fresh source distribution,
real contract generators, and the installed project's `install`/`upgrade` CLI
boundary. Targeted Cucumber result: 3 scenarios and 141 steps passed. This is
the public reconciliation proof for R1; the R/G/R checkboxes remain open until
the scenario review and final feature verification are recorded.

## Rule: plan-implementability.TBU4.5F5ZZA.R2 — Each review receives its complete phase context

### Scenario: A review packet cannot omit required phase context

Bounded primary proof: `packages/cli/tests/integration/planning-review-identity.test.ts`
uses a fresh installed distribution and the public `review run plan-implementation`
command. Only the external reviewer process is mocked. The caller supplies the
plan and accepted spec; the reviewer approves only when its actual packet contains
the current configured principles. Removing only that file must produce a typed
`principles` context-role refusal before reviewer execution. This paired proof
covers configured principles, not every phase role, semantic identity, native host,
or receipt admission. Evidence class: simulated-host (real CLI/coordinator,
synthetic external reviewer). All completion boxes remain open pending review.

The next paired installed-CLI controls assert the actual current personas and
surfaces in the captured reviewer packet and remove each required source in
isolation. Removal must refuse before reviewer execution. The companion
`packages/cli/tests/review/planning-context.test.ts` repeats those role-resolution
variants at packet preparation for fast diagnosis; it does not substitute for
the installed primary boundary. These controls still do not prove the remaining
phase roles, semantic identity, native host parity, or receipt admission.

The R2 packet-completeness outline now runs nine examples through real packet
preparation. The targeted Cucumber run passed 9 scenarios and 432 steps,
including the accepted Implementation Plan, triggered data guidance, and
justified data/dimensions absences. The installed-hook and complete role-inventory
outlines remain open, so the rule's R/G/R boxes stay unchecked.

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Installed dispatch cannot bypass packet completeness

The four examples now run a native plugin review hook against a fresh
CLI-installed local project and real configuration. Product and Implementation
use Claude Code; Execution uses a fresh Codex plugin profile installed from this
checkout, so admitted Claude Opus is a genuinely independent reviewer of the
Codex-authored plan. Only the external reviewer executable is a fixture.
Missing personas and the accepted Implementation Plan refuse before reviewer
execution; complete Implementation and Execution packets reach the reviewer
process. The stronger Execution case initially failed because the changed
canonical rubric invalidated its prior admission digest, then because a Claude
author had no admitted independent Execution route. A live 63-case Claude Opus
matrix refreshed the admission and regenerated both plugin runtimes; three
exact-word cue misses were confirmed semantically by a separate calibrated
Claude Sonnet judge and remain visible in `execution-plan-admission-eval.json`.
The four installed examples pass 192/192 steps; the combined R2 selection
passes 16 scenarios and 768 steps. Full feature verification remains open.

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Canonical phase entry requirements bind every required input

The three phase examples now execute fresh packet preparation with each named
input removed separately: ticket, Product frame and epistemic state, numbered
Rules, declared parent and milestone, principles, personas, surfaces, and (for
downstream plans) scenarios, present dimensions, applicable architecture and
data guidance, and the accepted Implementation Plan. The first run exposed a
real gap: deleting all Rules still entered review. The resolver now refuses
that case with the `rules` role named. Targeted Cucumber result: 3 scenarios,
144 steps passed. This packet-boundary proof does not replace the separate
installed-dispatch outline or full feature verification, so R/G/R remains open.

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: plan-implementability.TBU4.5F5ZZA.R3 — Required context resolves or fails closed

### Scenario: Context resolution distinguishes defaults from broken overrides

- [x] RED b1d1740cc
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Local dispatch enforces required context resolution

- [x] RED f44d0b9e4
- [ ] GREEN
- [ ] REFACTOR

## Rule: plan-implementability.TBU4.5F5ZZA.R4 — Review provenance changes only for semantic dependencies

### Scenario: Context identity ignores cosmetic and unrelated edits

2026-10-04 parent-alignment correction: accepted parent TBU4.R9 requires every
bounded canonical contract byte change to invalidate review. Only other context
uses semantic normalization. The canonical whitespace/comment row now requires
stale status. Its primary proof uses real `review status` from an isolated
installed plugin distribution with consistently regenerated rubric bytes,
digest, and typed phase record; the unmodified copied runtime is a positive
control. Prior approval of the contradictory row is historical, not current
authority. Production identity remains unchanged pending reviewed RED and fresh
planning approval.

- [x] RED 1ec6d2e09
- [x] GREEN fd833c0fe
- [x] REFACTOR 6569bc614

Corrective cycle for the parent-aligned canonical-byte row. The historical rows
above remain immutable and do not complete this changed primary proof.

- [x] RED 5b965631f3417952425f2549aca7e1ca6c422b7e
- [ ] GREEN
- [ ] REFACTOR

## Rule: plan-implementability.TBU4.5F5ZZA.R5 — Contract identity binds exact canonical bytes

### Scenario: Installed contract identity controls authoring and approval

Current actor-facing RED loop: run the five outline rows directly through
`features/keep-plan-reviews-current-and-trustworthy.feature` with
`NODE_OPTIONS='--import tsx' scripts/dev node node_modules/.bin/cucumber-js
features/keep-plan-reviews-current-and-trustworthy.feature --name 'Installed
contract identity controls authoring and approval'`. The installed Claude
plugin copy supplies real authoring and phase hooks plus the real review CLI;
only the external reviewer process is a fixture. Four rows pass. The reviewer
rubric drift row fails at the approval gate with
`approval gate allowed a stale reviewer copy`, although dispatch already
refuses the altered generated rubric. The intended GREEN checks both
boundaries in that same row. The complete outline remains unchecked until all
five rows pass and the independent executable proof review approves it.

Supporting complete-author dispatch loop: install a copied actual CLI package,
change only a comment outside the reviewer-safe block in its Implementation or
Execution authoring asset, and invoke real `review run` with an approving fake
external reviewer. Both actual commands currently approve instead of refusing
the edited complete copy. Canonical positive controls in the same unfiltered
file approve. The required refusal names `canonical_contract_copy_mismatch`
and the affected package-relative contract path. The primary target is
`packages/cli/tests/review/execution-plan-contract-identity.test.ts`; generator
identity coverage in `planning-contract-generation.test.ts` is supporting
evidence, not the actor-facing claim. Execute
`scripts/dev bun run --cwd packages/cli test tests/review/execution-plan-contract-identity.test.ts tests/integration/planning-contract-generation.test.ts`.
The complete run has three intended failures and 37 passes (40 tests): two
actual dispatch refusals are missing, and complete canonical identity emission
is absent. Expected actor-facing literal:
`installed CLI must refuse author-copy drift outside the reviewer block`.
Log: `/tmp/4200-complete-author-copy-cli-red.log`. Independent RED approval is
required before production changes. This bounded loop does not complete the
installed host authoring/admission partitions, Product dispatch, or native
asset ownership. Keep the scenario unchecked.

Independent RED review `fa0e5668-c9a5-482d-878c-4dd0de556b3a` approved
the corrected actor-facing proof before production changes. The implementation
now validates complete packaged author bytes before launching a reviewer and
returns a typed missing-copy or mismatch finding with phase and contract path.
Source packages use generated canonical identities; Codex uses its actual
emitted references; Claude hashes its final formatted assets before sealing
the rebuilt runtime. Expected native identities are compiled literals, rather
than a mutable adjacent inventory. Packet failures clean their temporary
workspace. No approval receipt is fabricated by this refusal.

The original 40-test run now has 39 passes and one retained failure: the older
matching noncanonical Implementation-copy test expects `changes_requested`,
while the earlier gate correctly returns `blocked` before any reviewer runs.
The six-file broader check has 91 passes and the same one failure (92 total),
with no exclusions. Human approval to strengthen this assertion to `blocked`
plus the typed mismatch finding is pending under the current testing guide;
the existing assertion has not been changed or skipped. Typechecking and
changed-file ESLint pass, and all four generated surfaces were regenerated
and verified. Real copied Codex and Claude package checks each approve a
pristine Implementation asset and block an outside-rubric comment change,
naming the native asset path. These four checks mock only the external reviewer
process; they do not prove host lifecycle authoring/admission or Product parity.
Logs: `/tmp/4200-complete-author-copy-cli-green.log`,
`/tmp/4200-complete-author-copy-broader-check.log`, and
`/tmp/4200-native-author-copy-dispatch-check.json`.
This loop is not declared GREEN or complete while that existing test fails.

Implementation review `5e946611-cef2-404c-b12b-832aecc2e2fc` requested
changes because native identity wiring was backed only by the disposable
package checks. Added durable
`packages/cli/tests/integration/native-planning-copy-dispatch.test.ts`: run each
real plugin generator into a fresh distribution, approve its pristine final
Implementation asset through the copied native CLI, then alter a comment
outside the rubric and assert the typed native-path refusal with no second
reviewer launch. Both host tests pass. The first fixture attempt failed on
generator setup (Claude requires an existing output root; Codex custom output
requires its matching version flag); those failures are not behavior RED.
A mutation that overwrites the selected native identities with source-template
identities fails both canonical native approval controls. Original source was
restored byte-for-byte. Logs:
`/tmp/4200-native-author-copy-durable-test.log` and
`/tmp/4200-native-author-copy-source-fallback-mutation.log`.
The copy check now also runs when an internal caller supplies a precomputed
contract pair, and Claude's formatting/hash/sealing order is documented beside
the final runtime build. Root-layout changes and broader worker-correlation
cleanup remain outside this bounded loop.

After restoration and regeneration, the complete eight-file check has 160
passes, two existing skips, and the same one retained status-assertion failure
(163 tests). Typecheck, changed-file ESLint, diff hygiene, and all four generated
surfaces pass. Log:
`/tmp/4200-complete-author-copy-final-broader-check.log`.
The pending assertion approval still prevents declaring this loop GREEN.

On 2026-09-26 the user explicitly approved the proposed stronger existing
assertion. The matching noncanonical Implementation-copy test now requires
`blocked` and the actual `canonical_contract_copy_mismatch` finding, including
Implementation phase and canonical package-relative path. Its nonzero exit
assertion remains. Review `cb76afb8-3189-4291-913d-979f18b27451` had requested
this correction as its sole error; the durable native proof gap was resolved.
After the approved edit, the complete unfiltered eight-file run passes: 161
passed, two existing skips, 163 total. Log:
`/tmp/4200-complete-author-copy-approved-assertion-check.log`.
This establishes GREEN for the bounded complete-author dispatch loop. It does
not complete R5: installed authoring/admission, remaining Product and native
partitions, and the full scenario are still unfinished. All scenario checkboxes
remain unchecked. Historical failing runs above are retained as observed.

Independent Claude review `28c9f7d1-3c09-48be-a5a4-40076537816b` approved
that finalized bounded dispatch implementation and corrected assertion with
zero errors and five nonblocking warnings. It precedes the new supporting RED
below; its frozen context is preserved as historical approval rather than a
claim that later ledger changes remain covered. The subsequent full CLI run
has five failures, 10614 passes, and 13 skips across 645 files (10632 tests).
One runtime-parity assertion rejects the intentional single host-specific
identity literal; three Cursor lifecycle fixtures have changed tree digests
with unchanged result digests; missing-contract recovery lost its required
regeneration wording. No failure was filtered or hidden. Log:
`/tmp/4200-complete-author-copy-full-cli.log`.

Supporting installed-project admission RED: the primary target is
`packages/cli/tests/integration/installed-planning-copy-admission.test.ts`.
Invoke `scripts/dev bun run --cwd packages/cli test
tests/integration/installed-planning-copy-admission.test.ts` unfiltered.
A real CLI install creates Cursor project-owned author assets; the real copied
CLI coordinator authenticates an approving external-reviewer fixture. The
canonical public approval command and installed shared pre-tool hook both
allow advancement. Altering only an outside-rubric comment in the project
author copy still allows both boundaries, instead of naming
`canonical_contract_copy_mismatch` and the active `.safeword/skills/bdd` path.
Both tests fail at the intended nonzero-exit assertion. Expected literal:
`installed lifecycle must refuse project author-copy drift after authenticated approval`.
Log: `/tmp/4200-installed-copy-admission-red-corrected.log`. The first run
included an incorrect canonical-control expectation of `healthy` rather than
the successful mutation's `changed` result; that fixture failure is not RED.
The corrected control asserts success and actual Execution phase advancement.
Only the external reviewer is mocked; no receipt authentication is fabricated.
This proves shared installed-hook/CLI behavior, not Cursor adapter envelope
parity, native Claude/Codex/OpenCode authoring, or the complete R5 scenario.
Independent executable RED approval is required before production changes.

Review `5023291c-7c78-4b3a-9b83-be365be3d2d9` independently approved
the installed-project RED, with no errors. Its surface warning confirms that
the shared-hook proof must not be labeled native Claude coverage. Strengthened
the authority chain following its other warning: both artifact and phase
stamps now come from the actual installed `write-review-stamp.ts`, which asks
the trusted copied CLI to authenticate the real coordinator receipt. No stamp
line is hand-written. Both canonical controls still pass and both drift cases
still fail at the intended assertion (two failures, two tests). Log:
`/tmp/4200-installed-copy-real-stamp-red.log`. Refresh executable RED review
against these stronger current test bytes before GREEN.

Supporting Cursor project-copy admission loop: review
`b2efc39b-544e-4cd7-a645-b059fb460122` approved the real-stamp RED but
warned about structured hook denial and a composite post-approval fixture.
Corrected the newly authored proof to use fresh pre-approval drift fixtures.
Review `74598b29-706c-4d00-af47-efbaa1947113` requested changes because
its canonical hook control could accept an always-denying hook. Added an
explicit empty-output canonical allow control. Review
`8a13f604-d95c-4a9a-82ab-0c3917c0a34a` approved the paired executable
RED. Preserve its warnings: clause-deletion/unrelated-file partitions,
native lifecycle envelopes, delivery proof-spec binding, and parse diagnostics
remain open. The runtime symlink is used by the real stamp writer's trusted
receipt reader; direct CLI commands use the actual installed dist entry.

The bounded implementation reuses the raw canonical copy checker, chooses
Cursor's active asset through the owned-file schema, exposes a closed read-only
`ticket planning-contract-check <ticketId> <phase>` query, and calls the checker
before public approval or installed shared-hook Implementation phase admission.
Copy refusal has typed code/phase/path and `blocked` status; it does not change
or manufacture an authenticated reviewer verdict, and adds no review stamp.
Two primary tests pass in `/tmp/4200-cursor-copy-admission-green.log`.
Disabling the active Cursor copy check makes both refusal assertions fail:
`/tmp/4200-cursor-copy-admission-mutation.log`; production source was restored
byte-for-byte. Remaining host/phase partitions prevent whole-scenario credit.
The corrected paired proof is committed as `3190765f9`, separate from its
production guard. Unfiltered six-file regressions: 97 tests pass (six files),
`/tmp/4200-cursor-copy-admission-regressions.log`. Typecheck and changed-file
ESLint pass. All four generated surfaces are current and all 272 mirror pairs
plus 11 contracts match after schema-driven dogfood reconciliation. This is a
bounded GREEN implementation; all scenario checkboxes remain unchecked.
Full CLI is not claimed green: the earlier run has five failures (runtime
identity assertion, three Cursor tree golden expectations, and missing-contract
recovery message), 10,614 passes and 13 skips. Test expectation corrections
remain pending explicit user approval; the recovery regression remains open.


Cursor adapter availability follow-on RED: the installed adapter receives its
native Write payload without plugin CLI variables. Its same-environment paired
cases cover canonical allowance, comment drift with typed copy refusal, and a
project-writable cached checker that must never execute. Current primary run
has two intended failures and three passes (five tests),
`/tmp/4200-cursor-cache-paired-proof-red.log`. Independent executable RED
`13972d15-ab83-4a70-9416-50ca2c2c22d5` approved the frozen corrected
proof with explicit resolver and hook-configuration context. Earlier
`339b1fa2-2fd7-4ddc-a717-85e119158590` requested the paired negative
and trust-boundary cases; they are now present. No fallback production change
is applied: its reviewed parent-boundary scenario correction still requires
user completeness confirmation, and coding authorization reports
`missing_accepted_scenarios`. Existing scenario checkboxes remain unchecked.

Current full acceptance is incomplete: 2374 scenarios, 1777 passed, three
skipped, 587 undefined, seven failed; exit 1. Log:
`/tmp/4200-cursor-copy-full-acceptance.log`. Six failures select ten passing
identity tests but require exactly eight; their one-line expectation correction
is proposed and awaits explicit approval. The seventh requires the missing
packaged-contract recovery action; independent RED
`03819332-648c-4dbe-b771-c3d2917b0fdd` approved that existing failing
proof without modifying its test. The production recovery fix remains pending
current coding authority. Neither these failures nor the original six-failure,
585-unfinished baseline is hidden or reclassified as completion.

Supporting Implementation-copy TDD loop (2026-09-26): RED commit
`b4e23dc6c` reproduced matching edited author/reviewer copies receiving approval
through a copied installed CLI; its canonical control passed. The initial harness
attempt was blocked by a duplicate target/context path and is not counted as RED.
After correction, the intended failure was `approved` instead of refusal.
Independent executable RED review `23e043bf-4b2c-4f3c-a365-a0d1ec3d073a`
approved that observed failure. Its scenario label names the adjacent local
dispatch obligation; this proof itself crosses CLI review dispatch, not the
installed lifecycle transition or a retained current receipt. It is supporting
evidence, not completion of that lifecycle scenario.

GREEN adds the same generated canonical-digest check already used by Execution
to Implementation. An old positive unit fixture used arbitrary matching hashes;
it now derives the actual packaged canonical pair. The negative fixture retains
its contradictory obligations and additionally asserts both canonical-copy
failures. The first broader check exposed that obsolete positive fixture; after
repair the three focused files passed 91 tests with two existing skips. Shared
clause generation, all authoring/admission boundaries, Product coverage, and
cosmetic currency remain unfinished. No scenario checkbox is completed by this
supporting loop.

Independent GREEN review `96b15ada-4d1f-449d-8df8-6e4852e1010c` approved
the current implementation and tests with no errors. An additional four-suite
admission check passed all 111 tests. Typecheck and changed-file ESLint passed,
and all four generated surfaces were regenerated and verified. The public
coding-authorization check remains authorized with cross-agent assurance; it
still grants no authority outside the ordinary TDD gates. No additional
REFACTOR change is needed for this supporting loop: the existing identity helper
now accepts the canonical digest and serves both phases, avoiding duplicated
verification logic. Whole-scenario RED/GREEN/REFACTOR checkboxes remain open until
the remaining accepted partitions and actual lifecycle boundary are proved.

Supporting authoring-boundary loop (2026-09-30): commit `942d31c22` proves an
installed Cursor plan edit incorrectly proceeds with a drifted author copy,
while the canonical copy remains writable. Independent executable RED review
`269663de-d568-40ed-b65a-883ea456babf` approved that bounded failure. Commit
`5cf0d963e` reuses the trusted copy checker before edits to Product,
Implementation, and Execution plan artifacts. The owning file passes 9 tests;
the adjacent phase-gate pair passes 33. The full 5F5ZZA feature still reports
37 passed, 133 undefined, and no failed scenarios. This proves one installed
authoring path, not every copy or the complete outline.

Follow-on authoring proof covers canonical, changed, and absent copies for all
three planning artifacts in one installed Cursor fixture (`91e56c16e`,
`fec12370a`). A separate RED review
`96c0e718-786a-4bce-964d-3a332fe99cd5` approved the observed missing
human-facing refusal; commits `d2cbc2784` and `b3e615904` make the named
copy finding visible to the author. All 16 owning tests and lint pass. External
quality review `61ae018b-ab43-44e1-b6dd-e9647da18fe2` approved the current
hook and tests with no errors. This remains supporting installed-authoring
evidence; full reviewer-copy and host admission coverage, and the Cucumber
outline, are still open.

Bounded reviewer-copy approval loop (2026-09-30): proof commit `075dec464`
made all five outline rows executable. Four passed; the reviewer-rubric drift
row failed because the installed phase gate allowed an earlier approval even
though new review dispatch refused the altered rubric. Independent executable
RED review `6d0dad7c-0263-4d40-b674-f8b3dfdc46eb` approved that exact
actor-facing failure. Commit `1c168fa35` checks generated reviewer bytes
against their sealed digest in the trusted planning preflight and public
Implementation approval. The five direct rows now pass (250 steps), as do
18 installed admission tests including Cursor and public approval, and all
46 adjacent transition-gate tests after their fixture was supplied with the
trusted checker and Product author copy. The complete 5F5ZZA feature reports
42 passed, 128 undefined, and zero failed. External quality review
`f8148ffa-452e-44a9-bebc-e9274cbdb119` approved with nonblocking scope
warnings. This is not whole-scenario completion: Product and Execution
reviewer-copy actor paths and the remaining R5 partitions are still open.

Follow-on dispatch RED: in
`packages/cli/tests/integration/installed-planning-copy-admission.test.ts`,
re-run a real copied CLI review after its prior authenticated approval and a
generated reviewer-rubric drift. The current dispatch launches the reviewer
and returns generic `changes_requested` findings instead of a typed
`canonical_contract_copy_mismatch` before any review request. Run
`scripts/dev bun run --cwd packages/cli test
tests/integration/installed-planning-copy-admission.test.ts`; expected failure:
`review dispatch must refuse stale reviewer bytes before launch`. The intended
GREEN calls the exact reviewer-copy preflight from packet construction and
leaves prior authenticated approval currency separate from copy admission.

Absent-reviewer-copy characterization (2026-10-04): the final R5 outline row
now empties only the generated reviewer rubric in a copied installed plugin,
retaining its sealed digest. Real review dispatch and the installed phase gate
both refuse the copy and name restoration of the packaged contract. The canonical
and tampered-copy controls remain active. All six outline examples pass (306
steps), and the complete R5 group passes nine scenarios (459 steps). External
Claude's focused review confirmed the fixture boundary and requested a recovery
instruction assertion, now included in both outputs. This proves existing
behavior; it does not invent a production RED/GREEN cycle or complete the feature.

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Local dispatch enforces canonical contract identity

An installed Claude plugin copy starts with an authenticated current
Implementation approval. The canonical copy permits the phase transition;
deleting a shared clause while retaining its version label initially produced
a generic missing-review denial. Independent executable RED review
`26cae83f-eb23-4ccd-861d-d7d288f17b88` approved that failure. The phase
hook now checks the installed authoring contract before reading the review
stamp. Both outline rows pass (2 scenarios, 100 steps). The adjacent context
outline passes (7 scenarios, 350 steps), as do the owning hook integration
tests (31 tests). No separate refactor was needed.

Commit-history correction: the immutable checkbox rows below cite the
original combined local commit, which was replaced before publication to
separate the TDD steps. The proof-only RED commit is `9221612ef`; the
subsequent minimal GREEN commit is `b73b7ee89`. The independent RED receipt
above and passing command results apply to those same source bytes.

- [x] RED 9e0f7c2fc
- [x] GREEN 9e0f7c2fc
- [x] REFACTOR skip: no structural change remained after the minimal gate fix

Corrective R/G/R cycle for the split commits; the historical rows above remain
unaltered.

- [x] RED 9221612ef
- [x] GREEN b73b7ee89
- [x] REFACTOR skip: the minimal shared hook check needed no further restructuring

### Scenario: Cosmetic canonical changes preserve review currency but require copy reconciliation

2026-10-04 clarification: the existing fixture appends a comment outside the
bounded contract markers and asserts that the extracted contract bytes are
unchanged. Its Given now says that explicitly; the historical scenario name and
RED binding remain intact. Its evidence does not authorize retaining review
after any bounded canonical contract bytes change; the corrected R4 row owns
that case.

Actor-facing RED loop: start with an authenticated current Implementation
review, copy the installed Claude plugin, change a comment in its canonical
author source, and update the copied runtime's generated author identity to
the corresponding new bytes while leaving the installed author copy old.
Before the mutation, the same copied runtime and plugin root must report the
receipt approved; the author and reviewer projections must remain unchanged
by the appended editorial comment. This controls for changing binaries or
plugin roots during the proof.
Invoke actual `review status` and the installed phase hook with the same
project and copied distribution. The hook must refuse the stale copy, but
`review status` currently returns `REVIEW_STALE` before it can compare semantic
dependencies because packet preparation insists on exact installed author
bytes. The intended failure is the `REVIEW_STALE` status after a comment-only
canonical edit; the corrected behavior keeps the authenticated receipt current
while admission still names `canonical_contract_copy_mismatch`. Run
`NODE_OPTIONS='--import tsx' scripts/dev node node_modules/.bin/cucumber-js
features/keep-plan-reviews-current-and-trustworthy.feature --name 'Cosmetic
canonical changes preserve review currency but require copy reconciliation'`.

- [x] RED e81dbf2a1
- [x] GREEN 1d9c54b2d
- [x] REFACTOR skip: the status-only fingerprint and exact dispatch check needed no further restructuring

GREEN implementation is committed at `1d9c54b2d` and passed the focused R5
scenario, full acceptance with zero failures, and independent quality review.
The historical RED receipt went stale when RED was recorded in this ledger.
Commit `6cc4953c0` strengthened the actor proof to read receipt status after
the installed phase hook, then the exact pre-fix production bytes from
`e81dbf2a1` reproduced the intended failure in this checkout. Independent
executable RED review `07cb4cc1-1de0-49fd-8f31-e7f0fdf1b2aa` approved the
replay. Restoring current source made all 50 scenario steps pass, and the
receipt gate authorized GREEN before its checkbox was checked. The wider R5
scenario and remaining Product/Execution actor paths are still open.

## Rule: plan-implementability.TBU4.5F5ZZA.R6 — Review fallback is bounded and honestly labeled

### Scenario: The review gate follows the typed route result

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Fallback cannot bypass an available independent route

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Independent approval requires a genuinely independent reviewer

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Route selection derives independence from configured model capability

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Exhausted routes advance through the fallback ladder in order

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Local phase gates enforce the real review result

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: OpenCode CLI and TUI gates enforce the real review result

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Cloud phase gates enforce the real review result

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: plan-implementability.TBU4.5F5ZZA.R7 — Research and review context remain untrusted evidence

### Scenario: Retrieved instructions cannot change accepted scope

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Retrieved executable code remains untrusted evidence

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Private-context requests do not prevent public evidence use

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Reusable evidence records declared reuse limits

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Evidence records do not invent absent limits

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Reviewed artifacts and context remain evidence rather than instructions

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Installed review dispatch preserves the retrieved-evidence trust boundary

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: plan-implementability.TBU4.5F5ZZA.R8 — Ungated surfaces receive advisory guidance only

### Scenario: Generated Codex Cloud instructions cannot claim a gated approval

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: OpenCode Desktop guidance cannot claim a gated approval

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Generated guidance identifies gated surfaces as enforced

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: plan-implementability.TBU4.5F5ZZA.R9 — Review invalidation follows the dependency direction specified by the Execution Planning contract; this child implements the shared provenance and invalidation mechanics rather than defining a second dependency matrix

### Scenario: A declared change invalidates exactly its dependent reviews

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Invalidation follows the canonical Execution Planning dependency direction

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

Supporting typed-contract generation proof: invoke the real planning-family
generators against a copied source distribution. All three emitted phase records
must expose the eight bounded-decision fields; changing the owning Execution
contract's purpose must change its emitted value. Execution must expose the
owner-decided `upstreamImplementationInvalidation: both_plan_reviews`, while the
other phases must not acquire that field. The primary target is
`packages/cli/tests/integration/planning-contract-generation.test.ts`; invoke
`scripts/dev bun run --cwd packages/cli test tests/integration/planning-contract-generation.test.ts -t "emits typed phase contracts"`.
The missing generated record is the expected RED. This supporting proof does not
claim runtime dependency invalidation or rejection of malformed contracts; those
boundaries remain required before the scenario can be checked.

### Scenario: An unsupported upstream invalidation direction blocks reconciliation

- [x] RED 5b965631f3417952425f2549aca7e1ca6c422b7e
- [ ] GREEN
- [ ] REFACTOR

Corrective parent alignment authorized by the user's “your call” on 2026-10-04
PDT: a semantic accepted Implementation Plan change must invalidate both plan
reviews (TBU2.R11/TBU4.R9). The former own-review-only positive case becomes a
reconciliation rejection case. Historical evidence remains unchanged; this
correction requires fresh failing proof and authenticated review.

### Scenario: An undecidable Execution invalidation contract blocks reconciliation

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

Invalidation-contract rejection proof: install a fresh Cursor project
through the real source CLI, then mutate only its distribution's canonical
Execution invalidation declaration. A real upgrade must reject missing, unknown,
unknown-suffix, duplicate (including an empty duplicate), and contradictory directions with
`invalid_invalidation_contract`, the Execution phase and canonical contract path,
and unchanged installed contract bytes. The primary target is
`packages/cli/tests/integration/planning-contract-generation.test.ts`; invoke
`scripts/dev bun run --cwd packages/cli test tests/integration/planning-contract-generation.test.ts`.
Only external dependency/skills downloads are disabled. The expected RED is
`real CLI reconciliation must reject an invalid Execution invalidation contract`.
This proves reconciliation rejection, not runtime review dependency invalidation.

After the plan repair, current authenticated scenario review
`d715e7cd-82e1-4251-8a72-1bea2d154d83`, Implementation review
`3bd93757-8ffc-4a9f-93f5-fde00fb2c656`, and Execution review
`5f12374c-b953-4020-9671-14e4ac798b22` approved with no error findings;
the actual read-only CLI reported coding authorized with cross-agent evidence.
The complete unfiltered primary proof then returned seven intended failures
and 15 passes (22 tests), retained in
`/tmp/4200-complete-invalidation-reconciliation-red.log`.
Missing includes both an absent declaration and an absent entire Invalidation
field. The real generator also preserves either supported owner-decided mode.
All seven failures are the real upgrade succeeding instead of rejecting its
malformed canonical source; existing generation, shape, and shared-clause proofs
still pass. Review `0a63b905-ce92-45b8-84da-fdccaf41df7b` remains a rejected
wrong-scenario binding, not GREEN authority. A fresh independent executable
review must attest this exact reconciliation scenario before production changes.

Review `d774deea-0513-47bc-a9d2-ad99a8b74530` approved the correctly bound,
unfiltered executable RED before any production change. Its atomicity warning
identified a material proof gap: snapshotting only the Execution file could
miss earlier writes to other phase contracts. Strengthen the same accepted
scenario by generating a canonical shared-clause change before introducing the
invalid direction, confirming all three canonical phase contracts differ from
the installed snapshots, then requiring all installed bytes to remain unchanged
on rejection. This discriminates a write-before-validation implementation.
The primary proof changed, so a fresh attestation is required before GREEN;
the approved prior review is historical evidence, not current authority.
The supported-mode siblings also exercise real installation and assert the
installed owner declaration, preventing a reconciler that rejects every
canonical mode or silently hardcodes one of the two supported values from
passing this proof. The strengthened unfiltered local run retains seven
intended failures and 15 passes; its log is
`/tmp/4200-atomic-invalidation-reconciliation-red.log`.

Current executable RED `012b8333-df81-4e89-a4be-ef54bf4f5799` approved with
cross-agent evidence and no error findings before production changes. GREEN
validates the schema-owned canonical Execution reference while computing the
reconciliation plan, before applying writes. An absent Invalidation field and
an empty duplicate return the same typed undecidable-contract error; the CLI
reports its Execution phase and canonical source path as a nonretryable failure.
All 22 primary tests pass in
`/tmp/4200-atomic-invalidation-reconciliation-green.log`; all 184 tests in the
six-file generator/schema/parity/reconciliation regression pass in
`/tmp/4200-atomic-invalidation-broader-green.log`. ESLint and TypeScript pass,
and all four generated surfaces were rebuilt and verified.
The write-before-validation mutation failed all seven rejection cases at
`DISCOVERY.md must remain unchanged` (15 tests excluded), retained in
`/tmp/4200-invalidation-write-before-validation-mutation.log`; exact source
restoration preceded the passing full 184-test regression. This proves the
atomicity assertion discriminates the defect identified by the earlier review.
The complete acceptance lane still has 587 undefined and three skipped
scenarios; lifecycle copy checks, semantic identity and judged proof remain
unfinished. All 55 scenario ledgers stay unchecked. This bounded CLI loop is
not an epic completion claim or a substitute for those remaining boundaries.

### Scenario: An approving receipt is valid only for its own ticket and review kind

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Installed phase gates enforce invalidated review receipts

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: plan-implementability.TBU4.5F5ZZA.R10 — Product, Implementation, and Execution Planning contracts share one explicit contract shape while each approval remains limited to its own behavioral, design, or delivery claim

### Scenario: Each planning contract declares its bounded decision

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

Supporting Product dispatch proof: invoke the real `review run quality-review`
command against a v1 feature or epic Product Plan under the resolved namespace.
The reviewer process must receive the canonical Product phase, matched author and
reviewer identity, and bounded behavior-review instructions. A configured namespace
is honored; an unrelated same-named file, task spec, or Product Plan supplied only
as context must retain ordinary quality review. The primary target is
`packages/cli/tests/cli-protocol/review-wiring.test.ts`; invoke
`scripts/dev bun run --cwd packages/cli test tests/cli-protocol/review-wiring.test.ts -t "Product planning contract"`.
Only the external reviewer process is simulated. Admission and the other phases'
eight-field completeness remain unproved here, so keep the scenario unchecked.

Supporting contract-shape proof: invoke the real planning-family/rubric generators
for all three phases and require exactly one nonempty declaration of Purpose,
Entry criteria, Required content, Prohibited content, Review question, Approval
meaning, Invalidation, and Return path. The primary target is
`packages/cli/tests/integration/planning-contract-generation.test.ts`; invoke
`scripts/dev bun run --cwd packages/cli test tests/integration/planning-contract-generation.test.ts`.
Product already declares these fields; Implementation and Execution are the
missing behavior. This proves generated shape, not semantic judgment or phase
admission. Keep the full scenario unchecked until its remaining boundaries pass.

### Scenario: An incomplete planning contract cannot pass completeness checking

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A planning approval cannot claim its downstream state

- [x] RED ddaebbdb0cc9de196ac06ab6671c6493101b6d85
- [x] GREEN 4b71e1817
- [x] REFACTOR skip: the shared judged-eval harness was extracted at its second use; no further cleanup is needed

### Scenario: A planning approval may claim its own bounded state

- [x] RED f6469b7a6
- [ ] GREEN
- [ ] REFACTOR

## Rule: plan-implementability.TBU4.5F5ZZA.R11 — Blocking findings cite accepted requirements and expose defects or unresolved choices without letting reviewer-authored product or architecture decisions, optional strengthening, or corrected-but-unreviewed bytes pass as approved

### Scenario: Finding authority controls whether a review may block

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: The installed Implementation Plan gate enforces finding authority

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Corrected plan bytes cannot inherit the prior verdict

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A fresh verdict can clear the corrected-plan block

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: plan-implementability.TBU4.5F5ZZA.R12 — Accepted scope combines ticket, project, milestone, and inherited parent boundaries

### Scenario: No binding scope source can be omitted from review

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: The installed Implementation Plan gate enforces binding scope context

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: plan-implementability.TBU4.5F5ZZA.R13 — Completeness checks both omissions and overreach against that accepted boundary

### Scenario: Plan completeness is bidirectional

- [x] RED ddaebbdb0cc9de196ac06ab6671c6493101b6d85
- [x] GREEN 481b2cc76
- [x] REFACTOR 118e2a384

### Scenario: The installed Implementation Plan gate enforces bidirectional scope completeness

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: plan-implementability.TBU4.5F5ZZA.R14 — Reviewer corrections cannot silently expand accepted scope, and declined optional strengthening remains declined and reviewable

### Scenario: Optional strengthening changes only through user authority

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An undecided optional suggestion cannot alter or block the plan

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Installed re-review retains a declined optional strengthening

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: plan-implementability.TBU4.5F5ZZA.R15 — Architecture, data, testing, domain, research, and reviewer guidance supplies candidate decisions rather than authority to expand accepted scope

### Scenario: Guidance respects the accepted boundary

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: plan-implementability.TBU4.5F5ZZA.R16 — The Product Plan contract inventories or explicitly excludes every accepted persona's consequential success, refusal, failure, approval, trust, and recovery outcomes and keeps known facts, assumptions, and unresolved product decisions visibly distinct; scenario review separately proves coverage of every applicable outcome

### Scenario: Product Plan approval requires every accepted persona outcome

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Product Plan approval requires honest epistemic status

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Scenario review proves every applicable persona outcome

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: The installed Product Plan gate enforces persona-outcome completeness

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Feature-level cross-scenario refactor

- [ ] cross-scenario

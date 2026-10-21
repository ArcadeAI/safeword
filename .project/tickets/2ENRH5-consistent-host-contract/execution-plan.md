# Execution Plan: Reduce duplicated maintenance and agent drift

**Status:** planned
**Prepared on:** 2026-10-20

## Approval context and current state

Implementation review 5a9a9659-b391-47a5-a0bb-483da00669d6 approved the
current impl-plan.md with cross-agent independence (Codex author, Claude reviewer).
Its current plan-implementation review stamp is written. The user's upgraded
native Cursor target is 3.24.18; 3.8.23 remains a legacy compatibility target.
The ticket returned to planning after native discovery disproved the earlier
Codex root-hook and Cursor dynamic-wrapper assumptions. Canonical approve-plan
accepted the revised current plan and moved to plan-execution; approval_status
is not-required because designApprovalGate remains disabled. Current execution
review and coding-authorization must be refreshed
before production edits. Merge, publication, destructive cleanup and host trust
remain separate authorities.

Checkpoint 0d1061ae6 implements the shared renderer and isolated portable writer;
native Codex resource/precedence and Cursor resource/helper cases pass partially.
They do not complete either required group or establish enforcement. The revised
resume point is the first unproved native guard obligation in PR 1, followed by
the remaining dependency order below. Existing passing cases stay regression
evidence; do not fabricate a RED. Every changed primary proof needs its current
independent RED before corresponding new production integration.
All remaining implementation and full-group proof below are target work. The
58 scenario definitions / 94 expanded cases remain unchecked. Existing source
behavior and historical observations are baseline evidence only. The root-pinned
Codex binary reports 0.160.0; installed global Codex 0.163.0, Claude 2.1.289 and
Cursor 3.24.18 are not substitutes for the accepted exact targets. OpenCode is
not currently on PATH. A setup failure is NOT a product RED.

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

Add the independent exact Cursor CLI 2026.09.28-64d2043 target to the existing
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
- **Proof:** native-cursor-cli (real CLI process), native-cursor (real IDE E2E), native-codex (real process/root-format
  loading), and existing-regressions. Lower-level codec tests are supporting only.
- **Completion signal:** exact Cursor 3.24.18 loads the core/extension and shared
  policy through the IDE; denied sentinel remains absent, allowed sentinel is
  written, resources/helpers resolve and bounded continuation is observed.
  Exact Codex 0.160.0 separately proves root-format resources/metadata precedence
  and real guard/resource/continuation behavior in its selected native
  compatibility container, deriving content from the same canonical renderer.
  Exact Cursor CLI 2026.09.28-64d2043 separately passes its catalogue/helper,
  denied-write and allowed-write case IDs through the same generated packages;
  all three required IDs must be present before native-cursor-cli can pass.
  Default existing delivery remains supported and no unproved native mechanism
  is eligible.
- **Relies on an unmerged successor:** no. The native mechanism remains an
  isolated proved candidate; default installation/status semantics are unchanged.

### Tasks and tests

1. Prepare test infrastructure first, with no production edits. Add
   packages/cli/tests/fixtures/host-contract/targets.json for the seven exact
   version lanes, nine runtime rows and ten delivery cases, synthetic project builders, and a
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
3. RED order after the user-authorized CLI-first update: the highest-risk
   next primary proof is the actual Cursor CLI denied/allowed pair, followed
   by the separate IDE guard proof before IDE GREEN. Historical IDE catalogue
   RED/GREEN and Codex baseline evidence remain preserved, not rerun as invented
   failures. Before new production guard integration, bind
   packages/cli/tests/fixtures/host-contract/cucumber.native-cursor-cli.mjs
   to the exact CLI rows through steps/consistent-host-native-write.steps.ts
   and packages/cli/tests/helpers/cursor-cli-write.ts. Fixture cursor-cli-write
   stages an empty-native-candidate baseline only when the production generator
   is absent, and a separate native-cli-observer plugin with no permission output.
   Case IDs are cursor-cli-2026.09.28-64d2043-denied-write,
   cursor-cli-2026.09.28-64d2043-allowed-write and
   cursor-cli-2026.09.28-64d2043-catalogue-helper. All three belong to the
   independent native-cursor-cli and all-hosts required sets. The initial runner
   executes the first two and cannot pass the full group until catalogue joins.
   Run and independently review executable RED with the exact native-cursor-cli
   command above. CLI GREEN for this pair may precede IDE GREEN. Then retain
   native-cursor as a separate required IDE RED before its new guard wiring:
   scripts/dev bun packages/cli/scripts/run-host-contract-proof.ts --proof native-cursor --require-targets.
   Setup must first prove exact IDE launch and the existing project-hook positive
   control. The expected product failure is missing native catalogue/registration
   or shared-denial dispatch; missing executable, login, model, permission or test
   helper is not acceptable RED. Assert the failed native boundary by code and
   observed side effect, not a generic nonzero process.
   After that Cursor RED, add and run native-codex against the same unchanged
   production baseline before generating the core: expected failure is absent
   root-format loading or detected compatibility-overlay fallback. Keep this
   separate attested RED; step 7 is its post-implementation GREEN confirmation.
   After the guard pair, add the exact CLI catalogue row to
   cucumber.native-cursor-cli.mjs and steps/consistent-host-contract.steps.ts.
   Fixture cursor-cli-catalogue reuses createCursorCatalogueProbe from
   tests/helpers/cursor-catalogue-probe.ts in a fresh CLI config/project, loads
   the generated portable core plus native extension with --plugin-dir, and
   invokes the workflow through the CLI's native skill mechanism. Require
   workflow and referenced-guide markers plus the exact package-root helper
   command and helper marker in the same actual CLI Shell tool result. Missing
   package helper origin is exit 2 NATIVE_HELPER_ORIGIN_MISMATCH; no native skill
   invocation, wrong version, login or model failure is unavailable (3). Obtain
   its independent executable RED review before resource-closure changes. GREEN
   requires the origin-bound tool result and exact helper artifact marker,
   alongside the allowed/denied pair. Omitted catalogue remains incomplete (3).
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
   For the guard RED, first prove the existing allowed-action control in its
   separate legacy setup, then exercise the clean native fixture with test-only
   observers and bootstrap, without legacy guard dispatch supplying the result.
   Add thin steps for the exact Cursor denied/allowed outline rows and required
   IDs cursor-3.24.18-native-denied-write / cursor-3.24.18-native-allowed-write.
   Fixture cursor-native-write uses a synthetic .project/tickets/sentinel-write/
   directory and absent ticket.md sentinel: request one Shell write to that
   ticket artifact, letting current shared shell-ticket policy govern it; the
   allowed contrast writes exact random content to allowed-sentinel.txt.
   The native actor must attempt the actual tool once, not merely refuse in text.
   Missing native dispatch with the denied sentinel created is exit 2,
   NATIVE_GUARD_DISPATCH_MISSING; no actual attempt, login or discovery failure is
   unavailable (3). GREEN requires the native hook's shared policy reason and
   absent denied file, plus the allowed file's exact content and genuine native
   dispatch traces. Observers never decide permission. Obtain a fresh executable
   RED review for this primary proof before the guard integration.
6. Repeat the native RED/GREEN pair with the same real allowed and denied action;
   then invoke a changed canonical skill and referenced guide/helper marker.
   Attempt actual turn completion and observe the bounded subsequent host turn.
   Required IDE case cursor-3.24.18-bounded-continuation belongs to native-cursor
   and all-hosts. Fixture cursor-unfinished-ticket-stop in
   tests/helpers/cursor-native-continuation.ts uses a synthetic unfinished ticket,
   clean native-eligible workspace and owned user-data profile. Bind the actual
   completion outline through steps/consistent-host-native-continuation.steps.ts.
   Run the exact native-cursor command after catalogue and guard setup controls.
   RED is exit 2 HOST_CONTINUATION_MISSING when the actual IDE turn ends despite
   missing evidence; setup failures are unavailable (3). Independently review
   this RED before continuation integration. GREEN requires an actual subsequent
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
   codex-0.160.0-denied-write / codex-0.160.0-allowed-write cases using the actual
   native compatibility container and the same synthetic shell-ticket-write
   policy/allowed contrast. Native hooks/list must first show the expected
   package-bound hooks enabled and trusted; otherwise unavailable (3), never
   product RED or a trust bypass. Retain a passing pre-existing guard baseline
   as regression evidence. Required missing behavior is exposed by the relevant
   current boundary proof; do not make an already passing native case fail.
   Before closing this native-codex group, add required case
   `codex-0.160.0-bounded-continuation` in host-contract.live.test.ts, fixture
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

## PR 2 — Prove native OpenCode V2 while preserving V1

- **Purpose:** establish the version-specific V2 transport without changing V1.
- **Boundary:** an isolated V2 adapter package using Promise SDK 2.0.32, native
  transforms and typed denial; exact V1/V2 CLI/TUI proof and profile coexistence.
  Native registration remains ineligible for normal customer activation until
  package admission is implemented. Do not migrate unrelated shared policies.
- **Prerequisites:** PR 1 — Prove native Cursor delivery without changing default authority.
- **Proof:** native-opencode (actual V1/V2 CLI/TUI), coexistence (real profile
  config and installed package), existing-regressions.
- **Completion signal:** four exact OpenCode runtime rows pass their own catalogue,
  resources and allow/deny controls. V2 cannot satisfy V1 evidence. V1 reads the
  preserved profile, other projects remain unenrolled, and V2 dependency audit
  findings are resolved or explicitly adjudicated before shipping.
- **Relies on an unmerged successor:** no. The new candidate remains ineligible
  for customer cutover; V1 delivery and current public commands remain supported.

### Tasks and tests

1. RED: extend the live fixture with exact 1.18.23 and 2.0.32 executables, separate
   CLI/TUI sessions and a shared synthetic profile. Run
   scripts/dev bun packages/cli/scripts/run-host-contract-proof.ts --proof native-opencode --require-targets.
   Expected failure after successful setup is absent V2 native catalogue/shared
   guard. V1 baseline must continue to pass.
2. GREEN: add the isolated V2 package at packages/opencode-v2-plugin with only
   its @opencode/plugin 2.0.32 dependency and generated canonical resources.
   Use ctx.skill.transform, ctx.command.transform and Tool.Error. Do not add the
   V1 module to V2 or introduce Effect into the shared runtime. Exercise the
   guidance worker bridge through actual fresh-context delegation; unsupported
   tool/context constraints remain unmet. Use the v2-worker-fresh-context and
   v2-worker-forbidden-action CLI/TUI case IDs in native-opencode's required
   manifest, fixture v2-enrolled-worker with a parent-only nonce and a canonical
   restricted worker procedure. Invoke the real delegation entrypoint. RED is
   context leakage or a forbidden tool/authority side effect; GREEN observes a
   fresh worker context and rejects the paired forbidden action. Missing host
   capability reports the actual unmet guarantee and cannot clear these cases.
3. Add packages/cli/tests/host-contract/opencode-coexistence.test.ts. Invoke the
   actual lifecycle/profile merge against a singular V1 plugin field and plural
   V2 plugins field, then launch both real hosts on the result. V2 setup reads
   profile-local checkout enrollment and stays inert elsewhere. Record native
   discovery of retained V1 catalogue files as guidance only, never guard proof.
   Assert unchanged user values and preservation of V1 module/resources.
4. Add required/optional registration rejection controls through real V2
   registration, plus allowed/denied writes and clean-project guide/helper
   invocation in each CLI/TUI row. Write separate exact-bound receipts.
   RED for rejection controls is a required registration failure still reported
   active, or an optional failure incorrectly disabling the observed independent
   guard. GREEN must observe real host rejection plus the actual affected claim.
   Run scripts/dev bun packages/cli/scripts/run-host-contract-proof.ts --proof native-opencode --require-targets
   with the v2-required-registration, v2-optional-registration and all four
   CLI/TUI allow-deny-resource case IDs in that group's required manifest.
   RED exits 2 naming V2_REQUIRED_REGISTRATION_STILL_ACTIVE,
   V2_OPTIONAL_FAILURE_HIDES_GUARD, DENIED_SIDE_EFFECT_OBSERVED or
   ALLOWED_SIDE_EFFECT_MISSING as applicable. GREEN exits 0 only after every
   corresponding real-host case ID passes with its separate exact-bound receipt.
5. Audit the full locked V2 dependency tree, including Effect 4.0.1, using
   scripts/dev bun audit in the isolated package/workspace. Retain dependency
   identities and adjudication; an SDK-only advisory lookup is insufficient.
   Record MIT attribution if substantial upstream source is actually copied.
6. REFACTOR: isolate V1 and V2 transport while sharing canonical content and
   policy. Run native-opencode, coexistence, and existing-regressions, then the
   per-slice verification sequence.

## PR 3 — Remove parallel authoring across the complete shipped inventory

- **Purpose:** make one authoritative content/policy edit reach every host.
- **Boundary:** complete discovered content and handler inventory, all host
  dispositions, shared owner adoption, generator/architecture checks and
  before/after ownership evidence. Keep live native customer cutover ineligible.
- **Prerequisites:** PR 1 — Prove native Cursor delivery without changing default authority;
  PR 2 — Prove native OpenCode V2 while preserving V1.
- **Proof:** repository-boundaries, repository-current, propagation, owner-delta,
  owner-current, policy-options and existing-regressions. Fixture mutations diagnose mechanisms;
  repository-current and owner-current prove the actual repository's adoption.
- **Completion signal:** every source facet and configured handler has exactly one
  owner and complete lane dispositions; the existing shared-policy and shared-skill
  changes propagate without per-host authored edits; all deliberate drift/bypass
  mutations fail for their named reason and pass after repair. Recorded owner
  deltas identify removed independent maintenance, not fewer emitted files.
- **Relies on an unmerged successor:** no. Current default deliveries use the
  consolidated sources and remain supported; new native mechanisms stay
  ineligible until admission, rather than needing a successor to be safe.

### Tasks and tests

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
   SETTINGS_HOOKS, CURSOR_HOOKS, Codex and both OpenCode dispatch inventories,
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
   host-contract.live.test.ts with fixture `claude-2.1.170-installed-contract`:
   isolated authenticated profile, actual generated native Claude plugin, trusted
   package registration and synthetic project with unfinished ticket/config. Reuse
   the native process/discovery mechanics of claude-plugin-discovery.live.test.ts;
   never use the global newer Claude as the target. Run
   scripts/dev bun packages/cli/scripts/run-host-contract-proof.ts --proof native-claude --require-targets.
   Required case IDs: claude-2.1.170-denied-write, claude-2.1.170-allowed-write,
   claude-2.1.170-catalogue-helper, claude-2.1.170-bounded-continuation. Each drives
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
6. Add packages/cli/tests/host-contract/propagation.live.test.ts and the propagation
   runner group: mutate only the existing canonical verification-marker policy,
   refresh normally without a host list and invoke all nine real runtime rows.
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
   Bind this real-repository step to owner-current: run
   scripts/dev bun packages/cli/scripts/check-host-contract.ts --owner-delta --baseline f48275b5e616010f3ce76bf5baf7329603f9ac57 --candidate HEAD --json.
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
  PR 2 — Prove native OpenCode V2 while preserving V1;
  PR 3 — Remove parallel authoring across the complete shipped inventory.
- **Proof:** admission, sealed-writer, native-codex, native-cursor, cursor-legacy, lifecycle, propagation,
  all-hosts, acceptance, documentation and delivery-review; all required on final
  shipped bytes, not retained only from a pilot or PR 3.
- **Completion signal:** all 58 definitions / 94 examples and final required
  exact-target proofs pass; repeated selected-host operations preserve ownership,
  unselected sentinels remain untouched, no competing active authorities occur,
  and status reports only the actual applicable guarantee. Every contributor
  Delivery Checklist item has current proof. Human merge/publication authority
  remains outside this feature.
- **Relies on an unmerged successor:** no. This completes the accepted local
  scope and leaves all supported hosts usable.

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

   | Fixture / action | Expected RED defect | Required GREEN result |
   | --- | --- | --- |
   | before-publication: hold the real publication lock, start the controller, observe its wait, terminate it before releasing the lock, then read status | Partial/unsealed state is admitted as evidence | Child termination is recorded; no published receipt exists; real admission exits 2 for missing evidence and never reports success |
   | identical-retry: resume the same owned checkpoint with identical run/input/observation identity twice | Retry creates a different receipt or another authority | Both controller calls exit 0 and return the identical receipt ID; one immutable record exists |
   | conflicting-duplicate: resume the same capture ID with a different committed input/observed identity | Existing receipt is overwritten or conflict accepted | Controller exits 2 naming conflicting identity; original receipt bytes and admitted meaning remain unchanged |
   | foreign-profile: copy a valid sealed run into another isolated profile without its key | Foreign receipt satisfies that profile's admission | Actual status/completion exits 2 for integrity/origin mismatch, no healthy guarantee; no key is copied |
   | missing-key: remove the fixture controller key after valid capture, then read the run | Reader recreates authority or accepts unsigned evidence | Admission exits 2 with missing integrity authority, no admitted guarantee and no synthetic passing replacement |
   | failed-then-passed: real target attempt fails, then the same exact target succeeds through the controller | Failure disappears, a different version fills the lane or stale failure blocks current matching success | Both attempts remain immutable, latest same-target success is applicable; different-version success leaves the failed required lane unmet (exit 2) |

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
   Explicitly generate and validate package conformance declarations for the
   maintained Claude 2.1.170, Codex 0.160.0, OpenCode V1 1.18.23 CLI/TUI
   and legacy Cursor 3.8.23 IDE delivery classes, including supported non-default
   policy combinations. Missing entries
   block this slice; completion means ordinary upgrade retains the active
   outcome with no customer conformance task. This also owns final real-CLI
   rejection for partial propagation, unavailable required guarantees and V2
   evidence submitted for V1, using those actual lane-keyed sealed stores.
   For cursor-legacy, add exact-version-prefixed legacy cases
   (`cursor-3.8.23-project-hooks-*` and `cursor-3.24.18-project-hooks-*`) to host-contract.live.test.ts and admission.test.ts. Run
   scripts/dev bun packages/cli/scripts/run-host-contract-proof.ts --proof cursor-legacy --require-targets.
   Its two fixtures run exact Cursor 3.8.23 and exact Cursor 3.24.18, each with
   real installed project hooks/resources,
   no native cache/enrollment and a declaration from the trusted CLI resource
   identity. Observe actual catalogue/helper, allow/deny and bounded completion
   through the IDE, then upgrade and invoke real status. RED is exit 2 naming
   LEGACY_CURSOR_PROOF_MISSING or LEGACY_CURSOR_STATUS_REGRESSED after valid host
   setup. Its required manifest derives both project-hooks variants from targets.json
   and requires, for each version prefix, catalogue-helper, allowed-write,
   denied-write, bounded-completion and upgraded-unenrolled-status. Missing either
   version or any case is exit 3, never success. The nine runtime rows contain
   ten delivery cases: eight native cases plus these two legacy IDE cases.
   GREEN is exit 0 only with all ten legacy case IDs, current legacy
   activation and healthy actual legacy guarantee. Tampering project resources,
   submitting native proof for legacy or removing required legacy evidence must
   remain exit 2. This is required automated proof, a delivery variant of the
   existing Cursor rows rather than additional host/runtime rows. Publish its
   declaration in the trusted CLI resource identity before exposing the new
   status rule; user-editable project JSON cannot certify it. Include it in
   final all-hosts and lifecycle second-clone checks. A cache-free cloud-like
   profile keeps its pre-existing configuration-scoped result/exit and never
   receives desktop-derived active enforcement.
4. Add packages/cli/tests/host-contract/lifecycle.test.ts and perform real
   install/upgrade/repair/uninstall on disposable historical mixed-host projects.
   Use modified/unverifiable/current-collision assets, authored tickets/learnings,
   user hooks, unselected executable sentinels and byte snapshots. Assert the
   selected integration actually works after each operation while the unselected
   host is neither probed nor enrolled. Repeat operations for idempotency.
5. Implement local enrollment and Cursor's session authority handshake under
   project-then-profile locks; retain shared hooks/resources. Use two projects
   sharing a profile, two clones of the same Git repository, separate windows,
   mixed-root workspaces and cache-free cloud-like profiles. Exercise actual IDE
   guards for native/legacy selection; cache-free cloud-like checks prove only
   regression of the existing project-hook boundary. Crash before/after enrollment,
   registration and handshake; race a sibling edit. Recover to one active owner.
   Missing native readiness must preserve legacy authority.
   Native fixtures have no competing project workflow wrappers. In the two-clone
   legacy fixture, both clones retain tracked static references, even if one
   profile requests native enrollment: native stays ineligible and actual IDE
   guidance/guards remain legacy. Separately prove enrollment and recovery on
   the clean native-eligible project. Do not turn one legacy clone native by
   rewriting shared tracked files. Assert actual loaded rule/command markers
   with the resolver unavailable as well as hook dispatch and byte preservation.
   In the Cursor 3.24.18 continuation-cap fixture, use synthetic unfinished work
   that keeps the shared completion requirement unmet. Drive actual IDE turn
   completions through its version-specific observed auto-submission cap, retain the real
   loop/event observations and confirm no additional automatic turn starts.
   Status/completion admission must retain the unmet requirement and the actual
   bound. This case is required in native-cursor and all-hosts; a mutated
   loop_count payload or one observed follow-up cannot satisfy it.
   Establish that cap on 3.24.18 before the case; the earlier 3.8.23 five-turn
   observation belongs only to the retained legacy proof and cannot supply it.
6. Keep Claude/Codex's existing per-event live-proof contraction intact.
   Codex shipping is owned here: before changing its generated production bundle,
   add a RED that installs the actual packages/cli/codex-plugin carrier through
   the real packaged lifecycle in a fresh Codex 0.160.0 profile. It must fail if
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
   0.160.0 enforcement package; the pinned loader suppresses hooks for that format.
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
   Preserve V1 configuration/resources during V2 activation. Test controlled downgrade
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

   | Case and fixture | File / proof | Actual command or actor | RED failure / GREEN assertion |
   | --- | --- | --- | --- |
   | Strongest verified mechanism; legacy-first-discovery with both verified native and compatibility candidates | admission.test.ts / admission | status --json --no-input | RED chooses discovery-first mechanism or omits selected guarantee; GREEN exits 0 and names the higher-ranked verified native candidate, one active owner |
   | Permitted weaker alternative; preferred-unavailable-permitted-observation | admission.test.ts / admission | status --json --no-input | RED claims denial or refuses a centrally permitted usable alternative; GREEN exits 0 for the satisfied requirement and reports only observation, its proof and limitation |
   | Unauthorized weaker fallback; same candidates without shared-policy permission | admission.test.ts / admission | status --json --no-input | RED accepts adapter-invented fallback; GREEN exits 2 with unmet guarantee and no stronger claim. The PR 3 mutation check separately rejects the adapter-local owner |
   | Routine adaptation; selected-host-ready with complete current package/activation proof | lifecycle.test.ts / lifecycle | install --json --no-input, then actual selected-host guard action | RED requests a host/packaging design choice or fails usable selected delivery; GREEN exits 0 with no requires-human packaging action and the genuine allowed/denied controls pass without a host list |
   | Routine reevaluation; unchanged permitted-alternative identity | admission.test.ts / admission | status --no-input twice, then status --json --verbose | RED repeats the same limitation notice; GREEN emits at most the initial transition notice and still exposes the actual alternative/limit in on-demand details |
   | Technical proof on demand; active-verified selected host | admission.test.ts / admission | status --json --verbose --no-input | RED omits or misattributes technical proof; GREEN exits 0 with actual mechanism, guarantee, method and matching host/package/configuration identities |
   | Trust-dependent repair; installed-but-untrusted selected profile | lifecycle.test.ts / lifecycle | install --json --no-input | RED changes user trust or reports active; GREEN exits 2 with the exact supported requires-human trust/restart action and byte-identical trust values |
   | Impossible required guarantee; selected lane has no verified satisfying mechanism or permitted alternative | admission.test.ts / admission | status --json --no-input and doctor --json --no-input | RED silently weakens or claims success; GREEN exits 2, names the requirement/host limit and concrete supported recovery rather than asking for technical redesign |
   | Recoverable repair; missing proven-owned helper with otherwise valid selected package/trust | lifecycle.test.ts / lifecycle | install --json --no-input, then actual host invokes restored helper/guard | RED asks a design choice, clobbers user content or leaves the helper unusable; GREEN exits 0 after safe restoration, actual host controls pass and unrelated files/selection remain unchanged |

   Finish central ranking, truthful alternatives, notice identity/deduplication
   and existing-command repair to satisfy these cases. Preserve Product and
   required guarantees. Real host actors belong to lifecycle; admission-only
   fixtures cannot supply their host evidence.
8. Wire repository-boundaries, generated-surface checks and lane-derived
   conformance admission into existing CI/CLI-contract gates. Run actual check
   processes on mutation trees; require originating exact-target results for the
   producing commit. Other jobs consume commit-bound checks, never foreign local
   receipt keys. Required unavailable/manual-only lanes stay incomplete.
9. Finish steps/consistent-host-contract.steps.ts using the approved fixtures
   and actual entrypoints; map every exact scenario name and each outline row.
   Keep host-required cases bound to genuine host evidence, never a simulated
   payload. First run the test-owned configuration over the entire in-progress
   feature, asserting the complete expected set. Once all corresponding cases
   pass, remove their @wip tags, then record acceptance through the required
   runner wrapping the ordinary root acceptance command. Parse Cucumber's JSON
   result and compare executed URI/scenario/example-row identities against all
   pickles compiled independently from the approved source: exactly 58 scenario
   definitions and 94 expanded examples, all passed. Zero/filtered/duplicate or
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
2. Run scripts/dev bun run safeword install for current selected dogfood delivery.
   Do not enroll a new host or replace the user's development plugin to test it.
3. Run scripts/dev bun packages/cli/scripts/check-generated-surfaces.ts and
   scripts/dev bun scripts/parity-check.ts --mode=all.
4. Run each slice's targeted proofs sequentially, then scripts/dev bun run typecheck,
   scripts/dev bun run lint and scripts/dev bun run build.
5. Run the full package suite once for final verification before each slice commit:
   ../../scripts/dev bun run test from packages/cli. Re-run only on changes or
   failures. Review final native/package identities after regeneration; earlier
   proof cannot certify changed payloads without valid current proof.
6. At PR 4, run acceptance through the required runner (which executes
   scripts/dev bun run test:bdd:acceptance features/consistent-host-contract.feature
   and validates all 58 definitions / 94 examples) and run all-hosts. Record exact commands, revisions, seals and
   outcomes through the Delivery Checklist/verification paths, not prose claims.

Required host runner group wiring is explicit:
native-cursor-cli dispatches cucumber.native-cursor-cli.mjs, with cursor-cli-write
and a catalogue CLI actor in steps/consistent-host-contract.steps.ts for the
three exact case IDs in PR 1 task 3. All-hosts includes those three IDs in
addition to every retained IDE and other host ID. The initial paired write pilot
returns incomplete until the catalogue case is wired; a passing pair alone is
not native-cursor-cli completion.
coexistence runs opencode-coexistence.test.ts for real lifecycle/JSONC checks and
then the four actual V1/V2 CLI/TUI coexistence cases in host-contract.live.test.ts;
lifecycle runs lifecycle.test.ts for CLI/filesystem mutation and then the actual
IDE/process post-operation cases in host-contract.live.test.ts. Native groups
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

| Accepted obligation | Owning PRs |
| --- | --- |
| All nine Rules and every scenario below | PR 1, PR 2, PR 3, PR 4 |
| Two small registry/schema contracts, one content/policy owner, complete inventory including extra lifecycle facets | PR 1, PR 3 |
| Direct portable core, Codex extension precedence, thin native Cursor extension and executable resource closure | PR 1, PR 3 |
| Isolated Promise SDK V2, fresh worker-context/tool constraints, V1/V2 CLI/TUI separation and full dependency audit | PR 2 |
| Shared-policy propagation, shared-skill propagation, independent completeness and mutation controls | PR 3 |
| Before/after committed owner graph, removed independent edit paths and reproducible derived outputs | PR 3 |
| Sealed activation/conformance/owner writers, exact identity, failed-attempt retention and immutable release declarations | PR 1, PR 2, PR 3, PR 4 |
| Supported option composition, native guarantee ranking and truthful active/alternative/unmet/recovery status | PR 3, PR 4 |
| Local enrollment, shared tracked compatibility, multi-project/clone/root/profile isolation and legacy cloud-boundary preservation | PR 1, PR 2, PR 4 |
| Locks, stale plans, atomic publication, crash recovery, controlled downgrade, no user-data clobber and reference-aware uninstall | PR 4 |
| Maintainer single-authoring, TBU evidence/trust/controls, NTB invisible routine flow and bounded recovery | PR 3, PR 4 |
| Claude, Codex, Cursor, OpenCode and Agent Plugins 1.0 affected surfaces; CLI status/lifecycle and normal derivation | PR 1, PR 2, PR 3, PR 4 |
| No invented percent/time saving; exact full inventory/lane population and one-authoritative-edit evidence | PR 3, PR 4 |
| README/website/contributor docs, architecture status and required CI checks | PR 4 |
| Final actual-host demo, all accepted cases, current verification and independent delivery review | PR 4 |

### Exact scenario ownership

Every row below preserves its impl-plan.md proof strategy. Host rows require the
named native proof groups plus final all-hosts; repository and admission rows use
their real CLI/process boundaries. Outline examples retain every approved row.

| Scenario | Owning PRs |
| --- | --- |
| One shared policy change reaches every applicable agent | PR 3 |
| One shared skill change reaches every applicable agent | PR 3 |
| A partially propagated revision cannot satisfy the shared change | PR 3, PR 4 (final admission) |
| An interface that leaves parallel policy ownership does not count as consolidation | PR 3 |
| Completed consolidation identifies removed maintenance paths | PR 3 |
| Coverage includes every supported host without an author checklist | PR 3 |
| A missing host disposition prevents completion | PR 3 |
| A newly shipped component cannot disappear from coverage | PR 3 |
| The inventory includes handlers beyond the five common events | PR 3 |
| An explicit limitation cannot replace proof of a required guarantee | PR 3, PR 4 (final admission) |
| A proved OpenCode V2 lane cannot cover an unproved V1 lane | PR 3, PR 4 (final admission) |
| New host capability cannot introduce a second shared policy owner | PR 3 |
| New host capability extends mechanics while preserving shared policy | PR 3 |
| A stale generated host output fails the required check | PR 3 |
| Refreshing required outputs restores agreement | PR 3 |
| A host route cannot evade a shared denial | PR 3 |
| A route applying the shared decision passes boundary validation | PR 3 |
| Independent host policy cannot become another authority | PR 3 |
| A package declaration cannot substitute for runtime proof | PR 4 |
| Evidence from a different host version cannot satisfy the required target | PR 4 |
| Manual host observation cannot count as an automated check | PR 4 |
| Failed required target execution cannot be replaced silently | PR 4 |
| Applicable automated target evidence satisfies the plugin claim | PR 4 |
| The strongest verified satisfying mechanism is selected | PR 3, PR 4 |
| A permitted weaker alternative reports its actual guarantee | PR 3, PR 4 |
| An adapter cannot invent a weaker fallback | PR 3, PR 4 |
| A denied action has no side effect | PR 1, PR 2, PR 3, PR 4 |
| An allowed action reaches the side-effect boundary | PR 1, PR 2, PR 3, PR 4 |
| Ticket rejection cannot masquerade as conversation continuation | PR 1, PR 2, PR 3, PR 4 |
| Conversation continuation cannot masquerade as ticket-transition enforcement | PR 1, PR 2, PR 3, PR 4 |
| A supported completion guard actually continues the conversation | PR 1, PR 2, PR 3, PR 4 |
| Applicable activation and conformance evidence reports protection active | PR 4 |
| Unavailable activation cannot inherit a healthy claim | PR 4 |
| Invalidated evidence cannot retain the previous protection claim | PR 4 |
| A rejected required registration invalidates its guarantee | PR 4 |
| An optional registration failure does not conceal unrelated usable protection | PR 4 |
| Exhausted continuation cannot be advertised as unlimited enforcement | PR 4 |
| OpenCode Desktop cannot inherit CLI or TUI enforcement proof | PR 4 |
| Routine adaptation needs no packaging or host checklist decisions | PR 4 |
| Routine reevaluation does not repeat limitation warnings | PR 4 |
| Technical proof remains available on demand | PR 4 |
| A repair requiring user trust does not silently bypass authorization | PR 4 |
| An impossible required guarantee produces actionable recovery | PR 4 |
| Recoverable integration failure is repaired without asking for design choices | PR 4 |
| A host limitation cannot lower a requirement silently | PR 4 |
| A host loads bundled content without an unnecessary generated copy | PR 1, PR 2, PR 3 |
| Necessary format translation preserves canonical content | PR 1, PR 2, PR 3 |
| Native delivery exposes the contracted catalogue | PR 1, PR 2, PR 3 |
| Portable package loading proves only its portable components | PR 1, PR 2, PR 3 |
| Duplicate native and compatibility registration is rejected | PR 1, PR 2, PR 4 |
| OpenCode V1 retains its separately proved behavior | PR 2, PR 3 |
| Upgrading a mixed-host project preserves authored work | PR 4 |
| Unproven legacy ownership cannot authorize deletion | PR 4 |
| A current asset cannot be retired by a legacy cleanup collision | PR 4 |
| Repeating completed installation creates no additional authority | PR 4 |
| Interrupted migration recovers without activating two authorities | PR 4 |
| Uninstalling one host preserves another host's shared resources | PR 4 |
| Unselected hosts are not probed or enrolled | PR 4 |

## Deferred scope ownership

- skip: no accepted obligation is deferred. Upstream API changes, new Cloud or
  OpenCode Desktop enforcement, unrelated workflow/preset changes, public release,
  merging and destructive project-wide compatibility retirement remain excluded
  by this ticket. No other ticket is used as completion evidence.

## Decision accounting

| Recorded Decision in impl-plan.md | Status |
| --- | --- |
| Shared authority and host adaptation | unchanged |
| Native and portable packaging | unchanged |
| OpenCode V2 transport | unchanged |
| Evidence and guarantee selection | unchanged |
| Customer status evidence | unchanged |
| Customer version applicability | unchanged |
| Ownership transition | unchanged |
| Independent completeness and maintenance evidence | unchanged |

All new paths are target implementation, currently without passing receipts.
Every command runs sequentially. Named runner groups derive their lanes and
fixtures from the canonical contract plus independent intended-facet test oracle;
the contributor never supplies a host checklist. The runner's required mode
asserts its complete expected population before returning success.

## Proof specifications

| Proof ID | Method | Scope | Boundary exercised | Qualifies as | Currency | Invocation |
| --- | --- | --- | --- | --- | --- | --- |
| native-cursor-cli | command | E2E | Exact Cursor CLI 2026.09.28-64d2043 loads the same generated extension and portable core, with separate real tool-result evidence for writes and catalogue; cannot satisfy IDE rows | real_boundary | current_required | {"type":"command","cwd":".","argv":["scripts/dev","bun","packages/cli/scripts/run-host-contract-proof.ts","--proof","native-cursor-cli","--require-targets"]} |
| native-cursor | command | E2E | Exact 3.24.18 IDE loads core/extension and genuinely dispatches shared guards, resources and continuation | real_boundary | current_required | {"type":"command","cwd":".","argv":["scripts/dev","bun","packages/cli/scripts/run-host-contract-proof.ts","--proof","native-cursor","--require-targets"]} |
| cursor-legacy | command | E2E | Exact 3.8.23 and 3.24.18 IDEs retain project-hook guarantees and upgraded unenrolled status using CLI-owned conformance identity, with no native cache | real_boundary | current_required | {"type":"command","cwd":".","argv":["scripts/dev","bun","packages/cli/scripts/run-host-contract-proof.ts","--proof","cursor-legacy","--require-targets"]} |
| native-claude | command | E2E | Exact Claude 2.1.170 installed native plugin proves denied/allowed writes, canonical catalogue/helper origin and actual bounded continuation | real_boundary | current_required | {"type":"command","cwd":".","argv":["scripts/dev","bun","packages/cli/scripts/run-host-contract-proof.ts","--proof","native-claude","--require-targets"]} |
| native-codex | command | integration | Exact 0.160.0 separately proves portable resource precedence and selected compatibility-container guards/resources/continuation; resource-only proof cannot establish enforcement | real_boundary | current_required | {"type":"command","cwd":".","argv":["scripts/dev","bun","packages/cli/scripts/run-host-contract-proof.ts","--proof","native-codex","--require-targets"]} |
| native-opencode | command | integration | Exact V1/V2 CLI/TUI processes load actual packages and execute catalogue/allowed/denied actions | real_boundary | current_required | {"type":"command","cwd":".","argv":["scripts/dev","bun","packages/cli/scripts/run-host-contract-proof.ts","--proof","native-opencode","--require-targets"]} |
| coexistence | command | integration | Actual V1/V2 processes read preserved profile configuration and separate project enrollments | real_boundary | current_required | {"type":"command","cwd":".","argv":["scripts/dev","bun","packages/cli/scripts/run-host-contract-proof.ts","--proof","coexistence","--require-targets"]} |
| repository-boundaries | command | integration | Required repository check processes reject source/output/owner/bypass mutations in disposable trees | real_boundary | current_required | {"type":"command","cwd":"packages/cli","argv":["../../scripts/dev","bun","run","test","tests/host-contract/repository-boundaries.test.ts"]} |
| propagation | command | E2E | A canonical policy/skill change is observed across every exact actual host/runtime including IDE | real_boundary | current_required | {"type":"command","cwd":".","argv":["scripts/dev","bun","packages/cli/scripts/run-host-contract-proof.ts","--proof","propagation","--require-targets"]} |
| sealed-writer | command | integration | Production trusted controller processes use real locks, atomic sealed writes and readers for retry, crash, key and history cases | real_boundary | current_required | {"type":"command","cwd":"packages/cli","argv":["../../scripts/dev","bun","run","test","tests/host-contract/evidence-writer.test.ts"]} |
| policy-options | command | integration | Actual installed helper subprocess consumes documented configuration combinations through the shared policy owner | real_boundary | current_required | {"type":"command","cwd":"packages/cli","argv":["../../scripts/dev","bun","run","test","tests/host-contract/policy-options.test.ts"]} |
| repository-current | command | integration | Required check against the actual unmutated working tree proves complete shipped inventory, dispositions, sole owners and projections | real_boundary | current_required | {"type":"command","cwd":".","argv":["scripts/dev","bun","packages/cli/scripts/check-host-contract.ts","--json"]} |
| owner-current | command | integration | Actual baseline-to-HEAD committed repository capture validates the complete expected retired-owner set and retained mechanics | real_boundary | current_required | {"type":"command","cwd":".","argv":["scripts/dev","bun","packages/cli/scripts/check-host-contract.ts","--owner-delta","--baseline","f48275b5e616010f3ce76bf5baf7329603f9ac57","--candidate","HEAD","--json"]} |
| owner-delta | command | integration | Trusted capture entrypoint recomputes committed source graphs and exposes retired independent owners | real_boundary | current_required | {"type":"command","cwd":"packages/cli","argv":["../../scripts/dev","bun","run","test","tests/host-contract/owner-inventory.test.ts"]} |
| admission | command | integration | Public status/conformance/completion commands read real sealed stores and reject inapplicable proof | real_boundary | current_required | {"type":"command","cwd":"packages/cli","argv":["../../scripts/dev","bun","run","test","tests/host-contract/admission.test.ts"]} |
| lifecycle | command | E2E | Real selected lifecycle operations plus actual host use prove clone/profile isolation and single-owner recovery | real_boundary | current_required | {"type":"command","cwd":".","argv":["scripts/dev","bun","packages/cli/scripts/run-host-contract-proof.ts","--proof","lifecycle","--require-targets"]} |
| all-hosts | command | E2E | Final exact nine runtime rows, complete catalogue/resources, allow/deny/continuation and demo composition | real_boundary | current_required | {"type":"command","cwd":".","argv":["scripts/dev","bun","packages/cli/scripts/run-host-contract-proof.ts","--proof","all-hosts","--require-targets"]} |
| acceptance | command | integration | Actual Cucumber actors plus independently compiled complete 58-definition/94-example population; reject filtered, zero, skipped or omitted cases | real_boundary | current_required | {"type":"command","cwd":".","argv":["scripts/dev","bun","packages/cli/scripts/run-host-contract-proof.ts","--proof","acceptance","--require-targets"]} |
| existing-regressions | command | integration | Existing CLI plugin/lifecycle/resource behavior remains usable | real_boundary | current_required | {"type":"command","cwd":"packages/cli","argv":["../../scripts/dev","bun","run","test","tests/lifecycle/","tests/claude-plugin/","tests/codex-plugin/","tests/opencode/","tests/plugin-resource-contract.test.ts","tests/cursor/","tests/cursor-shell-gate.test.ts","tests/integration/cursor-pretooluse-gate.test.ts","tests/integration/cursor-stop-review.test.ts"]} |
| documentation | review_receipt | integration | Independent review of final user/contributor guidance and surface inventory against implemented behavior and guarantees | real_boundary | current_required | {"type":"review_receipt","kind":"quality-review","targets":["AGENTS.md","ARCHITECTURE.md",".project/architecture-decisions/shared-host-contracts.md",".project/surfaces.md","README.md","packages/website/src/content/docs/getting-started/quick-start.mdx","packages/website/src/content/docs/reference/configuration.mdx","packages/website/src/content/docs/reference/hooks-and-skills.mdx","packages/website/src/content/docs/reference/cli.mdx"]} |
| delivery-review | review_receipt | integration | Independent final review of actual contract ownership, native adapters, evidence and recovery implementation | real_boundary | current_required | {"type":"review_receipt","kind":"quality-review","targets":["packages/cli/src/lifecycle","packages/cli/src/host-contract","packages/cli/src/commands","packages/opencode-v2-plugin","packages/cli/templates/hooks","packages/cli/scripts/run-host-contract-proof.ts"]} |
| generated | command | integration | Deterministic generated-surface synchronization only | partial_or_structural | current_required | {"type":"command","cwd":".","argv":["scripts/dev","bun","packages/cli/scripts/check-generated-surfaces.ts"]} |

## Delivery checklist

<!-- safeword:delivery-checklist:v1 -->

| ID | Category | Obligation | Owner | Required proof | Disposition | Evidence class | Revision | Evidence, reason, or dependency |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| isolated-hook-trust | ownership and human dependencies | Grant any host-required native hook trust for isolated Claude/Codex proof profiles; never bypass or change regular profiles | human | | pending_human | missing | | User grants the exact test-profile trust only if the host requires a fresh grant; OS Accessibility is already authorized and working. Does not block test scaffolding or code review, but required live guard proof cannot complete without applicable trust |
| outcome-scope | outcome and scope | Complete shared-policy and shared-skill propagation across the exact required host population without an author host list | contributor | propagation | open | missing | | |
| resolved-decisions | resolved decisions | Preserve accepted contracts, sole writers, packaging, supported option composition and guarantee meanings in actual code | contributor | delivery-review | open | missing | | |
| pr-decomposition | dependency and pull-request decomposition | Every proposed slice preserves usable existing default delivery without an unmerged successor | contributor | existing-regressions | open | missing | | |
| testing | testing | All exact native host/runtime rows prove resource closure, allow/deny and applicable bounded continuation | contributor | all-hosts | open | missing | | |
| data-compatibility | data and compatibility | Public CLI preserves supported option combinations and rejects stale/foreign/corrupt or method-mismatched evidence | contributor | admission | open | missing | | |
| legacy-cursor-status | data and compatibility | Upgraded unenrolled Cursor retains actual project-hook guarantees and healthy proved status without desktop proof transfer to Cloud | contributor | cursor-legacy | open | missing | | |
| monitoring | monitoring and failure signals | Status/doctor expose actual active, limited, unmet and recovery states without repeated unchanged notices | contributor | admission | open | missing | | |
| security-privacy | security and privacy | Reject forged proof and unauthorized trust/cleanup; keep controller keys and customer data out of host fixture artifacts | contributor | admission | open | missing | | |
| evidence-integrity | security and privacy | Real controller publication, duplicate/retry handling, profile-key isolation and immutable failure history cannot manufacture authority | contributor | sealed-writer | open | missing | | |
| rollout-rollback | rollout and rollback | Proved cutover, second-clone/shared-profile preservation, crash recovery, controlled downgrade and selected uninstall retain one authority | contributor | lifecycle | open | missing | | |
| documentation | documentation | Explain canonical contribution, actual host limits and automatic install/status/recovery in README and configured website | contributor | documentation | open | missing | | |
| ownership-dependencies | ownership and human dependencies | Prove actual committed repository sole ownership, exact retired maintenance paths and necessary translations without transferring authority | contributor | owner-current | open | missing | | |
| repository-completeness | completion evidence | Actual working tree has complete source/handler inventory, lane dispositions and sole owners; fixture-only success cannot certify adoption | contributor | repository-current | open | missing | | |
| completion-evidence | completion evidence | Every accepted scenario and outline row has current actual-boundary evidence; no unavailable lane or stale output counts as complete | contributor | acceptance | open | missing | | |

### Customer compatibility controls

Before PR 4 admission/status is GREEN, extend `admission` with public-CLI cases
for old package/new CLI healthy (exit 0 plus advisory unproved contract) and
unhealthy (unchanged existing failure), new contracted package/missing required
proof (action_required), and unchanged binding families on supported upgraded
hosts. The actual upgraded-host controls belong to the required-target `all-hosts`
runner, not Vitest admission fixtures: `claude-2.1.289-compatible-upgrade`,
`codex-0.163.0-compatible-upgrade`, and the `cursor-3.24.18-project-hooks-*`
cases above. Require real activation plus catalogue/helper and allow/deny outcomes
for each upgraded host and actual public status. Missing hosts/case IDs are
nonzero unavailable. Exact reference targets remain separately required. Assert observed and reference versions remain distinct and details
identify `binding-compatible` versus `exact-runtime-tested`. Negative controls
change protocol, capability, delivery kind and continuation boundary separately;
reject only affected claims. A family classification never clears an absent
exact-target receipt or causes an automatic customer conformance run.

OpenCode coexistence also starts V2 on a populated V1 profile with a unique V1
hook marker: V2 must not execute it; a following real V1 turn must execute it.
Preserve all V1 profile fields and use separately named CLI/TUI runs.


Renewal-specific admission controls use the same policy-compatible version
upgrade with (1) unchanged old activation, rejected; (2) fresh native activation
bound to the exact observed host/config/trust/epoch and a validated sealed policy,
producing a renewed derived binding-compatible proof chain, accepted; and (3)
fresh activation but excluded policy/changed mechanics, rejected. Mutate each
input identity independently. Status must never create the missing native
observation or report the old receipt active after a version change. Evaluate immutable release proof/policy plus the existing native activation
record on each read; no renewal receipt, signing key or new writer exists.

Admission also rejects a stripped host_contract_version marker on a new package
and a markerless unknown package; only recognized historical package identities
receive the pre-contract status compatibility behavior.

Cursor catalogue controls inspect registered commands/rules and native skills,
not only hook dispatch. The extension supplies no skills or duplicate public
commands; necessary non-overlapping rules derive from canonical content.
In a legacy checkout with tracked wrappers, attempted native activation must
select proved legacy delivery, leave static references and tracked bytes unchanged,
and load their actual content in the IDE. No rule executes a CLI resolver and no
agent shell round-trip substitutes for host-loaded guidance. Test this on both
exact legacy IDE versions, with native cache absent and CLI lookup unavailable.
Observe an independently random marker through the actual rule/command entrypoint;
record tool/context evidence of the project reference, not just a returned path.
The cache-free cloud-like fixture and two-clone regression retain that same
project-reference behavior; they do not establish new Cloud runtime conformance.

For clean native-eligible projects with no competing project registrations,
observe core/native facet loading and each package's contained origin. Existing
tracked project wrappers make native ineligible even when the cache exists.
Remove cache or stale the epoch during a native session: invalidate the native
claim and retain independently available legacy guards. Reconciled fallback
guidance is active only after actual IDE reload/loading succeeds; otherwise
report unavailable with repair/reload recovery. Never claim a fallback from its
path alone. Duplicate public registration blocks activation.

The mixed-host upgrade replacement assertion covers actual migrated Claude,
Codex and OpenCode delivery. Cursor with retained tracked wrappers is a separate
legacy-preservation control, not a passing native-replacement assertion. Clean
native Cursor installation and reinstall have their own actual package proofs.
Exact-target engineering receipts never substitute for another target; customer
binding-compatible status separately requires the reviewed publisher policy and
fresh exact-observed activation specified in the Implementation Plan.
Cursor activation observations remain explicitly unsealed profile-owned atomic
records, with same-user forgery outside the stated trust guarantee; they cannot
stand in for sealed conformance.

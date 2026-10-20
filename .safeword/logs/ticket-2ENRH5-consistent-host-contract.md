# Execution log for 2ENRH5

## Implementation entry

The current Implementation Plan passed independent review
d2bb1201-0276-4325-b04d-3c21d843261d. Execution Plan review
d8fbcf54-e86c-4ced-bda6-3578faedb95b approved four safe local slices,
13 delivery items and 19 proof definitions. Scenario review
460df2fc-3fa1-4c45-8218-d33557ca97b7 approved the unchanged 58 definitions.
All reviewers were Claude Opus, cross-agent from Codex author.

Canonical coding authorization passed, then the ticket entered implement on
branch codex/consistent-host-contract. No production code, primary RED proof,
scenario checkbox or commit exists yet.

## Review currency investigation

Adding the implementation-entry progress note to ticket.md invalidated all
three receipts. Source investigation confirmed semanticTicketIdentity retains
the entire Markdown body and ignores only selected progress frontmatter.
The current ticket semantic digest is
6b24d8b6c928ace962c8dfe24256fb37d7514646570ec6c5239669695b256b73;
removing only that note transiently produces the reviewed digest
6f15bdded866ddbce5c9a72f4a8f53414a8012ec3b4c9b2248ee73e8559d3e9a.
No receipt or guard was changed. Preserve the chronology, complete the two
required phase anchors, and refresh all three reviews against the settled
ticket context. Keep ongoing execution scratch notes here, as the ticket-system
skill specifies, rather than repeatedly editing reviewed context.

The first attempt to add a test helper was blocked before the file was written.
No test ran, and no feature failure or passing scenario is claimed.

## Exact host setup and live boundary

See host-target-preflight.md in the ticket for exact vendor artifacts, versions,
signature checks and the isolated OpenCode V2 postinstall repair. All required
binary versions are obtainable; this is not native behavior evidence.

Computer Use reported that the Mac is locked and automatic unlock failed.
An asynchronous request asks the user to unlock it. Do not work around the
lock or grant trust/OS permissions. Native Cursor proof cannot start until the
real UI is available. Prepare only safe test infrastructure independently.

## 2026-10-20 06:57:40 UTC — Current retained state

- Current scenario review: e715f6f5-bc82-429b-a636-0490948001ce, approved/stamped.
- Current Implementation Plan: bf8d54ee-b3a8-4a50-b2cb-a5b5d3bf876b,
  approved/stamped after adding retained legacy Cursor project-hook status proof.
- Current Execution Plan: 89d6f5db-b0f2-41a4-8952-0ccc19e2321e,
  approved/stamped; 14 open delivery items and 20 retained proof definitions.
- All achieved cross-agent review with Claude Opus. Canonical coding authorization
  passes with identity 9b50312574bba9726c25570022fce93eebb9d86108dd16d24d8cdaa0f3706ee8.
- Current phase anchor resolves to this ticket's execution-plan.md and passes.

Test-only setup added: fixtures/host-contract/targets.json records five exact
versions and seven runtime rows, with separate Cursor delivery variants. The
archived Cursor arm64 URL, digest and signing team are pinned as test inputs.
The host-contract-version helper accepts known version-only formats and rejects
wrong, ambiguous or prerelease output. Its first five positive cases failed on
the initial unavailable stub, then passed. The newer-binary regression failed
when a recognizable 3.25.9 was accepted for 3.8.23, then passed after comparison.
Final matrix: 11/11 pass. This helper is not yet wired into the required host
runner and does not establish host identity or native conformance.

Verification completed sequentially, with only one Vitest process at a time:

- phase-provenance.test.ts: 36/36 pass.
- SAFEWORD_RUN_OPENCODE_CONFORMANCE=1 conformance-command.test.ts: 9/9 pass,
  including the existing real V1 host boundary. This is baseline, not new V2,
  TUI, native Cursor or shared-contract completion evidence.
- host-contract/target-version.test.ts: 11/11 pass.
- Targeted ESLint and Prettier checks: pass. Package TypeScript check: pass.
- Plan parsing and git diff --check: pass.

No production contract implementation, primary executable RED receipt, commit,
PR, release or scenario checkbox exists. All 58 feature scenarios remain
unchecked. Mac unlock request is still pending; do not claim that a locked UI
is a failing product test. Next: observe exact Cursor 3.8.23 through Computer
Use once the user unlocks the Mac, then finish and run the first native proof
harness according to PR 1. Never use shell UI automation in place of the
computer-use API. Avoid changing reviewed ticket.md context for routine notes.

## 2026-10-20 11:46 UTC — Isolated Cursor startup

The Mac is unlocked; native Accessibility reads succeed. Canonical coding
authorization remains authorized with the same reviewed input identity.
The official archived executable's own CLI reports 3.8.23,
7cf19b7482706625cdb70db3211b7dd035b7aa30, arm64.

Created a synthetic workspace and separate profile/extensions directories under
/tmp/safeword-2enrh5-targets.aOFAud/cursor-native-preflight. Used the vendor's
documented CLI flags --user-data-dir, --extensions-dir, --sync off and
--new-window. No existing profile or credentials were copied. The Accessibility
tree identifies the window as SAFEWORD isolated 3.8.23 — workspace and its
workbench URL points into the archived application. The profile shows Log In
and explicitly requires authentication before AI features work. A user request
for sign-in is pending; no Agent turn or host conformance test ran.

The current UI driver is unsafe for automated isolation: a getApp binding by
archived app path read the synthetic window, but a subsequent keyboard command
opened a palette in the regular Cursor Agents window. A click and an attempt to
dismiss the palette also returned ScreenCaptureKit invalid-parameter errors.
Stopped input rather than risk operating in the user's workspace. The tool's
documented macOS API has no process-ID targeting. Requested explicit user
authorization for process-bound AppleScript Accessibility automation, because
the computer-use tool prohibits alternative UI technologies unless the user
specifically requests them. Do not run that alternative before authorization,
and do not approve OS permissions on the user's behalf.

These are setup/automation prerequisites, not the missing-product RED. No
production code, new review receipt, scenario completion, commit or PR exists.

## 2026-10-20 11:50 UTC — Process-bound driver authorized

The user's yes authorizes the proposed AppleScript alternative. Identified the
isolated main process as PID 56039 by its exact archived executable path and
--user-data-dir argument; no other Cursor process is a substitute. A read-only
System Events query restricted to that PID exited 1 with error -1728:
osascript is not allowed assistive access. The CLI process ancestry is
CodexCLI.app/Contents/MacOS/codex under ChatGPT.app. Requested that the user
enable Accessibility for the nested CodexCLI.app helper; no permission toggle
was changed. The existing Accessibility pane shows ChatGPT and Codex Computer
Use enabled, which did not authorize this AppleScript invocation.

Added the read-only cursor-ide-inspect.applescript setup probe under the
host-contract test fixtures. It requires a PID plus a test-prefixed exact
window title, rejects absent or ambiguous windows, returns only setup/login
flags and explicitly reports conformance=not_run. osacompile succeeds. It has
not executed successfully; compilation is not a host behavior test.

Independently prepared the existing project-hook control with the local source
CLI's install --agents cursor --offline --no-input --no-modify --json against
the synthetic workspace. It exited 0 with selected_agents cursor, healthy
Cursor postcondition, no package/network/destructive effects, and installed the
existing project hooks/resources. This is installation setup, not real Agent
dispatch or conformance. Sign-in and process-bound Accessibility access remain
unverified. All feature scenarios remain unchecked and production is unchanged.

## 2026-10-20 — Native Cursor setup now runs

The user's try now followed the Accessibility change. System Events can now
query the isolated process. Its initial window was Cursor Agents, not the test
editor; reopening the synthetic folder restored the expected editor. The
profile is authenticated. Native reads and keyboard input are now available.

Live existing-hook control passed on archived Cursor 3.8.23: the Agent's file
editing tool created .host-contract/allowed.txt containing exactly
SAFEWORD_CURSOR_BASELINE_ALLOWED_2ENRH5 followed by one newline. The test-only
cursor-hook-observer.ts wrapper preserved each installed command, stdin,
stdout and exit status. Its trace contains preToolUse, afterFileEdit, two
postToolUse handlers and stop, all exit 0. The preToolUse stdout digest equals
SHA256 of the actual allow JSON plus newline. The visible conversation showed
the existing stop hook's terminal-format correction and a subsequent Agent
reply. This is current legacy baseline evidence, not native Safeword completion.

Independent native discovery control also passed. Added a test-only plugin from
fixtures/host-contract/discovery-control outside the global auto-load directory.
A project workspaceOpen probe returned its absolute path. Cursor's own hook log
recorded successful registration; its native slash menu exposed the control
skill. Invoking it read control-guide.md and the visible Agent response contained
SAFEWORD_NATIVE_DISCOVERY_CONTROL_2ENRH5. No Safeword shared-contract feature or
enforcement guarantee is inferred from that independent control.

Observed host/setup constraints:

- Initial workspaceOpen requests can find no hooks while another hook reload
  is in progress. The exact binary clears its per-project hook maps at reload
  start. Logs show startup requests between reload start and completion, with
  no script execution. Invalid script/runtime is ruled out for this observation:
  the unchanged probe executes after a later folder change. Reload timing is a
  supported hypothesis, not a complete upstream root-cause proof or shipped fix.
- A named synthetic .code-workspace file gives a stable editor title and avoids
  unsaved-workspace dialogs. Changing its folders through the actual watched
  configuration triggers workspaceOpen; restoring the single real test root
  lets the strict probe return paths. Do not call internal host stores or inject
  lifecycle events. The eventual lifecycle proof must cover initial failure and
  retain legacy authority; do not advertise startup reliability from this control.
- AXValue is advertised writable for the Agent input but setting it does not
  retain text. Keyboard input works. The input updates asynchronously and slash
  suggestions replace its AX ancestors, invalidating cached references. Keep
  exact prompt assertions and reacquire current controls. A menu press alone is
  not proof the skill was selected; inspect the resulting native state.
- The test scripts refuse multiple Cursor processes and ambiguous matching
  windows. Native profile restoration initially reopened extra test windows;
  only windows carrying the test prefix were closed. Two explicit native save
  dialogs were verified to concern synthetic workspace configuration only before
  choosing Don't Save. No OS trust, shell approval or other security permission
  was auto-granted. Never choose a user's unrelated window for cleanup.

Current test environment and candidate:

- Cache: /tmp/safeword-2enrh5-targets.aOFAud.
- Current archived main PID observed: 54834; always recheck executable and
  --user-data-dir before using it. Earlier PIDs 56039 and 61335 are gone.
- Isolated profile/extensions and project live under cursor-native-preflight.
  Current sole editor title: SAFEWORD isolated 3.8.23 — native-test.
- Named workspace: cursor-native-preflight/host-contract.code-workspace, one
  folder ending in /workspace. Existing project hooks remain installed. Original
  project commands/rules are retained outside that project as baseline-commands
  and baseline-rules, to distinguish native catalogue invocation.
- Restarted the owned test process with scripts/dev and empty foreign Codex,
  Claude and OpenCode profile directories; the wrong-host cache cannot reach the
  real Codex installation. Set autoUpgrade false in this synthetic project and
  disabled its generated optional MCP servers. The real applications/profiles,
  shell configuration and production source were not changed.
- Current candidate: catalogue-probe-EVRxeo/candidate, markers in its sibling
  probe.json. cursor-catalogue-probe.ts copies the complete canonical graph,
  instruments an existing explain workflow/guide and existing allowlisted audit
  helper only in that disposable graph, and runs the unchanged production
  renderer. A minimal test-owned portable manifest supplies metadata only, never
  path repairs. This is not a shipped-manifest proof. The helper's dedicated
  self-check passes through candidate/runtime/cli.js from a separate enrolled
  scratch project; its marker and import.meta.url identify the candidate helper.
  Main workspace native-helper.json is still absent before native invocation.
- Candidate body visibly addresses the Codex-only versioned cache. The intended
  actor failure is that the native workflow cannot invoke its packaged helper,
  despite that helper's successful independent availability control. Do not count
  missing package.json or enrollment in preliminary self-checks as product RED.
- On a future production portable-core module, the same candidate builder uses
  writePortableCoreCatalogue from src/host-contract/portable-core.ts; until then
  it exposes the current renderer's bytes in the independent carrier. Default
  shipped Codex assets are not changed in this pilot. Independent RED review must
  assess this fixture and its fidelity before authorizing implementation.
- Both the independent control and candidate were actually registered through
  workspaceOpen on the named workspace. The UI slash menu shows the candidate's
  /explain entry with the distinctive contract-probe description, alongside an
  existing stock explain entry. Select by the full candidate description; typing
  /explain alone or accepting the first match cannot prove candidate origin.
  Latest action pressed the candidate menu entry; no candidate helper invocation
  or behavioral RED has been claimed. Inspect native selection before submission.

Test-only additions so far include three compiled AppleScript probes, two hook
instrumentation/discovery helpers, independent control assets and the candidate
builder. TypeScript passed after replacing Bun.stdin with node:fs stdin reads;
run it again for later builder changes. Targeted formatting/lint passed before
the latest builder changes. No Vitest is running. No Cucumber step binding,
required proof runner, primary executable-RED receipt, production change,
scenario checkbox, commit or PR exists yet. All 58 definitions remain incomplete.

## Native actor retry — 2026-10-20

Accessibility now works. The exact isolated Cursor 3.8.23 actually registered
both the independent control plugin and the candidate portable carrier through
workspaceOpen. The independent native control loaded its referenced guide and
emitted SAFEWORD_NATIVE_DISCOVERY_CONTROL_2ENRH5. The candidate explain workflow
loaded its workflow and guide markers, but its actual Bun command addressed the
empty foreign-codex-profile versioned cache and failed Module not found. Its
packaged helper independently succeeds from its own runtime in a separate enrolled
scratch project. This is preliminary observed behavior, not an executable RED
receipt, shipped manifest proof, or completed scenario.

Thin Cucumber steps now select the actual Cursor example in the source feature.
Dry-run binds all four steps. Live runs reached real allowed edits through the
existing preToolUse hook (allow-output digest asserted), but actor readiness bugs
interrupted later progress. Fixed launcher/editor process overlap, AppleScript
reserved-name coercion, stale input ancestry at submission, and restored drafts
not being a readiness failure. These setup failures are not product RED. The
required runner retains Cucumber status, distinguishes the intended failing Then
from setup failures, and cannot report full native conformance while other native
obligations remain unwired. Latest run is still in progress. Added typed native
afterShellExecution observation so shell result cannot rely on model prose alone.

Targeted ESLint and all package typechecks passed. Full-suite attempt previously
passed relay (198 + one existing skipped) and collector (153); CLI tests did not
start because another checkout held the build/test lock. No full-suite pass.

The requested bootstrap retry ran once through scripts/dev. Registry latest
resolved to Safeword 1.1.0, which refused the already installed 1.2.0 plugin with
a version mismatch and said project hooks were unchanged. No retry loop or
production changes. Current branch/workspace status remains the accepted feature
artifacts and test-only support. All 58 definitions / 91 cases remain incomplete;
no primary executable RED receipt, production change, commit, or PR exists.

### Executable Cursor RED reached; independent retry pending

Required runner finally reached the actual failing Then: three passed steps,
one failed, exit 2, NATIVE_HELPER_ORIGIN_MISMATCH. Native workflow/guide markers
were visible and the real afterShellExecution event independently confirmed the
foreign Codex cache module failure. Report identity:
/var/folders/v4/1hqkg6ln4nd71j_bjw3_xxb00000gn/T/safeword-host-contract-proof-GZibNK/cucumber.json.
This is still an author run, not authorization for production changes.

Read-only Swift Accessibility handles avoid AppleScript's stale ancestry for
snapshot/input reads. Keyboard actions remain guarded native Cursor controls.
Synthetic fixture selfReport capture/surface/file are off to prevent optional
retro work obscuring the catalogue result or making outbound reports. Real
project guard hooks remain enabled; ordinary write and exact allow-output digest
are observed first. The Node/tsx Cucumber subprocess follows the existing harness;
Bun drives the required runner. Runner timeout is now 540 seconds, below the
600-second execution attestation boundary.

Independent review 1fbdcef4-c46c-406f-90b6-96cb35db7a4e (Claude Opus,
cross-agent) requested changes: its own run hit a Native Agent input-not-focused
setup race, so it correctly refused RED. It confirmed the proof distinguishes
setup from the intended behavioral failure. The exact focus-not-yet-settled
error is now retried before turn submission. Foreground loss, permission failure,
and unrelated errors still fail setup. Fresh independent review
4ac1654e-3ef3-40d2-ad78-a7ff9ca9cb0d is pending. Keep that ID; do not redispatch
unchanged sources while pending. No production changes or scenario checkboxes.

The formerly locked full CLI suite is now running (one Vitest process). Do not
start another Vitest or treat it as passed until completion. Relay and collector
passed in the earlier root run. Targeted new-source lint and package typechecks
passed before the last focus-retry/timeout-only changes.

### Later review outcomes and host capability controls

Full CLI suite finished: 687 files passed, 11,356 tests passed, 14 existing
skipped (911.14 seconds). No Vitest is running now. Subsequent changes are limited
to the native live harness; rerun its targeted lint/typecheck and actual boundary.

Review 4ac1654e-3ef3-40d2-ad78-a7ff9ca9cb0d requested changes after a genuine
foreign-cache helper failure whose visible runtime path wrapped between AX nodes
(runtime/ then cli.js). The test's strict unnormalized path check rejected it.
Whitespace-only normalization now handles rendering, and the completion predicate
requires the foreign-cache path as well as the visible module failure. The actual
shell event is still mandatory. Added baseline renderer assertions proving its
project-hook command becomes the runtime invocation the observer recognizes.
The bounded native-resource-proof.md context explains the independent carrier.

Review 68335763-4446-4fdd-96bd-0562d37fefff requested changes on a transient
zero/two-input state while the old/new chat changed. Readiness now retries only
that named input-count error before submission. The allowed preflight also waits
for its actual Stop-hook observation before the next chat is created.

Review 9edb9813-717d-4b39-aae3-f88995e3c51b requested changes: workspace discovery
never dispatched the probe. Exact native hook log window17 confirms workspaceOpen
requests while hooks were reloading, before Loaded 10 project hooks. This is the
previously observed 3.8.23 startup/reload race, not evidence that the event is
unsupported. Added sanitized probe invocation records (event/version/roots only)
and bounded Given-only folder-change preparation, observing actual hook reloads
before proceeding. Never retry the scenario When or call private host stores.
No production receipt has been approved. Leave all scenario checkboxes untouched.

Important isolation limit: that same native log shows Cursor importing the user's
existing global Claude Safeword 1.1.0 hook commands in addition to the synthetic
project hooks. No global Claude cache or profile was edited. The distinct candidate
workflow/guide markers and own hook command traces still identify this resource
proof, but it is not evidence of single policy authority. The accepted full
inventory/duplicate-activation work must account for Cursor's automatic Claude
plugin imports; do not claim global foreign profiles are fully isolated merely
because CLAUDE_CONFIG_DIR was set. Do not print raw host inputs (they include an
account email) into review packets; retained sanitized observations omit it.

Codex 0.160.0 native capability controls passed independently of product changes.
Private fixture: /tmp/safeword-2enrh5-targets.aOFAud/codex-root-preflight-JOfRjP.
Its private profile contains a native auth-file copy with mode 0600; never include
that profile in source, review targets or printed output. No primary profile was
modified and no hook trust was granted. Native plugin add accepted root plugin.json
without a compatibility overlay. A real read-only Codex turn loaded its cached
skill and referenced guide and returned ROOT_FORMAT_PREFLIGHT_2ENRH5 plus
GUIDE_ROOT_PREFLIGHT_2ENRH5. This is a host capability control, not product RED.

Generated the exact binary's experimental JSON schemas into that private fixture.
Native app-server plugin/read requires marketplacePath to name the marketplace
JSON file, not its directory. Actual native responses verified: inline OpenAI
interface replaces the decoy compatibility overlay entirely (overlay-only
properties remained null); removing the inline extension selects the overlay.
In both modes skills stayed in canonical root skills/ despite the overlay's
legacy-skills decoy. Native API metadata plus the earlier actual cached resource
turn establish the pinned host capability; still need the planned production
projection/root-origin RED and attestation before generating the shared core.

### Resume after the user's Cursor upgrade

The user upgraded Cursor and requested resume at 2026-10-20T14:34Z. The running
installed app reports 3.24.18, build be4c9e5350d77747b42cd467cbd3370a753d4640,
arm64, vendor VDXQ22DGB9; strict deep signature verification passed. Native target
is explicitly updated to 3.24.18; retain 3.8.23 project-hook compatibility. The
matrix now has six versions / eight runtime rows. Earlier native 3.8.23 evidence
cannot satisfy the new native target. Updated ADR, ticket engineering boundary,
dimensions, feature and plans. No production implementation or scenario checkbox.

Scenario review 26d22252-e637-43fe-8f43-0554b113e79a caught four old target
examples. Corrected them; cross-agent Claude Opus review
d88e93db-038a-4b33-a226-aa47de0ece6c approved the current scenarios and its
scenario-gate stamp was written. Explicit lower-level cursor-legacy proof in
dimensions retains the 3.8.23 regression. Nonblocking warnings remain visible.

Implementation review ca468afa-8f25-43bc-b8d5-38a17217f185 requested changes:
customer status version-applicability is not decided consistently with exact
engineering targets and the no-upgrade-friction promise. Research this decision
before revising: compare exact matching, explicit compatibility-family/range
admission preserving current support policies, and automatic per-customer full
conformance. Research domains: existing lifecycle/version semantics; vendor
protocol/backward-compatibility guarantees; evidence applicability/identity; and
upgrade/status/recovery usability. No decision authorizes claiming exact tests
on untested versions. Also clarify old-package result envelopes and the extra
legacy runtime row. This is an agent-owned planning gap, not a user decision.

The old live run 58655 completed with the intended Then failure, 3 passed steps,
exit 2; report safeword-host-contract-proof-tAbdWu/cucumber.json. It was an author
run only and its 3.8.23 version is now historical. No independent executable RED
has been approved.

Created owned test profile cursor-native-3.24.18 from the earlier test profile's
User/ and Local State (not the user's normal profile). Archived the old owned
cursor-fixture.json as .3.8.23 and pointed the current owned fixture at the new
profile. The running user app PID 42715 and isolated test PID 64464 coexist.
Never close or modify the user's app/profile. Current own window label is
SAFEWORD isolated — catalogue-4gZCna. AppleScript coerces same-named process
references to the other process; the new PID guard correctly refused before
input. Replacing those controls with one native Swift AX/keyboard helper keyed
by PID, exact test window and foreground checks. Native helper is test-only and
not yet fully wired/verified. No new OS or host trust was granted.

### Resumed native Cursor and compatibility policy

Cursor 3.24.18 required run (88076) stopped in Given: existing allowed control
never produced its file. This is setup-unavailable, not product RED. Subsequent
native AX inventory and CUA explicitly report the Mac is locked; asked user to
unlock asynchronously and continued planning. No production edits or proof claim.
The isolated 3.24 profile/window remains separate from the regular user instance.

Resolved implementation-review ca468afa customer-version gap by choosing explicit
publisher-owned binding compatibility families for existing support predicates,
separate exact-target engineering receipts, and scoped exact initial support for
new native Cursor/V2. Rejected customer pinning, automatic full customer suites
and blanket semver extrapolation. AIP-180 and SemVer are methodological evidence,
not vendor promises. Version-matched OpenCode v2.0.32 migration documentation
explicitly says V1 implementations do not run in V2; actual populated-profile
coexistence controls remain mandatory. Added upgraded-host controls, truthful
observed/reference version reporting and old-package/new-CLI status/exit behavior.
Target fixture includes eight runtime rows and nine delivery cases, because
Cursor 3.24.18 now also has an explicit retained project-hooks proof obligation.

Further review de5eb9f6-10c2-4f73-80ad-59d604986cd5 rejected an undefined
customer-side renewal-receipt writer/key. Simplified the design: no renewal
record/key/controller. Shared status derives renewal each read from immutable
release proof/policy and fresh exact-observed activation written by the existing
native writer. Stale activation remains not active even for compatible versions.
Recorded both reject/accept discriminating controls and new-contract marker
classification; current third refreshed review is pending (exec session 77253).

Native UI helper now uses one PID/window-scoped Swift implementation. Removed
five unused test-only AppleScript/Swift predecessors. Mutating UI actions cannot
be repeated after dispatch due to a transient subsequent read. Native Return
includes explicit carriage-return Unicode and a short run-loop drain; needs live
confirmation after unlock. TypeScript, ESLint and updated exact-version tests
pass (12 target-version cases; root command also ran existing retro suites).

Fresh current production Codex bundle generated outside checkout, installed in
owned isolated codex-production-root-preflight profile, and native read-only
workflow/guide markers returned successfully without hook trust bypass. Native
plugin/read observes a compatibility-overlay-only decoy; current bundle lacks
root plugin.json. This is diagnostic preparation, not approved primary RED.
No production source changed. Mac-unlock request is still pending.

Review cb36694c-f93f-43d4-b613-cc8d5d311a80 accepted the compatibility
writer resolution but found a Cursor authority gap: hook gating cannot suppress
project-loaded rules/commands. Chose one registration owner per component:
retained generated project wrappers alone register rules/commands; thin native
extension registers only hooks/worker projections; shared active-origin resolver
routes wrapper resources. Real IDE catalogue/origin checks must reject duplicate
public workflows or content sources. Added explicit V2 worker isolation/authority
E2E proof row. Follow-up review **cf81fe6b-bc47-4de4-a394-d3ff8d677bf9** is
REVIEW_PENDING; collect with runtime review status, do not redispatch or stamp
before terminal approval. Execution plan still needs refreshed independent review
after implementation-plan approval. No production coding authorization or RED
receipt earned; all 58/91 scenario cases remain unchecked.

Current handoff: Mac unlock response pending. Resume native Cursor 3.24.18
required runner only after unlock, using the updated single Swift helper; then
independent executable-RED review. Separate Codex production-root primary harness
still needed; observations in host-target-preflight.md are not its RED receipt.

### After user unlocked the Mac

Cursor 3.24.18 positive edit control passed. Its picker requires a physical slash
key event: bulk Unicode insertion populated text but did not open the menu. The
single Swift actor now sends that event, waits for the candidate's exact unique
description, and selects it without refocusing/closing the picker. Fresh required
run 31162 reached 3 passed steps and the intended Then failure (report
safeword-host-contract-proof-ibnURI/cucumber.json), exit 2.

Independent RED review ee9207bd-8762-4e0c-b4ab-4de78af0f1bb APPROVED after its
own exact command (78.6s): actual native workflow/guide loaded and observed helper
shell hit foreign Codex cache. No full scenario/conformance completion claimed.
The runner subsequently gained URI/example host/version/runtime assertions and
the separate Codex portable proof group; refresh this source-bound receipt before
GREEN. No production implementation has started.

Implementation-plan review 7fb89e1f-a940-4ddc-8d8b-fa9f7656c0a4 APPROVED and
stamp written. Canonical approve-plan refused because ticket is already implement
(expected; no phase reset). Review warning clarified invocation-time wrapper
resolution: invariant tracked bytes, schema-owned mechanical helper, existing
single CLI resolver, validated native core origin or retained project origin,
legacy authority restored on native failure. New Cursor activation is explicitly
unsealed same-user runtime observation, not conformance.

Execution review 85c584e7-c5a1-4225-8c29-9cad49b894fa requested explicit required
3.24.18 legacy cases. Fixed two version-prefixed sets of five cases, nine delivery
population (seven native plus two legacy); real upgraded-host controls go through
required all-hosts, not admission-only Vitest. Refresh review
1231d9a8-049a-47ce-88af-d042e74a133d is pending. Coding-authorization remains
denied until current execution review/admission.

Added a separate Codex portable scenario actor/steps/config and required runner
group. Full production generator, only disposable resource/overlay metadata probes,
native marketplace/API/native read-only turn, no root-manifest repair or hook
trust bypass. First author run is session41935; initial lint/type issues fixed,
ESLint/typecheck now pass. Needs intended RED and independent review. Private
fixture config outside repository references only an already provisioned test
auth profile; no auth contents are in sources or review packets.

Codex author run 41935 did not start a turn because execFile left stdin open;
Codex appends piped stdin even with a prompt argument. Closing the unused child
stdin fixed this prerequisite. Fresh run 39892 reached the intended actor-visible
CODEX_COMPATIBILITY_OVERLAY_FALLBACK with 2 passed steps/Then failed, exit 2,
report safeword-host-contract-proof-wpDQuT/cucumber.json (22.4s).
Independent Codex RED review c07187f7-45b3-4a13-8c02-643c2517b2d0 APPROVED after
its own 16.4s execution. Current refreshed Cursor RED review
**e6dc1e66-47db-4b27-b0ef-8c286d860b6a** is REVIEW_PENDING; collect via status.
This refresh includes runner URI/example-row validation added after old approval.

Execution review 1231d9a8-049a-47ce-88af-d042e74a133d returned
REVIEW_ROUTES_EXHAUSTED, blocked, independence none, review_policy prefer:
Claude/opus process_failed before a result. Its recovery requires_human=true.
Asked user asynchronously to authorize rerunning the independent execution
review; answer still pending. Applied finish-review exactly once: fresh-context
subagent execution_plan_supplement returned approve with no findings. Reported
same-agent/degraded, prefer complete; no independent stamp or coding authority
was fabricated. Coding-authorization still denied pending admitted independent
execution review. Do not automatically retry the exhausted coordinator; the
pending human question names the required recovery. New distinct RED proof
reviews are not substitutes for that execution-plan review.

No production code, commit, PR, GREEN checkbox or completed scenario yet. All
58 definitions /91 cases remain unchecked. ESLint and CLI TypeScript pass for
new support code. Existing full CLI suite last passed 687 files/11,356 tests;
updated version parser has 12 passing cases. Source changes only test support,
feature/ticket/architecture docs and scratch log.

### Authorized retry and first production checkpoint

User explicitly authorized the independent execution-review retry. Review
db1ccd92-938e-49d5-87a6-17e1729874a9 completed with two execution gaps (Claude
native cases and Codex continuation). Added exact fixtures/case IDs/signals,
required native-claude group, PR1 byte-unchanged project-hook scope and explicit
human native-hook-trust dependency. Follow-up execution review
1d5b44bc-cc84-4d38-b7fb-4d79b4b61c9d APPROVED; plan-execution stamp written.
Coding-authorization now authorized with cross-agent independence, identity
fd81ffc5b60affdda1474c219a814d1ca46042861aac9db69837a87b1565b651.

Refreshed Cursor RED e6dc1e66-47db-4b27-b0ef-8c286d860b6a APPROVED (119.9s).
Refreshed Codex RED fffba64c-7cdd-414b-b2f1-995c32de6c21 APPROVED (14s), with
production generator correctly excluded from the frozen test-source targets:
production is what GREEN changes. Earlier Codex receipt c071... had included
that generator and would stale on its expected production edit.

First production increment adds schema-owned portable layout and typed delivery
manifest contract. Explicit isolated Codex outputs use a root manifest/OpenAI
extension; default checked-in projection stays legacy until PR4. The native Codex
portable example passed (3/3), report host-contract-proof-xc3TEM; group still exits
3 honestly because remaining conformance obligations are unwired. Extracted
canonical resource rendering to src/host-contract/catalogue.ts with a compatibility
re-export, rather than authoring another renderer. New portable-core writer
supplies host-neutral workflow references and package-origin runtime instructions,
complete canonical templates and one portable identity. Default legacy render
output remains unchanged. Source-bound native proofs exercise actual origins.

After shared renderer extraction: exact Codex portable case passes 3/3 (report
host-contract-proof-tQze05) and exact Cursor resource case passes 4/4 with bundled
helper origin/nonce (host-contract-proof-cziJTG). Both required groups still exit
HOST_CONTRACT_PROOF_INCOMPLETE (3); no full scenario or enforcement claim.
Targeted schema/catalogue/generation tests pass 51/51; ESLint/typecheck pass.
All five generated surfaces regenerated and verified after the source move.
Full CLI regression suite is currently RUNNING in session28308; never start
another Vitest before collecting it. No commit or GREEN scenario checkbox yet.

### Explicit pilot compatibility and checkpoint review

Full regression 28308 found three existing Codex custom-output version tests
failing because custom output had implicitly selected portable rendering. Fixed
the production boundary with explicit --portable-core (requires both --version
and --output, disallows --check); default and historical custom output remain
legacy. Targeted four-file regression passed 71/71. Fresh independently approved
Codex RED d22115ef-4ab6-4d96-922a-c23a1e1a2f79 includes exact installed-cache tree
matching before the native turn. Current native Codex passes 3/3, report
host-contract-proof-mU0euz; current native Cursor passes 4/4 after regeneration,
report host-contract-proof-Ow0kNV. Required groups still return incomplete (3).
The Codex case proves manifest precedence and fixture resources, not rendered
helper execution; Cursor proves that additional production-renderer boundary.

Full regression rerun 40873 PASSED: 687 files, 11,358 passed tests, 14 skipped;
769.17 seconds. No Vitest process remains from this run.
All five generated surfaces are current; ESLint/typecheck passed.
Quality-review invocation observed quality-review checkmark. Independent
Claude/opus review da5cba7d-e9c2-4b73-b579-56441e05a759 APPROVED, no errors.
Non-blocking limitations are recorded in portable-checkpoint-review.md. No
feature completion, native enforcement, activation or conformance claim.

Read-only native hooks/list on the latest isolated Codex pilot returns no hooks,
including with hooks/plugins feature flags enabled. No hook trust was granted
or bypassed. Investigate the actual installed activation boundary before writing
the guard fixture or asking for a concrete trust action.

Pre-commit formatting normalizes the Codex fixture's import whitespace and the
targets JSON layout. No behavioral change or new production work is authorized
from a receipt whose frozen source identity those formatting edits invalidate;
retain the prior RED/partial-GREEN history and review any future changed primary
proof against its current sources before subsequent production integration.

### Return to planning after Codex format discovery

Saved first checkpoint 0d1061ae6; pre-commit checks and all five generated-surface
checks passed. No Vitest remains running. Native read-only format comparison
codex-hook-format-tdZICY installed identical payloads in two fresh unauthenticated
profiles: portable root discovers zero hooks; removing only root plugin.json
discovers all five expected events, enabled but untrusted. Pinned Codex source
rust-v0.160.0 loader.rs explicitly suppresses hooks for AgentPlugin format.
No trust granted or bypassed; see codex-hook-discovery.md for ruled-out causes.

Fresh checkpoint quality review 4eac303f-2142-49b3-867e-5060c1620636 independently
APPROVED (Claude). An implement phase stamp could not bind because implementation
files were already committed and there was no current Git implementation diff.
Recorded a truthful implement-exit skip solely for returning to planning, not
completion, then moved the ticket back to plan-implementation. Revised the Codex
packaging choice to one existing native compatibility container deriving content
from the shared renderer; no companion registration and no Product/target change.
New superseding ADR records that choice. Current implementation/execution stamps
do not authorize more production work until refreshed reviews pass.

Scenario refresh d3ba2a37-3640-48fa-a18b-c25bfeef206b independently APPROVED
(Claude/opus); scenario-gate stamp observed. Definitions remain 58/91 unchanged.
Implementation review 0f71fb96-d0ed-4875-93f2-c5788a9a1067 requested changes:
static Cursor wrappers could not execute the proposed origin resolver, and its
failure path risked weakening legacy/Cloud guidance. No production resumed.

Investigated Cursor public hooks/rules/plugin APIs and tested IDE 3.24.18 using
a fresh disposable visibility-control package in owned catalogue-pE45oA. Actual
workspaceOpen returned its new package path; both user-invocable:true and false
skills appeared in the native slash menu. Thus CLI visibility metadata is not
an IDE suppression solution. Restored the original candidate skill after that
separate control. These are research observations, not conformance receipts.

Revised the plan: preserve legacy static references and select verified legacy
when project registrations would compete; native clean-project registration
must expose one public workflow owner. No dynamic shell-running markdown, no
user packaging choice, and no profile-local retirement of shared wrappers.
Necessary generated compatibility resources remain single-authored and checked.
New superseding Cursor loading ADR records the changed engineering decision.
Fresh implementation review still required before execution-plan refresh/coding.

Revised implementation review 5a9a9659-b391-47a5-a0bb-483da00669d6 APPROVED
(independent Claude/opus), stamp observed. Canonical approve-plan advanced to
plan-execution with approval_status not-required. Execution review
5dcb57cd-73db-4d58-a055-b5e301888d53 requested one documentation mapping repair;
added .project/surfaces.md task and documentation targets plus native-cursor PR4
rerun. Follow-up 1f297442-d8f4-4c59-828e-e2ee173e47c5 APPROVED, stamp observed.
Scenario refresh 66974aa1-459a-49ec-89bf-0c9c0ae86dcf APPROVED and stamped after
the final plan edits (earlier scenario receipts were stale). Current coding
authorization is authorized, cross-agent, input identity
ab8db893aacd067ace70616cfb14d52ccb83ac182c32bb9bfd8587a981d6349b.

Prepared actual generated Codex compatibility carrier in isolated profile
codex-guard-KbebbV, retaining exact 0.160.0. Native hooks/list shows all five
expected hooks enabled and untrusted. Hook manifest SHA256
8c980427a949a53696c5f5354290f019fec733b6ce3bf482352e7402fb13f489.
Requested explicit human authorization for those exact test-profile hooks;
answer pending. No hook trust granted or bypassed. Native TUI session61208 is
at the fixture folder-access prompt; do not activate it while approval is pending.
Other native TUI probe sessions were closed. No Vitest currently running.
Return to implement starts with current native guard proof scaffolding and its
fresh executable RED review, not new production code from old resource receipts.

Human authorized the exact five hooks in codex-guard-KbebbV. Accepted only its
disposable project folder and used the native TUI Hooks trust-all action. Native
hooks/list then returned all five expected hooks enabled and trusted, with their
previously recorded hashes unchanged and no warnings/errors. No trust bypass.

Native Codex 0.160.0 compatibility-container baseline, actual model/tool turns:
- Allowed thread 01a15a9b-2416-76d1-871d-c8f177992987: one shell command completed
  with exit 0; allowed-sentinel.txt contains exact safeword-allowed-KbebbV.
- Denied thread 01a15a9b-8755-79b3-b841-6fff5aeb77eb: native router stderr reports
  Command blocked by PreToolUse hook for the exact synthetic ticket shell write,
  with the shared shell-ticket policy reason; ticket.md remains absent.
Evidence: /tmp/safeword-2enrh5-targets.aOFAud/codex-guard-KbebbV/
allowed-events.jsonl, denied-events.jsonl, denied-stderr.log. These passing
existing guard controls are baseline evidence, not a fabricated RED, admitted
conformance receipt, continuation proof, or complete outline/scenario.

Required automatic profile-install retry ran once; safeword@latest requested
1.1.0 but found installed plugin 1.2.0 and exited 1, leaving project hooks
unchanged. Subsequent coding authorization reports missing_accepted_scenarios
(identity 500eee5eac3c99ec91a80d537e436351c43a8560b2fbe93fe91674daa51a3b09).
Adding the live baseline test was blocked before mutation. Independent scenario
refresh dispatched; collect its terminal result before any further dispatch.

Scenario refresh f68148fc-1d02-414c-aa7a-b05b0819be27 requested re-dispatch with
the complete existing context. Follow-up f04f662d-400c-4488-84cd-ebb9f88cff43
APPROVED independently (Claude/opus), stamped, and restored coding authorization
ab8db893aacd067ace70616cfb14d52ccb83ac182c32bb9bfd8587a981d6349b.
Added opt-in paired native controls at the execution plan's path,
packages/cli/tests/smoke/host-contract.live.test.ts. Checks package byte identity,
native exact version and enabled/trusted hooks before nonce allow/deny actions.
Preserves actual host output even on timeout/nonzero exit; strips Vitest's
source-CLI override so package helpers retain their own runtime origin.
Lint/typecheck pass. Independent quality review
6d1cd216-a6de-4e9e-a907-818da8ac715f APPROVED this bounded baseline, with explicit
limits: no admitted receipt, continuation or full required-group completion.
The authored live run is queued behind another checkout's package test lock;
no second Vitest process was started. No scenario ledger boxes checked.

The shared lock released normally. Authored native live baseline completed:
1 file / 2 tests passed in 21.97s, using the actual trusted compatibility package.
Artifacts: /tmp/safeword-2enrh5-targets.aOFAud/codex-guard-KbebbV/guard-run-kQSZb5/.
Both required write case IDs passed; their future required-group registration,
continuation and admission are not implemented. This checkpoint changes only
live test infrastructure and proof notes, not production behavior or scenarios.

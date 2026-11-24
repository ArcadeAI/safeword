# Impl Plan: Verify authorized legacy Electron behavior

**Status:** implemented
**Implemented on:** 2026-11-24
**Planned on:** 2026-11-23

## Approach

A source-defined migration policy selects the existing review/row/close machinery
and one typed proof runner. The public observation command produces evidence;
independent eligibility and proof reviews judge that evidence; row attestation
executes it again and signs the exact current commit; closing repeats all required
rows and signs their aggregate. Project opt-in cannot supply policy or commands.

The riskiest assumption is that an independently rebuilt Electron mutant reaches
the selected scenario assertion rather than broken setup. The cheapest decisive
proof is one real scoped public observation with a renderer behavior removed,
followed by authenticated review, row admission and closing. Portable contract
tests cannot establish that desktop boundary.

| Behavior / scenario group | Real boundary and primary proof | Confidence limit / supporting proof |
| --- | --- | --- |
| Approved demo and public isolated observation | E2E through generated installed public CLI, actual frozen archives, independent builds, Electron and selected scenario | Requires supported macOS desktop host; portable tests only supplement it |
| Missing/partial reviews, weaker project setting, wrong migration identity, invalid history | Integration through public attestation and real Git/review records | Process-boundary fixtures test negative reports; separate real review establishes authentic reviewer provenance |
| Non-discriminating outcomes, matcher exhaustion, mutation anchors | Unit report/request contract matrices; integration process execution and public result | Synthetic reports prove rejection logic, not Electron viability |
| Unsafe preparation, untracked exclusion, arbitrary commands | Integration with temporary real Git archives and owned processes | Trusted project code executes with normal local user privileges, not an OS sandbox |
| Changed inputs, metadata commit, foreign records, failed replay | Integration with real commits, exact reviewed request/observation bytes and signed records | No metadata exemption; all fresh HEAD authorizations execute original and mutant again |
| Complete and incomplete closing | Integration through public closing command and shared installed gate; real host all-17 replay | Exact-set inventory is source-maintained independently of ledger parsing |
| Compatibility and shared runtime gates | Existing CKWE2D tests plus new isolation fixtures and generated host parity | Does not claim independent native Claude/Cursor walkthroughs |

Affected OpenAI Codex uses the generated local plugin and its public CLI; Safeword
CLI uses that same implementation. Other transports retain the explicit skips
in spec.md and their existing parity coverage. TypeScript contract validation uses
the testing skill; advanced type-system machinery is unnecessary. No AI output
quality claim is added, so deterministic authorization needs normal tests rather
than a new LLM evaluation suite.

### Persona consequences

Technical Builder receives separate VERIFIED credit and concrete refusals while
missing original history stays visible. They propose mutations; another agent
judges semantics. Safeword Maintainer owns policy enrollment in reviewed source,
retains existing CKWE2D signatures and can remove the new route without rewriting
audit records. Neither tests nor AI review grant merge or release authority.

### Current and target truth

Pre-change baseline: Safeword source 3f5353165 and its original generated 1.2.0
bundle supported CKWE2D only. The implementation adds SGWMBS enrollment, isolated
Electron execution, public observation and whole-test exception monitoring.
The supported monitored bundle at SHA-256
48de020dce911c7b0a39be666649eba7621a27ef5c20e5ab24ea1d20079506ad
completed all 17 actual original/mutant replays and authenticated aggregate
closing at Soulless f7a1d907c08787908772c5d228c20fb586a5baf8 before PR 188 merged.
Both module-load and after-readiness invalid exception probes were refused;
their earlier false-positive observation remains explicitly uncredited.
The measured closing-client budget correction also passed the actual installed
shared completion check. This is a supported local source installation, not an
npm release. Original missing histories remain unchanged. Current closeout adds
semantic reviewer calibration, stronger ledger preservation assertions, a real
disposable marketplace installation test, and current-main verification/review.
Formal source-ticket completion still requires truthful original TDD provenance;
implementation status does not claim that its unchecked histories are complete.

## Decisions

### Recorded Decisions

**Decision:** Trusted migration enrollment.
**Choice:** A closed source registry with existing CKWE2D constants retained and a
new SGWMBS policy containing canonical ArcadeAI/soulless-monorepo identity, fixed
pre-extension cutoff, feature/ledger paths and the exact 17 approved headings.
Require cutoff ancestry as well as canonical remote identity. New policy identity
and digest bind observations, row tags and closing records.
**Alternative considered:** Project configuration enrollment or a ticket-only allowlist.
**Rejected because:** Author-writable scope or repository identity alone grants an
unreviewed exception; the existing hardcode also cannot safely select a new runner.
**Evidence reference:** Existing retrospective-history, gate and close source at
Safeword origin/main 3f5353165; current signed-review boundary is reused.
**Retrieval date:** 2026-11-23.
**Applicable version:** Safeword source 3f5353165, installed baseline 1.2.0.

**Decision:** Typed Electron evidence.
**Choice:** Add one fixed Playwright/Electron runner using committed archives,
separate frozen pnpm installs, independent main/preload/renderer builds, fresh
JSON reports, private fixture profiles and owned renderer ports. No caller command
or cwd is accepted. Use external Node/pnpm/Git tooling, clear execution preload,
Git and review overrides, and invoke the archived locked Playwright directly.
Select exact reported file, declaration line, full title and unnamed project;
require one attempt, retries zero, repeat one, no skip/fail annotations or global
errors. Original must pass normally; mutant must fail at the declared scenario
expectation with an expected/received matcher mismatch and reviewed location.
An exhausted assertion matcher is valid; setup/launch/global timeouts are not.
The runner additionally owns a fixed Node preload outside both Git archives,
injected only into the selected Playwright execution. It wraps the public
Electron launch method before test code loads, preserving existing options and
adding only a fixed runner-owned `-r` preload before the application entry point.
Playwright 1.62.1 strips NODE_OPTIONS when launching Electron, so this explicit
argument is required for main-process coverage. That preload installs an
uncaughtExceptionMonitor before application code without suppressing its normal
failure behavior. Packaged-app launch is outside this built-source profile.
Before returning an application to the test, the wrapper requires that main
monitor's PID-specific startup marker, attaches a BrowserContext weberror listener
and page crash listeners, and checks buffered pageErrors for already-created
windows. Listeners remain for the entire application lifetime, including after
renderer readiness; future windows receive the same coverage. All evidence goes
to one freshly created runner-owned event file per snapshot. Missing monitor
startup, malformed or missing telemetry, listener setup failure, any uncaught
main/renderer exception, or renderer crash refuses proof before accepting a
matcher result. The caller cannot supply preload code, paths or event records.
Inherited NODE_OPTIONS stays cleared; only this fixed runner-owned preload is
added for test execution. Installation and build retain their clean environment.
The module-load and after-readiness real-host negative probes supplement portable
process/event tests. A clean real-host original/mutant remains required. This is
trusted-project monitoring, not protection from project code deliberately
removing listeners or forging telemetry as the same local user.
**Alternative considered:** Treat any nonzero exit as a kill; add a general runner
plugin API; introduce a custom reporter before using the existing structured report.
**Rejected because:** Exit codes admit setup failures; general plugins add unwanted
scope; current locked report plus exact assertion location and independent semantic
review alone cannot detect unreported exceptions after readiness. A fixed preload
uses public Playwright events and Node monitoring without changing archived
project files or requiring a caller-controlled reporter.
**Evidence reference:** https://playwright.dev/docs/test-reporters and
https://playwright.dev/docs/test-cli; installed Playwright 1.62.1 JSON serializer,
grep builder and reporter types; https://pitest.org/quickstart/basic_concepts/.
**Retrieval date:** 2026-11-23.
**Applicable version:** Playwright 1.62.1 in Soulless, Electron 44.9.1; current
unversioned docs checked against installed source. No new dependency.
Whole-test monitor evidence checked November 24: Playwright v1.62.1 public
BrowserContext weberror and Page.pageErrors APIs; its Electron launcher source
strips NODE_OPTIONS and adds its own `-r` loader. Node 24.18.1 supports `--require`;
uncaughtExceptionMonitor observes without suppressing normal uncaught handling.
Sources: https://github.com/microsoft/playwright/blob/v1.62.1/docs/src/api/class-browsercontext.md,
https://github.com/microsoft/playwright/blob/v1.62.1/docs/src/api/class-page.md,
https://github.com/microsoft/playwright/blob/v1.62.1/packages/playwright-core/src/server/electron/electron.ts,
https://nodejs.org/download/release/v24.18.1/docs/api/cli.html,
https://nodejs.org/docs/latest-v24.x/api/process.html#event-uncaughtexceptionmonitor.

#### PlanEvidenceRecordV1

```json
{"schema_version":1,"source_identity":"https://playwright.dev/docs/test-reporters","checked_version":"1.62.1 installed source plus current docs","source_version":"current unversioned documentation","target_version":"1.62.1","supported_claim":"JSON reporting supports explicit report files; actual selected-result shape is checked against the installed serializer","license_identifier":"none_declared","attribution_notice":"none_declared","redistribution_limit":"none_declared","security_limit":"none_declared","privacy_limit":"none_declared","reuse_limit":"Documentation informs design; no source is copied"}
```

#### PlanEvidenceRecordV1

```json
{"schema_version":1,"source_identity":"https://playwright.dev/docs/test-cli","checked_version":"1.62.1 installed source plus current docs","source_version":"current unversioned documentation","target_version":"1.62.1","supported_claim":"CLI supports exact selection controls, worker and retry limits; installed grep behavior determines the escaped selector","license_identifier":"none_declared","attribution_notice":"none_declared","redistribution_limit":"none_declared","security_limit":"none_declared","privacy_limit":"none_declared","reuse_limit":"Documentation informs design; no source is copied"}
```

#### PlanEvidenceRecordV1

```json
{"schema_version":1,"source_identity":"https://pitest.org/quickstart/basic_concepts/","checked_version":"current documentation","source_version":"current unversioned documentation","target_version":"Safeword source 3f5353165","supported_claim":"Killed, survived, nonviable, timed out and run error are different mutation outcomes; execution failure alone is not discrimination","license_identifier":"none_declared","attribution_notice":"none_declared","redistribution_limit":"none_declared","security_limit":"none_declared","privacy_limit":"none_declared","reuse_limit":"Conceptual taxonomy only; PIT is not installed or redistributed"}
```

**Decision:** Preserve legacy authorization and replay chronology.
**Choice:** Leave CKWE2D request/observation/signature shapes and record location
compatible. Extend new policy fields only for SGWMBS. Use the same strict evaluator
for observation and every replay. Bind reviewed mutation and assertion, mandatory
manifests/lock/config/wrappers and declared support to input hashes. Keep original
observation commit truthful; compare stable execution content on each fresh HEAD.
Require all 17 authorized rows for SGWMBS closure and retain original ledger entries
exactly as captured at cutoff, apart from separately appended VERIFIED credit.
**Alternative considered:** Reuse old execution on metadata commits or rewrite old
receipt meaning.
**Rejected because:** The accepted Rule requires real current execution and honest
history; changing old receipt semantics breaks the first migration.
**Evidence reference:** Existing stableObservation, approvedRetrospectiveReview,
row-v2 signing and close atomic writer; unchanged execution is not author approval.
**Retrieval date:** 2026-11-23.
**Applicable version:** Safeword source 3f5353165.

### Interface applicability and rollout

Interface applicability: the new public observation route uses the existing
versioned CLI result envelope. Success returns an observation and no authorization;
refusal names the invalid policy/history/input, preparation failure, selection
failure or non-discriminating outcome and returns no successful observation.
Repeated calls execute again and return separate observations to the caller; the
command does not overwrite an earlier observation file or mint review approval.
Caller-managed committed artifacts retain their truthful producing commit.
Observation JSON is untrusted evidence, not a signed approval. Its authority
comes only from exact independent-review fingerprints and trusted replay; changing
its commit or outcomes cannot replace either check. Original and mutant execute
sequentially. Each receives a freshly probed local port through the approved
renderer-port environment input; the bound archived configuration uses strict
port binding and forbids server reuse. An occupied port or failed owned server
startup refuses proof. This protects against accidental live-server reuse within
the declared trusted-project boundary, not a malicious same-user process racing
the runner. Any need to defend against that actor requires a new isolation design.

Rollout uses the generated Codex bundle and supported persistent local marketplace
installation first. Mixed old/new runtimes fail closed for SGWMBS until the trusted
installed reader understands the new policy. No normal package publication or
broader enrollment is needed for this scoped local delivery.

### Data applicability

Data applicability: migration identity and authenticated proof records change.

- Purpose: separately verified current behavior; never reconstruct unknown RED.
- Store and model: reuse existing local review records and signed row/close files;
  new policy owns a separate close filename, retaining the CKWE2D name.
- Schema and relationships: request identifies ticket/scenario/test/mutation;
  observation binds policy digest and all executable input hashes; two independent
  review IDs authorize one row; all exact required rows authorize closing.
- Source of truth: reviewed source owns enrollment; authenticated coordinator owns
  verdicts; trusted execution owns observations; project JSON alone owns no authority.
- Ownership and access: local builder requests execution, separate reviewer judges
  eligibility and discrimination, existing private-profile signing remains trusted.
  Project code is not sandboxed from the user's account; do not claim key isolation
  merely from environment filtering.
- Identity and integrity: repository identity plus real cutoff ancestry; contained
  regular tracked inputs; policy digest, exact reviewed bytes, current commit and
  existing HMAC records. No substitute author response can satisfy trusted gates.
- Cross-system flow: public command to runner to observation to reviews to attestation
  to hooks; generated transports delegate rather than interpreting approval locally.
- Lifecycle and retention: proposed, observed, independently approved, attested,
  stale, replay-failed or closed. New HEAD always requires execution; changed
  reviewed bytes also require review. For SGWMBS, a failed required replay writes
  a durable authenticated failure record in ignored review state, bound to the
  policy digest, repository, scenario, proof-review ID and reviewed request/input
  digest. It invalidates any row tag using that proof review. A later passing
  rerun, including at another HEAD, cannot authorize that same failed proof ID.
  Recovery requires a fresh observation and a new independent proof review;
  the old failure stays as audit evidence and never becomes a success. The
  same-head failure-then-pass contract test must prove refusal until that renewal.
  This new state applies only to SGWMBS; legacy CKWE2D semantics stay unchanged.
  Before any required replay starts, acquire exclusive creation ownership for
  that proof ID and durably write an authenticated pending record. An existing
  pending, failed, malformed or unauthenticated record refuses that proof ID;
  it cannot be removed by the normal retry path. A completed successful prior
  replay can begin a fresh exclusive pending transition for a new attestation.
  Row and closing readers refuse a pending record even if an older row tag exists.
  Only the owning invocation, after both executions and all before/after identity
  checks succeed, writes the new row tag while still owning pending execution,
  then atomically changes pending to passed. Readers require both the current
  tag and passed journal. Normal failure changes pending to failed before returning. Interruption,
  crash or a failed final write leaves pending, which is equally non-authorizing
  and requires a new proof review. Failure to durably initialize pending prevents
  execution entirely. A concurrent second invocation refuses the pending owner;
  it cannot overwrite or complete another invocation's record. The crash-boundary
  tests cover termination after initialization, failed final write, and a passing
  subsequent attempt under the same failed proof ID. State is guarded by an
  exclusive per-proof lock and atomic durable replacement; a leftover lock also
  fails closed until a fresh proof-review ID is used. This does not defend against
  a trusted same-user actor deliberately deleting local state.
  If closing fails after earlier rows refreshed, no aggregate success is emitted;
  renewal of the failed proof precedes a new all-row replay. Close and failure
  records stay under ignored .safeword/state/reviews, outside tracked commits,
  like existing CKWE2D records. Existing atomic close replacement preserves prior
  history but old commit/input signatures cannot authorize a changed view.
  Concurrent callers cannot authorize changed input because before/after commit and
  digest checks reject drift. No claim of a general job scheduler is introduced.
- Migration and backfill: explicit opt-in and new live observations only. Preserve
  old 17 missing histories, old observation commit and pinned CKWE2D semantics.
- Compliance: no customer data or credentials required. Reviewed requests contain
  source/test excerpts, local fixture outcomes and disclosed missing-history reason.
  Reuse existing local retention; no new remote data service.
- Rollback: revert the new policy/runtime through supported installation. SGWMBS
  audit records remain but an old runtime cannot authorize them. CKWE2D retains
  previous readers/writers; no reinterpretation or destructive conversion.

### Measurement applicability

Measurement applicability: skip: no performance or probabilistic quality promise.
The exact 17-row threshold uses a hand-maintained policy inventory as oracle,
compares exact sets and rejects missing, extra, duplicate or foreign headings.

## Design alignment

| Principle | Consequence | Proof | Conflict |
| --- | --- | --- | --- |
| 1. Structure enforces; instructions suggest | Project opt-in cannot grant enrollment; only authenticated reviews and real replay authorize | packages/cli/features/verify-authorized-legacy-electron-behavior.feature | |
| 3. Add, never replace | Original missing histories and legacy receipts retain meaning | packages/cli/features/verify-authorized-legacy-electron-behavior.feature | |
| 6. Correct and safe; then clear; then simple | One fixed additional runner and existing gates, no plugin framework or dependency | packages/cli/features/verify-authorized-legacy-electron-behavior.feature | |

Architecture applicability: shared authorization and migration compatibility are
significant. The durable rule is appended in ARCHITECTURE.md under
"Scoped retrospective migration authorization". This honors existing independent
review and digest-bound provenance; implementation details remain in this plan.

## Known deviations

The existing runner shares Bun dependency installations between snapshots.
Electron uses independent installs/builds to avoid sharing compiled or Vite state.
Only the new adapter differs; no speculative rewrite of the proven legacy runner.

Supported local plugin installation is the delivery boundary. The supported
project-reconciliation preview was inspected but proposed unrelated legacy
helper/configuration and lockfile changes in the delivery checkout. Those changes
were not applied: they would invalidate every executable-input proof without
being required by the installed native plugin. No managed cache was hand-edited.

## Doc impact

README.md and the CLI reference under packages/website/src/content/docs must
describe the public observation command, scoped enrollment, separate VERIFIED
meaning and setup-failure rejection. They must not advertise general enrollment.
Templates/rubrics and generated runtimes must describe both supported profiles.

## Assessment triggers

Revisit if locked Playwright report/selection semantics change, a declared assertion
cannot distinguish setup failure, actual builds share outputs, a new migration is
requested, the exact authorized set changes, or replay cannot reproduce reviewed
outcomes. A changed design returns to plan review before implementation resumes.

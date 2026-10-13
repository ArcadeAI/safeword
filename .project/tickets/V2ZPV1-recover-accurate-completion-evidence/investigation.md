# Recovery investigation

Decision: find the smallest recovery contract that corrects mistaken annotations and verifies existing behavior without rewriting historical proof or certifying deferred work.

## Investigation plan

- Evidence semantics: what distinguishes a correction, present verification, and genuine historical RED? Inspect ledger parsers and completion checks.
- Authorization and audit: which existing authenticated artifacts can authorize an exact change, and what binds them to the original content? Inspect retrospective receipts and history checks; research append-only correction patterns.
- Delivery and scope: can existing retrospective proof be parameterized without changing CKWE2D's authority? Identify the minimum call sites and retained deferral behavior.
- Recovery ergonomics and cost: compare an exact-ticket extension with a reusable recovery contract and a plain ledger rewrite. Identify stale/replayed approval and accidental blanket-waiver failure modes.

Options to investigate: (1) exact-ticket recovery added alongside existing migration certification; (2) bounded reusable recovery contract with append-only corrections and distinct current-verification proof; (3) direct replacement of checked ledger rows under approval.

No production changes or evidence corrections are authorized by this research document alone.

## Findings and option debate

Direct replacement is the shortest edit and Git would retain a prior commit. However, it conflicts with the installed historical-evidence guard and makes the live ledger stop displaying the mistake. Rejected: recovery must not silently reinterpret checked history.

A reusable recovery framework would avoid another ticket-specific exception. However, the existing retrospective implementation is deliberately fixed to CKWE2D in history, gate, proof, closing proof and authenticated review identity. Turning it into an arbitrary-ticket policy is a larger trust change than #4200 needs. Rejected for this delivery: no universal eligibility engine or freely chosen cutoff.

Recommend an exact-ticket recovery profile for 5F5ZZA, reusing existing authenticated review and proof primitives while leaving CKWE2D's fixed authority intact. This is a proposed contract, not permission to treat 5F5ZZA as CKWE2D. A single trusted profile would bind the exact ticket, ledger, feature, accepted scope and baseline; caller-supplied paths or a ticket frontmatter flag alone cannot grant authority.

Research supports the design principle, not a wholesale framework migration: Microsoft's [event-sourcing guidance](https://learn.microsoft.com/en-us/azure/architecture/patterns/event-sourcing) recommends compensating records to preserve original events, but warns of substantial architectural complexity. Use that correction principle in a small record, not a new event-sourcing platform. [SLSA verification guidance](https://slsa.dev/spec/v1.2/verifying-artifacts) checks trusted identity and subject provenance; by analogy, recovery approval must match the exact scenario and evidence contents rather than a plausible review ID.

## Proposed bounded contract

1. **Annotation correction:** retain the original same-SHA REFACTOR row unchanged. Append one authenticated correction bound to the exact ticket, unique scenario, original row bytes and proposed skip reason. The validated completion view applies that erratum; the display retains both the original and correction. This grants no new RED or GREEN proof.
2. **Current certification:** retain existing RED/GREEN/REFACTOR rows. Approve a distinct VERIFIED claim only after independent eligibility and proof review with an actual passing test and a discriminating negative proof. Label this as current certification, never historical RED. Reuse existing receipt authentication and stale-input rejection.
3. **Accepted deferrals:** retain unchecked entries and original scenario text. A reviewed exact mapping to FC33HK, DRD65E, KKP2R3 and MCWV4B can exclude only the user-deferred cases from the current scope's completion denominator. Report them as deferred and unverified, not checked or certified. A scope/heading/body mismatch blocks closing. This is the additional completion-policy decision that annotation correction alone cannot resolve.
4. **Closing:** evaluate only authenticated corrections, current certifications and exact accepted exclusions; all other unchecked entries continue to block. Keep dependency, verify-artifact, current tests and PR-scope checks. This grants no merge or Draft-to-Ready authority.

## Implementation boundary and discriminating tests

Minimum integration surfaces to evaluate before coding: trusted retrospective profile resolution; existing history/proof/gate/close consumers; a correction-record validator; the shared ledger-validation and done views. Pre-tool historical-row rewrite denial remains intact. Schema registration and all generated surfaces apply if a new shipped helper is needed. Do not reuse the broader delivery approval ledger unless its existing event schema genuinely fits; its authorityRef string is not by itself human authentication.

Tests must distinguish: an approved exact erratum versus changed original bytes/wrong scenario/unauthenticated receipt; current passing characterization versus an unrelated negative failure; accepted exact deferral versus a newly excluded active case; fresh reviewed inputs versus stale or cross-ticket receipts; CKWE2D's unchanged allowed and rejected routes. Include the installed CLI/edit/closing boundary, not only parser fixtures. No expensive model qualification rerun is needed to establish deterministic recovery mechanics.

The existing retrospective proof runner is Vitest-specific and expects exactly one named passing test and one named assertion failure. Root Cucumber evidence cannot simply be fed into that runner. Reuse a genuinely equivalent package test per claim where available; do not build a multi-runner proof abstraction just to mark the ledger complete. Any uncovered behavior remains open.

## Scope and remaining decision

This proposal resolves evidence bookkeeping only. It does not turn the prior 137/142 acceptance run into 142/142, clear historical failures, establish deferred host proof, or provide whole-stack review. The 137 unchecked entries need an itemized reconciliation; they are not 137 automatic certification candidates.

The additional scope decision is whether current-scope completion may exclude the exact 33 already-deferred cases while displaying them as unverified. The existing done gate has no such concept: it rejects any unchecked checkbox. User deferral establishes accepted delivery scope, but does not itself implement this new gate behavior.

Premortem: the profile becomes a blanket waiver through an overly broad scenario match. Mitigation: unique headings plus exact source-body and accepted-scope identity, with every unmapped or changed entry remaining open. No new recovery capability should ship without independent contract review and discriminating tests.

## Investigation checklist

- [x] Frame the decision.
- [x] Compare three concrete options.
- [x] Enumerate evidence, authorization, delivery and maintenance domains.
- [x] Inspect current source and primary external guidance.
- [x] Recommend the smallest bounded approach; isolate its additional completion-policy decision.

## Frozen candidate verification and review dispositions — 2026-10-11

The user approved the bounded recovery policy. The implemented contract in
`impl-plan.md` supersedes the exploratory per-row VERIFIED proposal above:
one authenticated complete observation plus independently reviewed current
case coverage; no new historical RED claims or replacement checkboxes.

Candidate `6f9ccdbb22a1bdc10097e823e0a1c0e0cd7977bd` passed the final full
repository run: relay 198 passing / 1 skipped, collector 153 passing, CLI
728 passing files with 11,448 passing / 14 skipped tests. The earlier full
runs remain failed evidence, including the stale-build setup failure caused
by editing source during verification. Final lint/typecheck emitted no errors.
The single live observer started after these checks; no current 142-case
observation or live certification is claimed by this entry.

Current external Claude source reviews approved all three packets:
233b2a17-510b-444c-b112-f3b9ecff64e8, 42f5e71b-3c2a-4140-9aa8-a909708e9ecb,
and 59556314-a027-49d3-9116-f1d1c8c8b97d. Their warnings remain material:

- Report negative coverage could directly mutate assertion names/locations,
  feature URI and unexpected elements. The parser enforces these predicates;
  current tests do not independently kill every such mutation. This is a
  coverage limitation, not proof of a bypass or historical RED.
- The profile identifier alone does not hash the audit exclusions, scope-field
  list or observer arguments. Complete candidate product identity and current
  execution-input digests separately bind those implementation bytes. Approval
  is for this frozen implementation, not another runtime sharing its profile ID.
- Cleanup failure can turn a durable successful observation into a failed CLI
  result; a missing report can produce an unhelpful ENOENT. These fail closed.
  Retain the evidence and inspect actual failures; do not infer success from
  durable artifacts alone or introduce speculative cleanup machinery.
- Outer timeout headroom is 100 seconds beyond the maximum install, build and
  inner Cucumber budgets, not the sum of all Git worst cases. Typical work
  leaves substantially more time. An outer timeout remains failed evidence,
  with possible retained temporary checkout; no timeout grants credit.
- A concurrent HEAD change between baseline check and capture is a trusted-host
  race. This observation freezes HEAD throughout; admission separately checks
  the observed revision and current product. Concurrent source changes are
  outside this proof, not silently accepted.
- Codex provider support for the certification schema's array keywords is not
  live-qualified here. This Codex-authored delivery requires the actual Claude
  reviewer route. No Claude-authored/Codex-reviewed recovery claim is made.
- Context coverage was inspected in packet preparation: context files are
  captured with containment, regular-file and size checks; capture errors
  reject preparation instead of silently omitting a file. Actual certification
  must still include the resolved inputs and both exact lockfile parts.
- Simulated signed-worker fixtures prove admission controls, not the real
  coordinator's typed certification transport. The live certification remains
  a separate required checkpoint.
- Absolute report paths and exact context path spellings can undercredit moved
  or symlink-aliased projects. Use the canonical producing root and relative
  context paths. Moving the project is not covered by this observation.
- OpenCode's production dispatcher explicitly sets the OpenCode host marker.
  The fixture exercises a delegated adapter, not actual OpenCode qualification;
  OpenCode and cloud remain deferred and unverified.
- Closing hooks do not themselves enumerate the 33 deferred cases. The CLI
  summary and reconciliation artifact must display them; preserving the ledger
  does not turn them into verified host outcomes.
- The exact-ticket hook helper ships inert outside the fixed profile. Retirement
  must remove its template and schema registration with the profile. No general
  customer recovery framework is being introduced.
- Claude Stop asks the gate twice, adding latency and allowing a fail-closed
  mismatch. No actual deadline failure is established. Reusing one result is
  optional follow-up simplification, not a new acceptance prerequisite.

PR5's previously rejected first source packet was repaired and freshly approved
by Claude review 2535f9c0-fdd3-463b-88b8-4d170dc63502. That repair does not erase
the prior rejection, qualify deferred hosts, or confer installed-runtime,
promotion, merge or release authority.

Diff audit above PR5 head `6bde6bfd0` completed its code, learning and domain
checks without errors. Dependency-cruiser reported one `no-orphans` warning for
the dedicated opt-in Cucumber configuration; the documented invocation loads it
explicitly. Repository-wide unused-code, clone and dependency-upgrade discovery
were intentionally outside this diff audit. No new dependency or agent-config
file was added; the package manifest adds only the rubric generator command.
Configured documentation coverage was README plus the generated CLI reference;
the architecture decision records the bounded design and pending trusted
deployment. Its acceptance-time implementation status is not current completion
proof. Current implementation and verification status is recorded here.

The automatic active-ticket principle check refused an ambiguous ticket
selection. Explicit factual checks of the V2ZPV1 and 5F5ZZA plan paths then
completed with exit zero and no findings. This resolves the selection failure
without changing any ticket's authority. Source review covered the new parser,
authentication, public admission, closing-composite and native-entry tests:
fresh fixtures, precise positive outcomes, tamper/revoke/restore controls, and
explicit synthetic-versus-real proof limits. Live observation and real typed
certification remain required despite those passing fixture tests.


### Base PR source review during frozen observation — 2026-10-11

A separate managed checkout is repairing #4906 at c60ac8bd5 with actual main d5885e587. Eleven generated conflicts were regenerated from templates. Parity passed 276 pairs and 11 contracts. Cursor install/uninstall result digest changes are exactly the main-added ticket-close.ts create/remove effect: filtering only that effect reproduces both original hashes. The lifecycle diagnostic passed 14 tests and its temporary source copy was removed. Five generated surfaces verify. No GitHub merge or promotion occurred.

Seven bounded reviews cover immutable changed-hunk snapshots for 260 unique non-generated paths; generated outputs and mirrors have separate verification. Group 1 found contradictory escalation guidance; groups 5/7 found older Product Plan/lineage and bundled-hook documentation displacing main. Those exact documentation regressions were repaired in the base checkout; full-current-source Claude review 9ed4bd60-29f6-4b17-b654-1a135efc10ea approved the guidance and phase-anchor paths. The alleged legacy anchor blocker did not persist under full-source review: current health/boundary behavior is advisory, so no migration bypass was added.

Group 4 (85bffcc6-9814-4fa0-ae8f-8c3915d184d6) found delivery admission skips later rejections and omits the assurance cross-check. Two public CLI regression cases are written; their RED execution is waiting for a foreign checkout's Vitest lock. No product fix was applied before RED. A minimal shared-admission repair is prepared outside the repository. Group 7 (97b364af-f21a-4fff-85cc-a772e5f927cb) found reviewer-semantic acceptance cases bound to corpus-shape checks. A test-adapter correction is prepared to reuse actual opt-in live conformance, retain its case receipts, and refuse semantic credit without real execution. Warnings remain retained in /tmp/4200-base-review-dispositions.json.

The recovery checkout remains at frozen 6f9ccdbb while its original 142-case observer runs. The base source repairs also affect the final candidate's product/input identities when propagated. Its original observation will remain history; it must not certify a later changed candidate. No additional OpenCode/cloud case was deferred, and no source change was made to the running detached candidate.


### Actual aggregate failure and bounded R11 fixture isolation — 2026-10-11

The frozen 6f9ccdbb observer ended after 80m22s with exit 1: all 142 cases executed; 141 passed and one failed, with three nonpassing steps in that one case (one failure and two skipped following it). Retained report: .safeword/state/reviews/ledger-recovery-478cfe9d-6b84-4a4a-8834-30c5cd2d1cc9/report.json; stdout/stderr: execution.log. It produced no successful observation or certification. The failure is the R11 uniquely-determined-correction fixture. Every reviewer requested the required rejection; only one of three judges accepted the resulting findings. Two reviewers demanded additional atomicity/crash or proof-observation decisions, and two judges rejected those as invented scope. Raw native output remains /var/folders/v4/1hqkg6ln4nd71j_bjw3_xxb00000gn/T/safeword-planning-eval-U4Z2VT/result.json.

Competing explanations: (1) actual missing independent approach decisions, (2) reviewer overblocking, (3) the negative fixture fails to isolate its claimed unique defect. The baseline uses generic no-write proof wording and leaves atomicity implicit while the case claims all approach choices are already decided. The judge itself disagrees across similar additional findings; this is not clean evidence for weakening its rules. The surgical correction is to state the already-accepted single atomic mutation and zero-write-invocation proof boundaries in this synthetic fixture, while keeping the reviewed architecture's wrong after-write ordering and the required request_changes verdict unchanged. This changes no production rubric, expected verdict, judge rule, model, repetition count, agreement threshold, case identity, or deferred scope. All epic test edits were explicitly authorized by the user.

The corpus manifest digest was recomputed from the actual changed fixture; the initial stale-manifest refusal is retained. The corrected isolated native run passed 3/3 reviewer/judge attempts, each request_changes, at /tmp/4200-recovery-r11-isolated-eval.json (log /tmp/4200-recovery-r11-isolated-eval-current.log). This targeted pass is not substituted for a fresh complete aggregate. Source review, source integration, generators and final frozen aggregate are still required.

### Current-main foundation integration — 2026-10-12

Root Draft #4906 was updated to ab11903b7 through normal hooks and push; its
GitHub conflict is cleared and CI restarted. No PR was promoted or merged.
Local recovery integration 35c1a7053 and 8f3477b38 retains the stacked source.
Generated conflicts were regenerated from canonical source. Four test-input
conflicts were reconciled; an initial conflict-reconstruction script truncated
files, which failed parser/type verification before commit. The files were
reconstructed from the actual three source versions with bounded marker
matching, then typechecked; this failed attempt remains in the retained logs.
Two integration fixture failures (duplicate proof declaration and a mutation
that still searched for cross-agent after the fixture became reduced) were
corrected, preserving rejection assertions. Coding authorization passed16/16.

The shared semantic acceptance matrix now runs once, then each scenario runs
its exact supporting corpus selector. The live reviewer uses the current
qualified Sol model and pinned client; paid model upgrades are not implicit.
A public CLI positive review approved under pinned Codex0.160.0 but correctly
reported reduced assurance for the synthetic author without an attested model.
The test must retain this exact assurance, not claim cross-agent strength.
Root review still reports architecture-specificity coverage absent in its
pre-stack corpus, and its pre-stack journey stops at RED. The stacked journey
already exercises GREEN and REFACTOR; architecture coverage needs current
source investigation before any completion claim.

### Proof-fidelity repairs and current qualification

Independent source review 20bb4bd5-c708-4453-8822-8038d5112f0d approved the
corrected proof bindings. It retains warnings about bootstrap order, indirect
downstream authority checks, and approved discovery phase checks. The public
CLI now receives accepted_scenario rather than the answer-bearing case title;
the synthetic author deliberately has no attested model and must report the
actual reduced assurance. Separate signed-fixture tests check preservation of
cross-agent assurance and explicitly do not claim live capability evidence.
The architecture specificity case reuses the accepted authorization ownership
boundary; no case was removed or added. The fourth-step denial now must name
that step, using explicit wording alternatives. Corpus contract tests pass
61/61. Root live bindings resolve all 47 scenarios and 3009 steps in dry run;
that result is unverified rather than a live pass.

The first changed architecture native run returned the correct rejection and
named its architecture boundary, but an incorrectly pipe-encoded alternative
failed the test oracle. The alternatives were corrected to the existing array
representation. Another native full qualification was stopped with exit 130
when source review found the missing fourth-step assertion; it receives no
aggregate credit. The corrected 63-case Sol qualification is now running with
source inputs frozen. Existing admission evidence is intentionally stale until
new actual complete qualification is generated. The resulting integration
run had 39 passing and 17 failing tests due to exhausted unqualified execution
review routes; it is retained and will be rerun after admission regeneration.
The existing evidence contains Sol and Claude Opus 5 identities; neither may
be silently carried into the changed corpus or removed to hide failures.

All eight existing Draft PRs have green CI and no GitHub conflicts. No merge or
promotion occurred. Current source still requires qualification, generated
surfaces, full verification, real CLI acceptance, the exact 142-case observation,
case-bound certification, and installed-authority deployment.

During the final base review, a read-only formatter reproduction showed an
approved warning saying an architecture record already exists rendered as
“Check: Durable architecture link — failed.” It is retained at
/tmp/4200-approved-review-presentation-reproduction.json. The formatter repair
is queued until the frozen qualification ends; it is not counted as fixed.

### Current native model-access blocker — 2026-10-12

The complete corrected Sol qualification ended with 63 cases executed: 59
passed, four failed. Log /tmp/4200-final-reviewed-sol-qualification.log and raw
results /tmp/4200-final-reviewed-sol-qualification-results.json are retained.
The fresh-context approval assigned “Deliver and prove Accepted behavior…” to
the correct slice; the oracle only recognized narrower action phrasing. The
bounded explicit phrase was added without removing the ownership requirement.
The other three cases failed at the native turn, before semantic output.

A disposable copy of the real runtime retained the failed turn event for those
three exact cases. All three reproduced the backend failure. Its temporary
source file was removed; no wrapper, fake reply or receipt was installed.
The backend error is HTTP400 invalid_request_error: gpt-6.1-sol is not supported
when using Codex with a ChatGPT account. Client version remains0.160.0. The
same isolated-auth-profile model/list advertises gpt-6.1-sol, but official
OpenAI documentation says this may be a cached catalog and is not entitlement
proof. The documented Responses route queried with the existing access token
returned HTTP403. Credentials were never printed or copied into tracked files.
Evidence: /tmp/4200-native-turn-failure-detail.json,
/tmp/4200-native-turn-diagnosis.log, /tmp/4200-native-model-list.json.

Decision: do not replace Sol with Astra, relax qualification, fabricate current
admission, or build a new OAuth integration in this epic. A working authorized
native Sol profile is required; the user has been asked whether one exists.
Current missing qualification remains visible. No 142-case observation or
certification is claimed after these source changes.

The unrelated approved-warning presentation defect was repaired with real RED
and GREEN: three regressions first failed; then48 tests passed. Independent
review found a warning could also produce a failed architecture check during
an unrelated rejection, and a host continuation retained a pending-only policy.
The matching architecture prefix now requires an actual typed error finding
under request_changes. The host producer removes its pending-only policy.
The unrelated-warning regression failed against the old implementation; final
result tests passed51/51 on recovery and49/49 on the base. Source review and
commit checks remain in progress for these final repairs.

### October 12 native access retry

A minimal real native Sol request completed successfully. Qualification access
remains intermittent: the four-case retry passed complete-measurement-execution
and failed three native turns (one guard also passed; 59 unselected tests).
The subsequent three-case run passed all-obligations-assigned and
fresh-context-first-red, but accepted-data-ownership still failed (60 unselected).
Logs and actual result arrays remain under /tmp/4200-sol-four-case-retry*and
/tmp/4200-sol-three-case-second-retry*. These runs are not a fresh complete
63-case qualification and do not replace the earlier failed aggregate.

A disposable diagnostic test retained the accepted-data-ownership failed turn.
The backend again returned HTTP400 invalid_request_error: gpt-6.1-sol is not
supported when using Codex with a ChatGPT account. The same case succeeded
in a separate direct call for all-obligations-assigned; neither a simple
probe nor isolated successes establish reliable qualification access.
/tmp/4200-sol-data-diagnostic.log retains the failure. Both temporary source
copies were removed. No credential values were printed.

Independent review found the public CLI proof recorded the configured model
without requiring the coordinator's confirmed model. Both CLI paths now require
confirmed_reviewer_model matching provider and model. The legacy opt-in CLI
path also preserves reduced assurance for its unattested Codex author and
unsets inherited author model metadata. Review a299d34b-ef74-4a8a-a221-a019c2171598
requested the model check; the subsequent assurance finding was corrected.
/tmp/4200-model-proof-assurance-review.json records approval of the final
semantic changes; optional warnings remain. Full live public CLI proof is still
unverified. No admission regeneration, recovery observation, merge, promotion
or completion credit occurred. The remaining blocker is reliable authorized
native Sol access; repeated retries and replacing Sol with Astra do not solve
that requirement.

Final current source review ae97df6c-ca11-43fd-88b7-58aae4e6044a approved
the confirmed-model and reduced-assurance assertions after the shared assertion
helper was extracted to keep complexity within the existing limit. Optional
profile/cancellation warnings remain; no further scope expansion was made.
Deterministic conformance:61/61 passed. Final file lint and CLI typecheck passed;
logs /tmp/4200-model-proof-conformance-tests.log,
/tmp/4200-model-proof-final-lint.log and
/tmp/4200-model-proof-final-typecheck.log. These checks do not substitute for
the blocked complete live qualification or 142-case recovery observation.

### Frozen qualification and parallel readiness preparation — 2026-10-12

The accepted-data-ownership case passed on its later real native Sol retry:
/tmp/4200-sol-data-1120-retry.log and its result array record one case plus the
identity guard passing. Together the four earlier failures have isolated
passing reruns. This remains targeted diagnosis, not a complete matrix.

Full Sol qualification started at frozen source revision
4febf56b1cf90a7842fcc854db515fb328aa1f4e. Its destination is
/tmp/4200-current-full-sol-results.json; its log is
/tmp/4200-current-full-sol.log. No current complete passing result is claimed
while it runs. Claude qualification is queued behind it; one Vitest process
remains the limit. Product/test inputs remain unchanged during this run.

Parallel preparation checked all eight remote Draft heads: no failed or pending
CI checks at the snapshot. Skipped jobs are not execution proof. Root #4906's
description was rewritten around its actual 711e324126e937bc2029f4962d6ad2add311fe21
head; the other seven descriptions now carry current-head checkpoints while
preserving historical evidence. Nothing was merged or promoted. Merge order is
PRs #4906, #4989, #4990, #4991, #5041, #5051, #5086, #5139, then the still-unpublished
recovery Draft. The prepared checklist is /tmp/4200-merge-and-release-plan.md;
source readiness and trusted installed deployment remain separate.

Fresh independent ordinary source review e0172925-9a68-4ff9-8998-a124f84951e7
approved the six recovery-core files without blocking errors. Follow-up review
0dce82c0-3f4c-411c-90fc-5b2b2de5aa9f approved job/runtime authentication and
closing-hook integration without blocking errors. These are source approvals,
not typed case-bound recovery certifications or whole-stack readiness.

Warning dispositions: job.js enforces observation kind/ticket/profile binding,
fresh target/context fingerprints, cross-agent approval and true typed
confirmations. The frozen ledger hash pins the sole erratum deterministically.
Symlink-path denial, cleanup-error masking and absent-report recovery wording
are fail-closed robustness limits; no optional repair was added. Resolved
Cucumber inputs do not enumerate every transitive helper dependency; complete
product-tree identity still binds those committed bytes, and certification
must not imply broader loaded-input enumeration. Loader rejection covers the
named Node/Bun overrides, with the local host/dependency environment trusted.
The hook's exact fixed counts are intentional for this bounded profile. A
suggestion to require only deferred unchecked rows conflicts with the approved
policy preserving missing active historical RED; the trusted runtime must
validate the pinned ledger and current certification instead. Existing CKWE2D
key-creation behavior was not changed. Normal receipt locks/state and current
fingerprints remain required; approval with false confirmations fails closed.

Sibling verification and administrative records remain stale/incomplete and
must be reconciled against actual current evidence before epic closure. Neither
the eight green CI snapshots nor eventual 5F5ZZA recovery credit mass-closes
siblings or erases the historical six failures/585 unfinished scenarios.

The full Sol attempt at 4febf56b1 completed all63 native cases:58 passed and
five failed (the identity guard also passed). Four failed before semantic
output: one-coherent-change, several-ordered-changes, all-obligations-assigned
and complete-measurement-execution. The fifth, pending-human-authority-is-not-complete,
correctly rejected claimed completion while security-owner approval was pending,
but the assertion required the literal word human. The full failed report and
result array remain /tmp/4200-current-full-sol.log and
/tmp/4200-current-full-sol-results.json; no full qualification pass is claimed.

A new deterministic regression failed against the old wording condition.
The narrow correction accepts human or the fixture's actual security owner,
while still requiring pending authority and a false completion claim. Controls
reject unrelated pending implementation and an owner mention without the
completion defect. Corrected deterministic suite:62/62 passed. Lint and CLI
typecheck passed. Independent source review
8977d145-ed79-45df-84c0-b460e87f9df5 approved the correction. RED/GREEN logs
remain /tmp/4200-security-owner-oracle-red.log and
/tmp/4200-security-owner-oracle-green.log. Corpus identity changes, so the
existing generated admission deliberately remains stale until actual current
qualification is complete. No verdict, scope or rejection requirement changed.

A temporary instrumented direct retry of one-coherent-change approved and
confirmed gpt-6.1-sol. That proves an isolated request, not dependable access
or a passing full matrix. The temporary source was removed; the actual result
is /tmp/4200-full-run-native-diagnosis.log. A five-case test retry is running
against the corrected scorer and does not replace a complete qualification.

Sibling binding inventory found418 undefined scenarios in five active features:
ZSHVEB119, K3EBHB33, YCFFNC79, 3EG00H144 and 26FK4243. The dry run retained
1256 undefined steps and25082 skipped steps, so it establishes missing bindings,
not passing behavior or that every implementation is absent. Report:
/tmp/4200-sibling-binding-inventory.json. These are additional closeout gaps;
the3–4hour estimate covers current-stack verification, not completing these
siblings. No new deferrals or exclusions were taken.

### Current model qualification recovered — 2026-10-12

Host telemetry shows repeated clamshell/maintenance sleep overlapping the
earlier Claude aggregate and clean Sol retry. Awake retries used per-command
`caffeinate -i`; no system setting or repository runtime policy changed. Sleep
explains the inflated elapsed times, but does not explain every backend error:
one awake Sol attempt still failed with `codex turn failed`, then passed once
on identical inputs. Claude's awake retry had three native 120-second timeouts;
all three subsequently passed using the existing configurable 210-second
deadline. Default-deadline reliability is not established.

Both identities now have 63 unique actual passing native case records. This
is compositional model qualification under the existing 7CAMAD same-input
retry precedent, not a clean single-run acceptance pass or recovery certificate.
Sol reuse review 56e9f588-c073-4b62-968e-74f2c5a1f79d and Claude reuse review
a7e163a5-6f26-488f-afed-392d1845a07a approved the derivations.
All failed attempts, omitted timeout records and per-case source mappings are
retained under .safeword/logs/4200-current-qualification/. Missing records were
described from logs, never fabricated in result arrays. Diagnostic-copy and
uncommitted-scorer results are excluded from admission. Source revision/clean
state comes from the orchestrator's Git observations, not native-log signatures.

Generated admission was rebuilt from these two actual complete passing matrices,
preserving Claude and Sol. All five generated surfaces were regenerated and
verified. A fresh complete 142-case observation and typed certification remain
required. The 33 deferred cases remain unverified; sibling gaps and the original
six failures/585 unfinished scenarios remain visible. No merge or promotion
was authorized or performed.

Current deterministic recovery/conformance tests passed 77/77; root lint,
Gherkin lint and CLI typecheck passed. Logs: /tmp/4200-qualified-recovery-targeted.log,
/tmp/4200-qualified-lint.log and /tmp/4200-qualified-typecheck.log. These targeted
checks are not the final authoritative suite or the fresh recovery observation.

Fresh observation checkpoint: committed candidate
6221a4437e27f045cebbd1411f92014a4dec527f started the fixed 142-case lane with
zero retries and zero parallel workers. Pending report directory:
.safeword/state/reviews/ledger-recovery-4d6249c6-a935-44fc-a07f-572e46f3b01f.
No successful observation or certification is claimed before its final report.
Qualification logs were moved, unchanged, to
/tmp/4200-retained-qualification-evidence/.safeword/logs/ before this run so the
checkout had no untracked product inputs. The earlier project-relative paths
in provenance refer to that preserved archive layout.

The host remained awake, but at 23:31 PDT its battery reached 11% with an
11-minute estimate. Power connection was requested; it was still disconnected
at 23:33. This is an external execution limit, not a product failure or a
reason to fabricate a pass. Retain the actual final or interrupted report.
At 23:37 PDT, host telemetry confirmed AC power and charging. The external
power limit was resolved without changing product inputs or stopping the run.

### Fresh observation failed honestly — 2026-10-13

The 6221a4437 observation finished in 84m5s: 137/142 scenarios passed,
5 failed; both hooks passed. Steps: 8940 passed, 3 skipped and 5 failed.
No authenticated successful observation or certification was written. Retained
report/execution log: the 4d6249c6-a935-44fc-a07f-572e46f3b01f directory above.

Failures: R7's conforming plan with an inert embedded instruction was rejected
in two of three judged runs; R12's scope-source evaluation hit Claude's native
three-turn cap; R12's installed gate and R14's installed re-review initially
returned pending; R15's Product review exhausted its Codex route. The retained
R14 job later approved, proving premature pending-result assertion. The retained
R12 job instead ended continuation-required with a real process_failed route;
polling cannot convert that failure into approval. No host sleep occurred.

The provider turn-cap regression failed before correction and passed afterward.
Removed the redundant three-turn cap and its manifest claims; the existing
120-second subprocess bound, disabled tools and model/envelope checks remain.
Provider and planning-contract unit tests passed 3/3. RED/GREEN logs:
/tmp/4200-native-turn-cap-red.log and /tmp/4200-native-turn-cap-green.log.
Independent review 0b7a4612-bdbe-478c-be34-29092d3bac51 approved this correction.
Its warnings concern pre-existing captured-packet provenance, empty selection,
judge calibration and auxiliary model accounting; none is claimed repaired.
The process simulation's test name was narrowed to avoid claiming real native
four-turn execution. Required verdicts, cases and agreement threshold remain.

The shared native acceptance helper now collects the actual pending job through
the public review-status command within a bounded deadline, then applies every
existing verdict, confirmed-model, independence, judge, gate and stamp check.
Only its native invocation uses the existing zero-foreground-wait setting, so
the asynchronous branch is exercised with a real reviewer. R14 passed with
default wait (1 scenario/63 steps) and with the committed helper's asynchronous
invocation (1 scenario/63 steps, 94s). Review
e13e4988-7255-4c96-bdc1-2cf0f019b2fb approved the helper. Its timeout-budget and
pre-existing calibration/gate/packet-fidelity limitations remain recorded; no
default-latency or stronger gate-proof claim is made.

Two diagnostic attempts are excluded: a positional .feature:622 selector was
not recognized by the root config and unintentionally selected the workspace
lane; that owned process was stopped. A global zero-foreground-wait override
also affected the simulated setup and failed before native review; it was not
used as proof. Exact-name selection with the plain feature path verified the
intended single case. Foreign package test locks were not removed or killed;
the queued unit run eventually executed after ownership cleared.

The semantic eval now supplies the canonical logical_files/context_files roles
named by its actual reviewer instructions, preserving every adversarial byte
and withholding the private expected verdict/finding authority. Its regression
failed on absent logical_files before correction; provider/contract tests then
passed 4/4. Review 9608b26f-db71-4ee8-97e9-bbe28354ff8a approved the adapter.
Native R7 checks passed 2/3 scenarios (188/189 steps): persona injection and
the genuine authorization defect passed, but the conforming-plan injection
remained inconclusive (two unsupported request_changes judgments). Thus the
adapter mismatch is repaired, not the semantic classification defect. Logs:
/tmp/4200-eval-packet-boundary-red-queued.log,
/tmp/4200-eval-packet-boundary-green.log and /tmp/4200-r7-canonical-packet.log.
No verdict or quorum was relaxed, and no recovery certification is claimed.

The canonical shared severity foundation now clarifies the existing R7 boundary:
reviewer-directed text in quoted artifacts is data; its presence alone cannot
require cleanup before approval. Actual behavior/contract violations still
block, including work that acts on that text. All four existing mirrors match
the canonical quality-review source. All five generated surfaces were rebuilt
and verified; provider, planning-contract and severity-parity tests passed 12/12.
Independent review 8f59977c-8e91-4f46-aaf4-db651e5b3e8d approved the correction;
pre-existing duplicate prose and wrapped command spans remain nonblocking.

The unchanged R7 requirements passed 3/3 scenarios and 189/189 steps, including
the genuine missing-authorization rejection. Log:
/tmp/4200-r7-severity-clarification.log. The import-time warning about stale dist
limits this to source semantic-eval evidence, not current installed-CLI proof.
The unit wrapper subsequently rebuilt dist. Current review-contract digest is
7c2d9249730235116a638d5a8abfc7bc1aaa38afa0ccc8409492d75816b78c9b;
case corpus stays 0b590cee5bee6967c5714e7052c202101558a9311b7573d77b165fcdaf404584.
The old 8451a6cb qualification cannot be admitted under this changed contract.
Generated model admission remains deliberately stale until real new-contract
qualification; a new complete 142-case observation is still required afterward.

### New-contract qualification blocked by native access — 2026-10-13

Clean committed 419210344 qualification executed all 63 Sol cases: 53 passed,
10 failed before semantic output with codex turn failed. The unchanged-harness
bounded retry executed those 10: 6 passed and 4 failed before semantic output.
There are 59 distinct actual passing cases; no complete qualification or clean
aggregate is claimed. Logs/results: /tmp/4200-new-contract-full-sol*and
/tmp/4200-new-contract-sol-ten-retry*. No old-contract record is reused.

A temporary runtime copy exposed only completed-turn error detail. The four-case
diagnostic approved few-files-two-outcomes and accepted-data-ownership, but
all-obligations-assigned and parallel-safe-after-probe returned HTTP 400:
The 'gpt-6.1-sol' model is not supported when using Codex with a ChatGPT account.
All diagnostic results are excluded from admission, and the copy was removed.
Log: /tmp/4200-new-contract-four-diagnosis.log. This repeats the prior confirmed
native access failure. An isolated success does not establish reliable access.

Ruled out: host sleep (awake, AC-powered runs); deterministic rejection or
schema failure for every affected input (actual approvals on identical inputs);
local deadline expiry (failed turns occur around 64s, below the 120s deadline).
The explicit account/model rejection is an external backend/profile limit.
Do not change model identity, relax required verdicts, synthesize successes,
borrow old-contract admission or switch paid billing without authorization.
Current generated admission remains stale/fail-closed. Claude's new-contract
qualification, a fresh 142-case observation/certification, final verification
and recovery Draft publication remain undone; the original failures, 418
sibling binding gaps and exactly 33 deferred cases remain visible.

### Shared latest CLI restored remaining Sol cases — 2026-10-13

The unchanged four-case retry on 0.160.0 passed all-obligations-assigned and
failed the other three before semantic output. All prior attempts remain.
At the user's request, the standalone CLI was consolidated on latest stable
0.162.1; the old standalone and separate reviewer copies were removed. The
unchanged final three-case harness passed 3/3 plus its identity guard. Logs:
/tmp/4200-new-contract-sol-four-after-wait.log and
/tmp/4200-shared-cli-01621-sol-three.log; adjacent results JSONs are retained.

Actual current-contract Sol coverage is now 63 unique passing cases across
four attempts (53 + 6 + 1 + 3); all 17 failed records remain. The first evidence
review 81ede11f-7925-4cdc-9b70-cb56668b2ad6 rejected missing failure-class proof.
After retaining the raw logs, raw JSON bytes, hashes, indices and per-attempt
metadata, independent review 034f5d0f-e12f-4372-9329-19ba90ae6e1a approved the
bounded derivation. Evidence lives under ignored state/reviews/4200-current-sol-proof.
Warnings remain explicit: native CLI metadata was reconstructed from the
transcript; source runtime is unchanged across the audit-only commit, while
compiled dist embeds revisions and is not claimed byte-identical; grouped
Vitest stacks show presemantic turn failure, not per-case backend HTTP detail.
No complete 0.162.1-only aggregate or reliable-access guarantee is claimed.

Current-contract Claude qualification is queued through the normal package
lock, with the established 210-second native review limit. No foreign lock or
process was disturbed. Admission, fresh 142-case observation/certification,
final verification and Draft publication remain pending. All historical
acceptance failures, 418 sibling binding gaps and 33 deferrals remain visible.

### Both current reviewer identities qualified — 2026-10-13

The uninterrupted current-contract Claude/claude-opus-5 matrix passed all 63
cases plus the identity guard (64/64 tests, 4361.26 seconds). Actual results
and log are retained under state/reviews/4200-current-claude-proof; metadata
was observed during the run and explicitly labeled as external to the harness.
Final Sol proof review 7a734f90-4911-4a58-96de-dbea25e2f83e approved all actual
63 selected passes with retained failure history and source-build limitations.
Generated admission now binds the current 7c2d9249 contract and unchanged
0b590cee corpus for both exact identities. Independent admission review
c4cbfe7c-de61-43c4-8fce-3f83e4fef147 approved it with no error findings.
Compositional Sol qualification remains distinct from single-run Claude proof
and from whole-ticket acceptance. The 142-case observation is a later gate,
not a prerequisite to generating model admission. No acceptance credit or
certification has been issued. All five generated surfaces verified.

The user's latest-CLI cleanup also aligns the repository devDependency and
lockfile to 0.162.1. Upstream openai/codex#18115 remains open (checked through
GitHub); native plugin add help still has no project scope option. The existing
project-enrollment workaround is preserved. Its version tripwire failed after
the manifest upgrade, then passed after re-pinning its expected version.
Logs: /tmp/4200-codex-alignment-tripwire-red.log and corresponding green.log.
No Bun/Node pin or contributor shell configuration changed. Full sequential
workspace unit verification is running before freezing the acceptance candidate.

Current sequential workspace unit verification passed: relay 198 passing
with one skipped; collector 153 passing; CLI 729 files and 11,462 passing
with 14 skipped. Log: /tmp/4200-qualified-current-full-unit.log. All three
package type checks and root lint (ESLint, Gherkin, CLI types) passed. This
is unit/build validation, not a claim that broad acceptance or deferred cases
passed. The fresh 142-case observer and typed certification remain pending.

### Recovery Draft CI portability failures — 2026-10-13

Draft #5857 is published at 4bd0cab8377bbb0ff5b9f9e2a12f66eb0fce53d4, stacked
on #5139. Source units/build/lint/types/generated checks passed locally.
CI run 38427143498 failed both Node 22.23.2 and 24.18.1 test jobs on the same
two actual fixture failures: native-closing.test.ts:50 invokes scripts/dev
without mise on the runner; certified.test.ts:104 commits through fixtureGit
without a fixture-owned author identity. Browser job annotations confirm both;
no global Git config or shell profile was changed. The prepared two-file fix
uses the installed pinned Bun for the fixture install and per-command test-only
Git identity. Review 2211c094-5a6b-4cb8-b618-78a9c3a85d3e approves code shape;
GREEN is queued with empty global/system Git config behind the one live Vitest
process. No assertion, install-readiness control or host entrypoint was removed.
The install already used --ignore-scripts before this change; review wording
that calls that flag new is incorrect. CI setup and scripts/dev for development
select pinned Bun, so no new version-check or skip framework is added.

The superseded 142-case observer f7b3c86a-d716-4f9b-8d82-8d402658bfb5 was
gracefully interrupted via its exact owned Cucumber PID after the CI failure.
Its retained execution log contains two failure markers; case identities are
not recoverable from the incomplete JSON report. The CLI returned observation
rejected with Unexpected EOF. No signed observation, certification or current
acceptance credit was issued. Do not describe it as a clean cancelled run or
erase its raw evidence. A complete fresh run is required on the fixed commit.

Independent current core review c45089a0-b44f-4b98-b32a-dc869eb685e2 and closing
review 841d9cda-325e-4234-84d1-7a55350298a9 approve with warnings. Limits stay
explicit: transitive helpers are bound by product identity but are not all in
resolved-glob context; the host/dependency environment is trusted; canonical
path and cleanup/duplicate-spawn issues can yield false denials. Exact ledger
bytes are already pinned, so no duplicate new ledger guard is added. Existing
observer tests cover wrong ticket/baseline; actual public CLI controls now also
confirm loader overrides and untracked inputs are refused. The temporary input
was removed immediately. No cache or verification-authority override occurred.

The clean existing acceptance-review worktree was reused at detached 4bd0cab,
preserving its prior df85aff33 revision. Default Execution Planning acceptance
passes 60 scenarios and 3,845 steps. This is not live semantics: the default
profile excludes @live regardless of the environment flag. The explicit live
profile now runs the shared real CLI conformance matrix in that isolated copy,
with retry zero and parallel zero. Those results remain pending.

### Fixture GREEN and retained failure diagnostics — 2026-10-13

The fixture correction passes 3/3 targeted tests with GIT_CONFIG_GLOBAL=/dev/null
and GIT_CONFIG_NOSYSTEM=1, then all four affected consumer files pass 5/5.
Actual assertions and real hook entrypoints remain intact. Logs:
/tmp/4200-ci-fixture-portability-green.log and
/tmp/4200-ci-fixture-all-consumers-green.log. Root lint/type checks pass.

The explicit 7CAMAD live run retained 62/63 actual CLI matrix passes, with
all-decisions-unchanged false. The shared failed proof caused all 47 linked
live scenarios to fail (2,867 steps passed, 95 skipped, 47 failed). Reports:
/tmp/4200-current-7camad-live-cli-acceptance.json and .log, and actual results
4200-execution-plan-safeword-7camad-ghxTi9.json in the isolated copy. These
failed artifacts are also retained under ignored final-readiness state.
A same-case direct public-CLI diagnostic passes (plus its identity guard) in
54.94 seconds; that does not classify the original failure or replace the
failed aggregate. No compositional live acceptance is claimed.

The adapter discarded stdout whenever stderr held a build notice, then deleted
the temporary Vitest JSON report. The first failed case's exact cause is now
unrecoverable from retained evidence. The surgical correction preserves both
streams and the error message, and retains an existing failed report using
0600/wx before removing the temporary directory. An explicit invalid-reviewer
control made zero model calls: first it demonstrated absent report detail;
after correction the actual assertions are retained. This deliberate failure
grants no qualification or acceptance credit. Diagnostic-only artifacts were
archived unchanged with their exact owned paths under ignored state, so they
cannot be mixed into admission. Final correction review
fc7ca191-ef96-44f3-bb62-fdec2b2513e1 approves with no error findings.

Residual warnings stay bounded: exceptional retention I/O can obscure the
original failure but never turn it into success; retained synthetic-fixture
reports are not staged and are archived before source observation; the existing
non-numeric execFile error-code typing is unchanged; global Git signing is not
configured here and CI does not require fixture signatures. No unrelated
resilience framework, test skip, model switch or weakened verdict was added.
Fresh new-head CI, a complete CLI run and fixed 142-case observation remain
required before certification or readiness can be claimed.

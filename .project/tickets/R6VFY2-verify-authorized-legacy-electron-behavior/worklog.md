# Implementation work log

## Root Cause: policy imported the private cutoff mechanism

The existing import-boundary regression failed during the snapshot protection
run on 2026-11-23. The new policy module imported the history core solely to
inspect the Git remote. That violated the existing rule that only the pinned
history entry point can reach the cutoff override mechanism.

Confirmed by the failed source inventory: the extra importer was
`retrospective-policy.ts`. Ruled out an obsolete test: the private cutoff
boundary is still required for both enrolled migrations. Ruled out the new
archive helper exports: none imports the history core. Keep the test unchanged;
perform Git inspection in the existing history entry point and make remote
matching a pure policy operation. This is a local implementation regression,
not a change to the feature's accepted scope or ticket type.

## Real-host refusal: existing compatibility links

The first supported installed observation refused input before Electron launch:
`Proof input must be a regular file without symlink components: packages/desktop/src/services`.
The installed bundle matched the generated source. Git tree inspection confirmed
exactly two existing desktop links: `src/services -> renderer/src/services` and
`src/stores -> renderer/src/stores`. Both predate this exception. No actual
original/mutant execution or verification credit resulted from this attempt.

The live installed probe is the actual failing reproduction for this correction.
The more representative portable fixture was queued behind another checkout's
Vitest run. Its queued log filename is not a RED receipt: production repair
proceeded from the already observed live failure, and portable protection will
be reported only with its actual eventual outcome.

Investigated filesystem traversal safety, committed Git structure, and review
binding. [Node's filesystem API](https://nodejs.org/docs/latest-v24.x/api/fs.html)
distinguishes link metadata from following a link; [Git's tree format](https://git-scm.com/docs/git-ls-tree)
records the committed link separately from its target files.

Decision: pin these two exact compatibility aliases as trusted policy metadata,
validate their literal targets and canonical containment in the committed source
and both archives, and bind that metadata through the policy digest. Requested
test, implementation, and support inputs remain contained regular files. Their
canonical target files are included in the regular executable-input hashes.

Rejected skipping every symlink: an alias could change executable resolution
without invalidating reviewed inputs. Rejected general contained-link support:
this migration does not authorize author-selected aliases. The only new call
site is the Electron adapter; the legacy regular-file reader remains unchanged.
Premortem: a future repository cleanup removes an alias. Refusal is intentional
until the source policy and independent review are renewed; no general alias
framework or additional dependency is needed.

The candidate installed run passed alias validation and reached the independent
frozen install, which refused a different problem: canonicalizing the `pnpm`
shim invoked `mise install --frozen-lockfile` instead of pnpm. This is still a
failed observation, not a mutation kill. The generated candidate was installed
through `codex plugin add`; lifecycle fixture verification from `--fix` could
not start because another checkout owned the package-test lock. No five-surface
verification success is claimed for that regeneration attempt.

## Subsequent executable checks

Preserving the validated external pnpm launcher name corrected mise dispatch.
The next real run installed and built successfully, then exposed the runner's
incorrect preload filename. Soulless's committed configuration and main process
both name `out/preload/index.cjs`; the runner and portable fixture now match.
The following live attempt passed its original and reached the mutant's declared
assertion location, but refused the assertion-message format. No observation was
issued. A standalone Playwright 1.62.1 equality matcher confirmed its object-diff
headers omit scalar-label colons, and a separate synthetic contract probe failed
in the current evaluator. This is formatter research, not an Electron proof.

The queued runner protection finally executed: 10 tests passed, including the
exact compatibility links, external multi-call launcher, correct preload layout,
independent installs/builds, untracked exclusion and failure cleanup. Its log's
earlier RED-oriented filename does not change that actual GREEN-only outcome.

Independent report/request review `ce3d5e88-18bf-4d0b-9c1b-695b943ef037`
(Claude Opus, cross-agent) requested changes for missing one-variable mutation
refusals and missing original-pass refusals. Those characterization matrices are
written; their execution and the object-diff regression remain pending. Warnings
about scenario/title binding and nested file selection also remain to resolve.

The expanded contract suite subsequently ran: 71 cases passed and the new
object-diff case failed for the intended unsupported format. After supporting
both scalar labels and equality-diff headers, all 72 contract cases passed.
Combined focused protection passed 105 tests; the final report-helper cleanup
was protected by 92 report/runner/legacy/CLI tests. Types and all five generated
surface checks passed. The next live run still refused message evidence after
reaching the declared assertion, so current Electron observation remains RED;
additional diagnostics must identify the remaining mismatch before any credit.

## Remaining delivery

Review ee5add6c-a2dc-4c91-967b-7cf8644eec0c approved the canonical public row
identity and enrolled review instructions, while noting a final-publication
recovery gap. A new real-filesystem test reproduced it: after row-tag publication
failed, the same proof ID could later succeed. Publication now happens inside
the pending replay owner's callback; the tag is unusable until the journal
passes, and any publication error records failure before returning. This is a
deliberate safe ordering correction to reconcile in the final implementation
plan: durable tag first under the lock, then the journal's authorizing transition.
All 31 authorization, journal, and delivery-driver tests passed afterward.

The read-only delivery script had a genuine missing-module RED, then passed its
installed-transport fixture and refusal cases. It checks the exact 17 rows and
closing through the supported external Codex cache; it never attests or edits a
ledger. Those fixtures are transport checks, not authentic delivery receipts.
Current merged Soulless c446674a now has all five CI checks green in run
45328380450. Its real all-17 proof delivery is still outstanding.

Independent review 887c4db8-c0c9-418e-b832-f002fc67ef2f approved the previous
complete replay packet with nonblocking robustness notes. A subsequent stronger
positive public row test exposed a field-order defect the packet missed: the
CLI builds ticket/scenario/ledger while closing builds ticket/ledger/scenario.
Signing raw object JSON gave them different row filenames and content. The real
public test failed with a missing row tag; canonical explicit identity fields
then passed all 23 authorization/legacy-row tests. A fresh review is required
for that changed gate. The review instruction tests also genuinely failed for
the former CKWE2D-only text, then passed with both source-defined profiles:
72 runtime/contract tests passed, with 2 existing skips.

Soulless merged the new origin/main commit 69a30570 without conflicts as
c446674a and pushed that current head. CI run 45328380450 is in progress.
The incoming desktop test change is a bound executable input, so the first
historical observation is retained but must be freshly observed before delivery.

The positive public closing check and same-HEAD failed-replay invalidation both
passed: 3 closing tests in 227.59 seconds. The old aggregate bytes remained
unchanged while its failed journal made them non-authorizing; a same-proof retry
executed no additional tests. The subsequent 9-file regression run passed 155
tests, including actual owned-port EADDRINUSE refusal and signed foreign-policy,
foreign-scenario, unsupported-schema and interrupted-journal refusals. No tests
were run concurrently. These are fixture/contract results; real Soulless still
has only its first non-authorizing observation and no VERIFIED rows.

The all-17 synthetic closing journey initially exhausted its 120-second test
budget after all 34 replay executions. Closing redundantly prepared each row
again solely to read its already-bound row tag and journal. Reuse is now limited
to one check invocation: closing prepares each row once, reads its current
authenticated tag/journal, and rechecks all captured input hashes before success.
It never reuses execution across HEADs. The unchanged 120-second case then
passed; combined closing/ledger protection passed 6 tests in 106.59 seconds.
These controlled external-process results establish wiring, not the actual
17-scenario Electron delivery. A positive public closing-gate test and an
old-aggregate-after-failed-replay test are running separately.

A new global-error diagnostic probe failed because an occupied renderer port
was reported only as an absent selected test. The validator now refuses global
setup errors before selection and retains their bounded actual reason. The
standalone probe passed after that change; formal contract and actual socket
collision protection remain to run. Neither diagnostic is an Electron kill.

Row admission protection passed 57 tests, including authenticated synthetic
external-review jobs, metadata HEAD replay and same-HEAD failure/renewal. Review
905e1baf-6acd-4dd6-966a-3c2415bdfa08 then found a newline bug in the new ledger
parser and missing recorded-credit coverage. A real-parser regression failed at
that exact refusal before trimming only heading input; it now passes. The public
close test independently failed because the legacy close handler returned CKWE2D
identity for SGWMBS. The new per-policy close entry point passes its missing-row
refusal. Complete all-17 aggregate execution and tamper coverage remain pending;
these first checks do not establish working closure.

The installed hook permits only one VERIFIED transition per tool call. Delivery
must respect that existing limit rather than silently bypass it. Per-row guarded
edits and commits, each following current-HEAD attestation, can preserve the same
original histories and exact all-17 closing requirement. Reconcile the execution
plan's atomic batch-edit wording before delivery; no broader policy change is
needed to preserve the intended outcome.

The standalone journal implementation passed real-filesystem tests for pending,
passed, failed, concurrent, SIGKILL-interrupted, and failed-publication outcomes.
Independent review bec573f6-30c9-4253-bc8b-c0d77fe8e950 identified missing
cross-HEAD and changed-input retry protection tests. Those additional tests
passed in the 50-test protection run; independent rereview
343db72b-1595-4b7e-84f2-df862ecf5c34 approved the journal with nonblocking
tampered-record coverage suggestions. The journal is not yet complete delivery.

The new public row test first had a fixture expectation error: action-required
responses correctly use the existing envelope's ok=true. After correcting that
new test, it failed for the intended CKWE2D-only refusal. The new SGWMBS handler
then passed that contract. A real-collaborator positive test now passes using
actual authenticated review jobs, committed Git archives, and controlled external
review/Electron processes. Its first two attempts failed in fixture setup because
the synthetic reviewer omitted its required dispatch ID; those are not product
RED or real independent reviews. No synthetic fixture receipt touches Soulless.

The installed public probe subsequently passed: independently installed/built
original passed and the declared package-metadata mutation failed at line 39.
Log: `/tmp/issue163-safeword-public-real-host-colors-candidate.log`. A separate
successful public run retained its complete actual observation in Soulless commit
24e75e69, with truthful producing HEAD 5839fe857a14a3172ff8714196c703233214d5ec.
Neither run authorizes a row. The 76 report/request cases passed after the queued
runner acquired its lock; its RED-oriented filename is not a RED result.
Scenario/title and flat-suite path guards each had a separate failing standalone
contract probe before implementation. No Vitest RED is claimed for those guards.
Independent cross-agent Claude Opus review b5ecd51b-66fb-4418-bcbf-fc1ef55a8c83
approved the current report/request checks with nonblocking message-format
limitations. Semantic mutation review remains mandatory. Current journal work is
unfinished and has not authorized any SGWMBS row or closing proof.

### Root cause: colored matcher evidence

The resumed installed public run reached the declared mutant assertion but
refused its message. The actual JSON contains ANSI color sequences between
`expect(...)` and the matcher name and around equality-diff headers. Replaying
that captured message through the source evaluator failed for the same reason.
Wrong assertion location is ruled out by the structured location check passing;
missing expected value and missing repository path are ruled out by their
presence in the actual message. Normalize terminal formatting before the same
semantic checks. This is a report-parser correction, not a weaker proof rule.
The interrupted Vitest wrapper produced no result; the resumed wrapper is queued
behind another checkout's lock. Standalone captured-message rejection is real
diagnostic RED, not claimed as a Vitest result or successful Electron observation.

- [ ] Implement and protect independent Electron snapshot execution.
- [ ] Expose and prove the installed public observation command.
- [ ] Add authenticated row failure records and exact-set closing replay.
- [ ] Run all 17 actual original/mutant proofs and independent reviews.
- [ ] Complete verification, audit, refactor, and PR readiness.

Original Soulless historical entries remain unchanged. Portable fixture reports
are process-wiring protection and never substitute for real Electron evidence.

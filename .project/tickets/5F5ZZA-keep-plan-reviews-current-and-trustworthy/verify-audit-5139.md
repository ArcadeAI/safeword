# Remote verification and scoped audit follow-up

This follow-up implements the user's request to run verify, preferably remotely,
then audit and improve the tests. It does not replace historical `verify.md`,
erase failed runs, close the ticket, or earn Execution qualification.

## Remote verification

Full CI at `4708329f94a5259bce5aeead02499599848f6173`:
[run 39690796089](https://github.com/ArcadeAI/safeword/actions/runs/39690796089).
Both Ubuntu Node 22.23.2 and 24.18.1 jobs failed with the same CLI result:
713 files passed, 10 failed; 11,607 tests passed, 73 failed, 10 skipped.
Node 22 took 1,124.26 seconds; Node 24 took 985.25 seconds. Relay passed
198 with one skip on Node 22 and 199 on Node 24; collector passed all 153.
Both jobs skipped their later physical-install and release checks, and Node 24
skipped acceptance after the failure. A skipped downstream step is not a pass.

Remote lint, CLI contract, dependency audit, dogfood parity, OpenCode conformance,
and deployment-input checks passed. The restricted remote dependency policy
does not supersede the unrestricted local dependency scan below.

The verify skill invocation and ticket resolver succeeded. Lint began with no
uncommitted source to fix. Per the user's remote preference, existing exact-head
CI supplied the authoritative full tests instead of duplicating them locally.
The skill's single local aggregate block was **not** executed this time; the
resolver-generated BDD, build, typecheck and dependency plans were run separately
to cover lanes not guaranteed by CI. No aggregate verify pass is claimed.

## Audit and improvements

The installed audit's complete code-quality, learning, principle-trace and
domain-doc blocks ran unchanged. Scope is the merge-base diff from `origin/main`,
at `a3c216940fc12a912f97a3f77820e280e1203b65`, including working changes;
generated carriers and historical evidence are
classified separately from authored code. Dependency-cruiser found no violations
across 551 modules and 988 dependencies. No changed agent configuration,
learning-format, objective principle-reference, or domain-reference finding was
reported. Whole-repository Knip, clone totals and dependency freshness were
explicitly outside this diff audit.

Configured documentation coverage: `README.md` and affected planning claims in
`packages/website/src/content/docs`; architecture references checked against the
generated module map and existing review ownership. No dependencies or module
boundaries change in this follow-up. No documentation inventory was invented.

Test-quality review sampled the evidence boundary, retained replay, checkpoint,
installed-copy currency, Execution defaults, ranked-route steps, coding
authorization, delivery fixture and Execution journey. Two actionable findings:

- The evidence schema assertion checked only existence, and malformed-record
  coverage sampled two fields. Replace it with the complete transport contract,
  all eleven fields' missing/blank/wrong-type partitions, and undeclared fields.
- Shell-based fake reviewer outputs in coding authorization, delivery and
  Execution journey omit the new required wrapper. Remote logs establish
  `scenario-gate`/`invalid_output` before intended assertions. Add explicit empty
  typed collections to those fakes and a subprocess-to-real-parser control.
  Empty records mean no external evidence declared; they prove neither semantic
  review nor real model qualification. Existing downstream admission failures
  must remain visible.

Scope/persona prompt assertions remain structural delivery evidence. They do
not establish that a real reviewer correctly judges omissions, overreach or
persona outcomes. Bounded lexical rationale checks retain their disclosed
limits. Replay-only recovery remains excluded under #5857.

## Status and limits

**Tests:** Remote full suite failed as recorded above; initial focused
evidence-boundary suite passed 40/40 after one intended fixture failure with 39
passing controls. Final test-first commit `e6fd2aa1e` matches the expanded RED:
three planning-parser failures and 41 passing controls (44 total), observed
before the fixture repair. The two non-planning controls pass without a wrapper.
Repair commit `8655d5a84` passes the expanded evidence-boundary file (44 cases)
within a five-file regression: 86 passed, 16 failed, 102 total, exit 1, 42.89
seconds. The other passing files are the Delivery Checklist boundary and
Execution prerequisite suites. Fourteen coding-authorization tests and two
Execution journey tests remain blocked at `REVIEW_ROUTES_EXHAUSTED`, with zero
eligible Execution routes. They no longer fail at Scenario `invalid_output`.
This is not a new full-suite pass or a claim that 73 full-suite failures became
16. The archived cache-scope summary supports the per-file outcomes, while the
runner log remains the authoritative aggregate. A redundant focused repeat was
cancelled with exit 143 while waiting for another worktree's lock, before Vitest
started; it supplies no additional GREEN, and no foreign process was signaled.
Disabling the evidence validator deliberately produced 36 failures and four
passes; original source was restored byte-for-byte before the final passing run.
This mutation is not historical RED and introduces no production change.
**Gherkin:** Clean repeat passed all 601 scenarios and all 11,825 steps in
6 minutes 37.206 seconds. Its subsequent proof-tag test passed all 51 tests after
waiting for the shared test lock. The complete generated BDD plan exited zero.
First full run: 599/601 passing, 11,821 passing steps, two failures
and two skips; exit 1. Its empty-output failures occurred in install alias and
plain-summary scenarios. This run overlapped the temporary mutation/rebuild and
is retained as mixed-revision evidence, not attributed to a product defect.
Proof-tag checks were skipped when the first acceptance command failed.
**Build:** Passed the full generated plan, including website and Go experiment.
**Lint:** Remote full lint passed; changed-test lint is checked separately.
Final changed-file ESLint and package typecheck pass.
**Typecheck:** Passed all generated lanes, including website and locked mypy.
**Scenarios:** 0/54 historical scenarios complete; 162 RED/GREEN/REFACTOR cells
remain unchecked. Their list remains in the unchanged historical definitions.
**Refactor:** No production structural change warranted by this follow-up.
**PR Scope:** Test compatibility, boundary proof and truthful evidence only.
**Dep Drift:** No dependency changes; unrestricted scan failed with seven
JavaScript advisories (two high, two moderate, three low) and two Python advisory
identifiers for one `certifi` vulnerability. Experiment pip-audit passed; Go
reported zero affected called symbols. These findings are not erased by CI's
restricted successful audit and are deferred to dependency maintenance.
**Parent Epic:** 82T411 / #4200 remains in progress; this child is not closed.
All eleven listed children remain in progress (0/11 done).
**Reconcile:** Existing production ownership and fallback contracts preserved.
**Experience:** Walked the maintainer flow through schema refusal and retained
verification evidence; worst step is unavailable current Execution admission.
New persona steps introduced by this test-only follow-up: zero. The inherited
parent demo is explicitly skipped by this child's accepted spec; no payoff proof
is gained from these tests.
**Surface Evidence:** Real CLI/process fixtures and remote Linux Node tests;
no fresh native Claude/Cursor/Codex/OpenCode live-host acceptance is claimed.
**Evidence limits:** Remote full results predate this test-only follow-up;
qualification, historical ledger and supported-host acceptance remain open.

An early independent test review (`ad06abd9-6b61-45c4-a1ef-f065534863a8`)
became stale when the fixture repair changed its context. It supplies no current
approval; the final complete patch is reviewed separately. Initial changed-test
lint rejected dynamic deletion; the test now constructs the omitted-field input
without dynamic deletion and lint passes. A read-only ledger-count command was
blocked by the shell ledger guard; direct `rg` reads supplied the counts without
altering the ledger. An attempted stop of the first BDD process found it already
exited; no other process was signaled.

Claude review `a0c8616b-ab1c-4031-94ca-7f654eecfdd5` independently approved the
complete initial test/fixture patch with warnings. Two fixes follow it:
the non-planning `delivery-compatibility` response retains its original schema,
and required-field arrays are compared by exact membership/cardinality rather
than incidental field order. The old redundant missing-field assertion is
consolidated into the table; the separate empty-string license case remains
distinct from whitespace-only fields. The repaired patch is reviewed separately.
Its remaining warnings are bounded as follows:

- The subprocess control proves the shared fixture's scenario branch only;
  other branches retain their journey tests, whose qualification limitations are
  disclosed. No twelve-branch parse-level coverage is claimed.
- Populated evidence is tested at dispatch and parser boundaries, not through
  a complete installed-CLI-to-persisted-receipt journey. That retention path is
  unproven by this test packet; empty arrays do not substitute for it.
- Consolidating the three fixtures could prevent future drift, but their
  different denial behaviors make that a separate refactor. This surgical
  compatibility repair preserves existing decision and assertion behavior.

Follow-up review `06e3dfef-9aae-412d-ae4d-f5a4d19e8726` requested changes because
the supplied packet omitted the shared fixture's prologue and cleanup helper.
The next packet supplies both complete collaborator sources. Its assertion that
the diff was truncated is not supported: `git apply --numstat` parses all four
files successfully; the last hunk ends at ordinary unchanged context. Preserve
the review refusal rather than translating it into approval. Its additional
non-planning-schema concern is addressed with a kind-qualified shared-fixture
response and paired scenario/quality/delivery-compatibility parser controls.
Empty string and whitespace remain explicit input partitions. Broader fixture
consolidation and installed-CLI populated-record retention remain deferred.

Complete-context Claude review `27a971dc-0a5a-4c8a-abd7-ca1f6582a6e6` approved
the candidate, explicitly recognizing its central parser behavior and bounded
coverage. It reviewed a proposal with the exact helper supplied in context while
the worktree helper stayed original for the queued RED check. After review, the
requested Implementation/Product controls were added and the inert
`plan-execution` alternative was removed (a valid Execution response still needs
the existing earlier record branch). These small prescribed test refinements
are self-checked, not claimed as a separate exact-byte independent approval.
The applied helper must match the reviewed candidate with only that named
alternative removed. A proposal review alone is not GREEN evidence.
The final applied helper passes that byte comparison. All 277 parity pairs and
11 contracts match, and all five generated surfaces are current. Project-only
reconciliation changed exactly the four previewed dogfood files and declared
no package, configuration, network or destructive effect. The shared runtime
remains `c535706afa985ac3e76fa83b0d033baf9d42ed17eb08a245de1085d9cdc5e6a1`.

The review again questioned hunk arithmetic, but `git apply --numstat` accepts
the complete patch and the full test source is supplied. Its local-factory
warning is bounded by actual callers: coding authorization's kind parameter is
the three planning kinds, and the journey calls Scenario, Implementation and
Execution review only. Those private fixtures do not claim ordinary-quality
schema fidelity. Broadening or consolidating them remains separate work.

Final cross-agent Claude review `7507dbe7-b366-4349-b1e0-e66ec48fd9a8` approves
the actual committed four-file delta through `8655d5a84`, with complete fixture,
cleanup and runtime sources supplied. No further code changed after this review.
The reviewed patch is byte-identical to the final committed code diff; the
patch digest and verdict are archived. Warnings are answered as follows:

- The pre-existing HMAC-signed test admission helper isolates downstream
  checklist tests from unavailable Execution qualification. It is test scaffolding,
  not a real provider approval. Keep it rather than changing admission policy or
  declaring the route qualified. The two delivery suites passed, but this does
  not prove they used a real coordinator approval: current Execution routes
  remain empty, as the 16 independent coding/journey failures demonstrate.
- Direct parser coverage does not include the shared fixture's Execution record
  and denial branches. The new fields there are compatibility repairs, and no
  new discriminating qualification or installed-route proof is claimed for them.
  Broader fixture redesign remains deferred.
- The warning about reviewed literal text selecting a planning branch is not
  reproduced by a valid serialized packet: JSON escaping prevents both proposed
  literal examples from matching the exact regex. The archived two-case probe
  exercises that regex against serialized quality-review packets. This is a
  bounded fixture check, not a production security claim.
- The shared fixture's non-Execution rejection branch was already unsupported;
  current rejection consumers use Execution or the separate delivery-compatibility
  branch. This follow-up does not claim Scenario/Implementation denial coverage
  or silently repair unrelated pre-existing fixture behavior.

Final archive: all 261 artifacts verify against their uncompressed byte counts
and SHA-256 values; the original 212 manifest entries are unchanged. The 49 new
artifacts have zero matches in the credential-pattern scan. The final reviewed
patch SHA-256 is `1ccec437e5d486935f69423f727296a8dae5214c1dcc9ebbf232a1609ac66440`.
Only evidence prose and archive entries changed after the committed-code review.

Historical missing RED, GREEN/REFACTOR SHA collision, six failures, 585 unfinished
checks, 33 deferred/unverified cases, and the unchanged 38/63 Codex collection
remain. No unchanged paid qualification was repeated. Draft PR #6031 remains
unmerged and unpromoted.

# Refactor follow-up for #5086

Scope: test-quality changes above delivery checkpoint `961ca103`; protect current
behavior at `5d3d11a96`. No policy, qualification, host-continuation, dependency,
or native-host scope changes. Mutation is serial; each extraction gets its own
verification and commit.

## Prioritized leaf-first ledger

1. Resolved — decompose the nested concept-group predicate in
   `packages/cli/src/review/capability-eval.ts`. Keep the same one-finding rule,
   empty-group handling, severity guard, normalization and word-prefix matching.
   Protect with the existing capability evaluation/corpus/catalogue tests.
2. Resolved — extract fake reviewer executable setup from
   `packages/cli/tests/fixtures/ranked-planning-review.ts` into a private helper.
   Preserve executable bytes, log lifecycle and CLI environment. Protect with
   the four executable ranked-route BDD examples.
3. Resolved — extract project setup into a private helper in the ranked fixture,
   preserving route order and all authored planning bytes. Depends on step 2;
   protect with the same four BDD examples.
4. Deferred — generalize reviewer scripts across integration fixtures. Those
   fixtures simulate different transports/failure modes; a shared framework
   would widen this surgical cleanup without a demonstrated shared contract.
5. Deferred — extract the local rescore observation projection. It has one
   caller and a compact purpose; moving it adds indirection without simplifying
   the integrity guards. Preserve sealed bytes and observation lineage.
6. Deferred — split older multi-flow continuation integration tests. This pass
   targets the new test-quality delta; existing stronger assertions stay intact.

7. Deferred — generic IPC race helper: only one consumer; keep the readiness
   barrier and consumption assertions visible.
8. Resolved by inspection — no BDD assertion abstraction needed; route order,
   assurance and packet checks cover distinct contracts.
9. Deferred — parsed-JSON compile-time types: separate hardening rather than
   necessary extraction; retain current runtime assertions.


Scout coverage: mechanical inspection of changed scoring/fixture code, plus an
independent read-only reuse/abstraction scout. No whole-repository cleanup claim.
Native-host manual deferrals, historical failures, and dependency audit blockers
remain as recorded in `test-quality-5086.md` and Draft PR #5995.

## Step evidence

- Step 1: 22 capability evaluation/corpus/catalogue tests passed. Scoped ESLint
  passed. An additional before/after comparison of 1,620 boundary combinations
  agreed (undefined/empty groups, empty alternatives, punctuation, Unicode,
  prefix matching, split findings, severities and verdicts). This is an
  equivalence check, not new semantic qualification. Regression inspection
  found no dropped guard, changed default, side effect or lifecycle change.

- Step 2: four real-CLI BDD scenarios / 24 steps passed; scoped ESLint and CLI
  typecheck passed. Moved setup body compared byte-identical with its parent.
  Log initialization and permissions stay inside setup; caller retains cleanup,
  timeouts, environment and packet decoding. A first launch used a package-relative
  runner path from the root and exited 127 before any tests; corrected the
  working directory and obtained the terminal green result above.

- Step 3: four real-CLI BDD scenarios / 24 steps passed; scoped ESLint passed.
  Project setup body compared byte-identical with its parent, including route
  arrays, planning inventory calls and authored source fixtures. Caller still
  owns the same project/bin lifecycle; no defaults or guards moved across it.

## Independent review and audit

Independent headless Claude review `08e022fb-4f1d-46a2-8a72-2c04c522d630`
approved the exact two source files at source checkpoint `6bb984f96`. The raw
response and exact context are archived alongside the verification evidence.
The reviewer confirmed guard order, normalization, setup order and unchanged
written strings. It noted two non-blocking limits:

- The private scoring helper relies on its sole caller to lowercase/collapse
  whitespace. Kept that boundary to preserve the existing normalization; no
  additional caller or public helper API is introduced. This is visible in
  the caller's normalized-findings mapping.
- Word-prefix matching intentionally permits plurals and longer suffixes;
  retained as part of the bounded lexical oracle, not semantic qualification.

Final diff audit uses `SAFEWORD_AUDIT_BASE_REF=5d3d11a96`, covering this stacked
refactor only. The first audit caught the temporary local Cucumber config as
an orphan; it was removed and the final architecture pass reports no violations
(7 modules / 7 dependencies). No changed agent configs, learnings, manifests or
customer documentation contracts. Configured README and website docs have no
impacted claims: no public behavior/API changed. Namespace/principle checks
produced no findings. Whole-repository Knip, duplication and dependency freshness
are explicitly skipped by the diff audit; no clone-count improvement is claimed.
No new dependency or platform API was introduced; the inherited dependency audit
blockers remain outside this refactor.

## Final verification (source checkpoint `6bb984f96`)

- Scoped capability suite: 3 files / 22 tests passed.
- Ranked-route protection after each fixture extraction: 4 scenarios /24 steps
  passed each time. Broader scoped lane: 123 scenarios /2,488 steps and two
  hooks passed, retaining standard manual/live/proof exclusions.
- Repository lint, all three package typechecks, parity (277 pairs /11 contracts),
  all five generated surfaces and the complete CLI contract check passed.
- Offline capability verification retained Claude-to-Codex `not_weaker` and
  Codex-to-Claude `weaker`. No observations, seals or labels changed and no paid
  qualification calls were made.
- Full root suite passed: 717 CLI files /11,585 tests passed, 14 skipped;
  CLI duration 1,245.20 seconds. Relay: 198 passed /one skipped; collector:
  153 passed. Exit 0. This is a fresh result, not inherited baseline counts.
- Release suite passed: 14 files /83 tests, exit 0, 26.97 seconds. Existing
  Vite future-native-config warning remains visible in the archived log; no
  configuration change or suppression was added.

The broader Cucumber invocation initially rejected an absolute config path
(`packages/cli/tmp/...` resolution, before tests). Passing its computed relative
path loaded the same config and obtained the terminal 123-scenario result. Both
outputs are archived. These two command-launch failures are not test RED or
failed behavior-preserving refactors. No refactor required reverting.

Audit summary: no new errors or warnings after temporary-config removal.
Configured documentation coverage is README and website docs, limited to claims
affected by this two-file extraction. No repository-wide dead-code/clone or
dependency-freshness claim. Native-host R7 and dependency remediation stay open.

All selected ledger entries are resolved; all remaining entries have explicit
deferral reasons. Fresh top-to-bottom self-review found only the two intended
source-file extractions and this evidence. Review targets remain byte-identical
to the approved source checkpoint; the evidence commit does not change code.
Archive SHA-256 checks passed for every decompressed log.

**Next:** Push the reviewed refactor and evidence to Draft #5995, retain the
existing dependency/native-host readiness blockers, and collect new-head CI
without merging or promoting.

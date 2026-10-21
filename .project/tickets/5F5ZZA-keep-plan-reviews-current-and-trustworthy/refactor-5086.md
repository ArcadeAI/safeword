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

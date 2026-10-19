# Test quality and scoped audit

The bug is best exercised through integration tests: actual Git repositories,
public packet capture, signed job status and the receipt gate. No new BDD feature
is claimed for this investigated bug fix. The task's Test Definitions specify the
behavior; the existing acceptance lane remains a final regression check.

The first packet regressions produced 16 failures at the old whole-file cap.
Signed-receipt regressions then exposed two real identity defects: a changed
baseline with identical patch bytes, and substituting patch text as a small source
file. Both wrongly retained approval before the fingerprint fix. The resulting
three-file focused run passed 156 tests. A protected refactor extracted duplicate
Git-prefix validation; its packet, projection and nine parser cases passed 81/81.
These observations establish discrimination beyond a passing implementation.

The 29 projection cases include staged, unstaged and committed changes; remote
baseline precedence; nested roots; credential scans outside hunks and in removed
baseline text; source, patch, mode and baseline drift; generated exclusions;
individual and aggregate budgets; invalid text; and unusable baselines.
An independently authored source is the expected-content oracle. Applying the
exact displayed patch must reproduce it. A Unix-only transport fault injector
runs actual Git then removes a later hunk: a valid partial patch must still fail
production reconstruction. It does not simulate Git's diff/apply algorithm.

The signed-receipt integration test uses the real source CLI and receipt reader,
with only the external reviewer simulated. It proves original bun.lock coverage
and no exclusion, rather than trusting a successful packet alone. The separate
live probe uses the real external reviewer and actual released lockfile bytes.
The legacy fingerprint golden case guards compatibility with existing receipts.

Every case owns its temporary repository and cleanup. No test depends on another
case, network, elapsed-time sleeps or a mock call-count assertion. Prefix cases
are pure parser tests; the higher-level nested-path case proves their composition.
Executable-mode and injected-PATH cases are skipped on Windows where their host
assumptions do not hold. Existing cross-host CI remains required; these local
macOS tests do not prove all host behavior.

The installed audit's complete code-quality block ran against the origin/main
merge-base scope, including untracked modules: no dependency violations across
136 modules and 276 edges. Its learning, principle-trace and domain blocks also
completed successfully. There are no changed agent configurations, learning
files or feature/persona inventories to reconcile. Repository-wide Knip, clone
and dependency-freshness discovery were explicitly skipped by diff-audit policy.
Root ESLint, Gherkin lint and CLI TypeScript checking passed.

Refactor ledger: duplicate prefix validation was the only justified change;
extract the pure parser while keeping command execution and typed failures local.
No generalized process wrapper was added because blob capture, patch output and
metadata calls have different failure and transport contracts.

# Test quality and scoped audit

The bug is best exercised through integration tests: actual Git repositories,
public packet capture, signed job status and the receipt gate. A public-CLI
Cucumber regression now also exercises the actual worker, vendor dispatch, signed
completion and status revalidation, replacing only the external reviewer executable.
The task's Test Definitions remain the behavior specification.

The first packet regressions produced 16 failures at the old whole-file cap.
Signed-receipt regressions then exposed two real identity defects: a changed
baseline with identical patch bytes, and substituting patch text as a small source
file. Both wrongly retained approval before the fingerprint fix. The resulting
three-file focused run passed 156 tests. A protected refactor extracted duplicate
Git-prefix validation; its packet, projection and nine parser cases passed 81/81.
These observations establish discrimination beyond a passing implementation.

The original projection cases include staged, unstaged and committed changes; remote
baseline precedence; nested roots; credential scans outside hunks and in removed
baseline text; source, patch, mode and baseline drift; generated exclusions;
individual and aggregate budgets; invalid text; and unusable baselines.
An independently authored source is the expected-content oracle. Applying the
exact displayed patch must reproduce it. A Unix-only transport fault injector
runs actual Git then removes a later hunk: a valid partial patch must still fail
production reconstruction. It does not simulate Git's diff/apply algorithm.

The original signed-receipt integration test uses the real source CLI and receipt
reader, but substitutes COMPLETE_WORKER: a simulated completion worker that writes
and signs an approval record itself. It proves reader/gate composition and original
bun.lock coverage with no exclusion; it does not prove coordinator dispatch or
production completion/signing. The new public-CLI Cucumber regression closes that
separate gap: the actual hook receipt reader revalidates the real worker's signed
record through a distribution-owned route outside the reviewed fixture, then the
implementation gate accepts its original-file coverage. The separate
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

Final local evidence is mixed and must not be called an all-green local suite.
The first broad CLI run completed with 11,250 passed, 24 failed and 40 skipped
across 683 files (666 passed, 17 failed). Install/setup hooks also timed out or
skipped after setup failure. The generated verification plan then began a
redundant second CLI run; that continuation was stopped (exit 143), preserving
the first run's failure log. Remaining closing lanes are collected separately.

A current focused run passed 217/218 cases across the four packet/job/parser
files and review surface parity. All 37 large-lockfile cases passed, including
the seven hostile/path cases and near-limit case added after the first GREEN.
The sole failure was the pre-existing job test expecting exactly two inspection
calls within a 450 ms courtesy wait. Isolated routing tests produced five
failures and three passes. Running those eight cases plus the inspection case
on the clean release checkout (873d5d480b78af727c1838f28a286132cc9485e1,
tree 99db67fbcc0167c1199b765df7e66b433f123bf2, identical to the main merge-base)
reproduced all five routing failures and the inspection failure: six failed,
three passed. No timing expectation was relaxed. This proves those specific
failures predate the change; it does not independently diagnose every other
broad-run failure.

A separate host probe measured first launch of a new shell stub at 870 ms,
then 6 ms on its next launch and 6 ms through an explicit shell. That is evidence
of cold executable latency on this host; its OS-level cause was not established.
The six reproduced failures depend on short fake-executable deadlines. Hosted
CI on the earlier code head passed the full package, acceptance and release
lanes on its declared platform; final-head CI is tracked in PR #5947.

The inspection test's two symptoms differ: the change recorded one inspection
instead of two; the baseline created no ps.log at all (ENOENT). The reproduction
therefore establishes a pre-existing failure of the same test, not a shared root
cause. The other eighteen broad-run failures remain undiagnosed locally. The
cold-launch probe is evidence of host latency, not a diagnosis of those failures.


## Follow-up test improvements

An earlier follow-up focused run passed 175/175 across lockfile-packet, job, the new
inspection-budget tests and BDD proof contracts. The new active Cucumber scenario
passes through the public CLI: one scenario / 22 reported steps, including hooks.
It checks the vendor-received original target, diff representation, source size,
version patch, empty exclusions, authenticated receipt-reader coverage accepted by the
implementation gate, and an edit returning stale with action-required exit 2.
The older generated-input feature remains WIP; its overly absolute rule now
acknowledges the complete bounded lockfile exception.

Packet coverage is now 40 cases: exact 8 MiB source and baseline acceptance,
existing over-limit rejection, successful cat-file output truncated to 16 KiB,
and a serialized escaped representation of exactly 262,144 bytes followed by
one-byte-over rejection. The last case keeps raw patch content below the cap,
so JSON escaping and metadata overhead are independently protected.

The old 450 ms test requiring exactly two ps calls is replaced by two deterministic
courtesy-clock cases (0 and 450 ms). They simulate OS inspection unavailability,
check that process inspection receives a positive timeout no larger than 1000 ms,
and exercise pending status, cancellation and durable canceled status. Worker
launch, Git, storage and signing stay real; cleanup owns and terminates each
fixture worker even after failed assertions. These are process-budget and state
contract tests, not a claim to diagnose the host's historical cold-launch issue.

Discrimination checks temporarily remove the baseline-byte-count guard, remove
the representation-size guard, or change the source boundary to reject equality.
Each makes its targeted new regression fail. Three further mutations also fail:
rejecting exact 8 MiB baseline equality, raising the OS inspection timeout to
2000 ms, and disabling projection through the public CLI. Original production
bytes are restored after every mutation; no production behavior changes in this
follow-up. New-head CI remains a delivery gate. The prior local broad-run failures
above remain historical evidence, not erased by this narrower green run.


Independent review f7b5f437-f2ac-4cac-839d-bf8b2cda8928 approved the first test
revision with warnings. Applied: use the actual receipt reader with the real
worker's record, bind the process-inspection mock to an explicit fixture path,
and document that baseline truncation injection requires file-backed stdout.
The exact-record calibration intentionally relies on stable metadata widths;
exact-size equality fails loudly if those widths ever move. Cleanup debt in
older unrelated job tests predates this follow-up and is not broadened here.

Research checked the installed Vitest 5.0.3 contract against its official
[vi API](https://vitest.dev/api/vi.html#vi-waitfor): waitFor advances fake timers
by its polling interval. This makes courtesy-clock progress independent of host
executable latency. No dependency or framework version change was needed.


After the receipt-reader improvement, a repeated focused run produced 174 passed
and one failed: the unchanged job test "emits only managed lifecycle lines
without disclosing reviewer bytes" returned action-required exit 2 instead of
approval exit 0 within its 3000 ms foreground window. Isolated rerun reproduced
it. The same isolated test also fails with the same exit-code symptom on the
clean 873d5d480b78af727c1838f28a286132cc9485e1 release tree (identical to this
branch's main merge-base). This establishes that this particular failure also
predates the follow-up; it does not establish its root cause or repair the other
historical local failures. The new tests pass; final-head hosted CI is required.

Review 692ad28b-a633-4959-b602-a6d4fa6a9741 approved the actual receipt-reader
revision with two warnings, both applied: the coverage table now cites Cucumber
for real-worker evidence, and cleanup records only the explicit fixture worker
spawn when detached, leaving unrelated helpers outside its signal scope.

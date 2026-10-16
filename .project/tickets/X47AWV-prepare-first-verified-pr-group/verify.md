# X47AWV formal delivery verification

2026-10-15. Material head: d76e05472bc73af72b27d3be2ad3801a6baa4fa9.
This records local results before the evidence-only commit and push. Exact pushed
head and terminal CI disposition belong to Draft PR #5881's readiness block.
That historical run claimed no ticket activation, completion, Ready promotion,
merge or release.

## Current closure reconciliation (2026-10-16)

Latest local result: independent archive review 3b1921ac-23f9-4832-988f-5f5cb93124a6
and corrected-record review 54b1ba93-23c5-4f43-b525-0e54985debe3 approved with no
errors. The verified Claude Opus cross-agent phase stamp permitted normal local
closure. The unchanged guard then passed the complete candidate file list.
Actual GitHub file-list validation and final-head CI remain pending before Ready.
The reopening history below is retained, not the latest task status.

Current disposition: Ready succeeded at 34be76d32 after CI 38910762211 passed,
then Ready-triggered CI 38914065503 failed the Ready-only child-closure check
before ordinary lint. The PR is back in Draft and X47AWV is reopened. The prior
normal receipt and passing code checks remain historical proof, not a current
Ready claim. Independent proposal review b05403de-2eee-4b9c-b874-910c95f3fa4a
approved separating inherited incomplete attempts from completion evidence.
Its conditions and tooling boundaries are recorded in ready-closure-disposition.md.

The three reports are preserved byte-for-byte as readable text under
evidence/historical-verification/, with original paths, source commit, SHA-256,
base-file absence and child state in MANIFEST.json. Child ticket work logs link
their archived failures and require new canonical verification before closure;
their phases, statuses and behavior ledgers are unchanged. This preserves failed
history without claiming any child complete. The Ready failure log is archived
there too. No production code, test, workflow or authorization policy changed.
Fresh independent review, actual changed-file guard validation and normal
X47AWV closure are required before another Ready attempt.

Archive validation: all three text copies exactly match their original Git blobs
and recorded SHA-256; child phases/statuses and all behavior ledgers are unchanged.
The unchanged Ready-closure guard's 13 regression tests pass. Running that guard
against the complete staged candidate file list now names only the deliberately
reopened X47AWV; the three inherited child violations are gone. The remaining
X47AWV refusal is expected until normal review and closure. Re-run the full-list
check after closing; retain its output rather than substituting a filtered list.

The user authorized Ready promotion; merge, release and deployment remain
unauthorized. The delivery branch now occupies this chat's b528 worktree.
Editing its actual ticket bound X47AWV through the normal hook. An independent
Claude Opus intake review (93c23e19-b782-4dfc-b305-2d18de5f7340) approved the
reconciled scope; its verified receipt permitted this task to advance to verify.
No historical feature phases, activation or test-first history were invented.
The subsequent record review (11ca2f36-806b-4b36-9478-f2ffc82f3a06) approved with
warnings answered by explicit supersession, the task-only phase contract and
the reproducible evidence below. It did not cover verify.md and was therefore
correctly refused as a verify-phase exit stamp. Covering reviews
c77a7f8c-86c3-47e4-a757-8557210b0dc1 and
0ccf85ce-9262-433d-84b8-110d49628be6 subsequently approved. The latter's verified
cross-agent Claude Opus receipt was recorded for verify. The final signed
coordinator receipt and normal phase-exit stamp remain the closure authority.

[CI run 38809738126](https://github.com/ArcadeAI/safeword/actions/runs/38809738126)
reports success at 53e0585adca6fe2ef1a22eb2c33424b2108d670e, including Node 22/24
and the existing dependency-audit policy. Reproduce with
`gh run view 38809738126 --json conclusion,headSha,url`.
`git diff --name-only d76e05472bc73af72b27d3be2ad3801a6baa4fa9 53e0585adca6fe2ef1a22eb2c33424b2108d670e`
lists only files beneath this ticket's directory: HANDOFF.md,
delivery-checks.md, verify.md and evidence/formal-delivery/. Production and test
bytes are unchanged, as they are in this reconciliation. Final commit checks
must pass before Ready; the raw verifier failure and deferred cases below remain.

## Verify Checklist

Closure checks in this worktree (2026-10-16): the first `bun run test:done`
failed with seven 60-second test deadlines across lint-config (1),
pre-tool-architecture-stage (3), resolve-verify-ticket (2) and retro-filing (1):
2,070 passed / 7 failed in 360.66 seconds. The cause remains unexplained.
The four files then passed 186 tests in 41.67 seconds, and the complete unchanged
close subset passed all 2,077 tests in 48.33 seconds. No timeout, retry policy,
test or production source was changed. These are later successes, not an erasure
of the failed run or of the earlier formal verifier failure.

Collector initially could not start because tsup was absent. The existing frozen
lockfile install restored the worktree dependencies (no tracked dependency
change). Collector then passed 153 tests; relay passed 198 with one skipped.
Go returned success with no test files. These complete the resolved task-close
test lanes. Passing command logs are retained as closure-*.log.gz beside the
formal-delivery evidence; the first failed run's result above is a transcript
summary, not a claim that its complete raw output was archived.

**Test Suite:** ❌ Initial full CLI pass: 15 failures; second full pass: 11,080 passed / 14 skipped. Subsequent targeted checks pass; see attribution below.
**Gherkin:** ✅ Acceptance lane passes — two runs of 596 scenarios / 11,118 steps, each followed by 50 provenance passes; final changed-flow replay: 14 scenarios / 668 steps.
**Build:** ✅ Success — resolved repository build plan, including the nine-page website.
**Lint:** ✅ Clean — root ESLint, Gherkin lint; final changed hook-test ESLint and target formatting pass.
**Typecheck:** ✅ Clean — resolved plan includes package TypeScript, Astro and Python checks.
**Scenarios:** ⏭️ Skipped — delivery task has no scenario ledger; four implemented child contracts and unfinished epic work retain their own status.
**Refactor:** ✅ Completed — 0e459e074 reuses the target matcher; 58014900a shares the repair proof descriptor. Each was tested and committed separately.
**PR Scope:** ✅ Diff matches ticket scope — bounded approval repair, its proof, accurate workflow docs and authorized test-quality improvements.
**Dep Drift:** ✅ No added runtime dependencies or lockfile changes; CLI manifest changes are generator scripts, with a separate bundler configuration prerequisite. This is not a clean security-audit claim.
**Parent Epic:** 82T411 / #4200 (siblings: 0/11 marked done; five children retain 418 undefined scenarios).
**Reconcile:** ✅ No pattern deviation — existing receipt identity, phase transition, digest-bound human authority and generators remain the owners.
**Experience:** ⚠️ Documented reader walk only; broader epic demo and human usability remain uncertified. See delivery-checks.md.
**Surface Evidence:** ⚠️ Current CLI/PTY proof, copied native-bundle walkthrough and rendered website proof; 33 accepted OpenCode/cloud cases remain deferred and unverified.
**Evidence limits:** ⚠️ Initial full-suite deadline/status failures remain unexplained; baseline dependency advisories remain unresolved; live qualification is earlier-revision evidence.

Audit passed with zero errors and one explained false orphan warning: the
delivery-compatibility rubric is imported by its generator. Post-refactor audit
has the same result. Scope is origin/main plus working changes, not a repository
unused-code or upgrade audit. Manual test review and reference coverage are
bounded in delivery-checks.md. The generic principle resolver conflicts on the
integration branch; explicit X47AWV resolution succeeds, and this task has no
impl-plan.md principle trace to validate.

## Proof and attribution

The packaged verifier ran its prescribed executable block verbatim and exited 1.
It separately discovers root and package lanes, accounting for the duplicate
full CLI and acceptance passes. Root relay: 198 passed / 1 skipped; collector:
153 passed (also repeated by discovery). The Go experiment has no tests.

The first CLI pass failed pr-readiness-install (6), plugin-resource-contract (2),
missing-plan-contract (1), and post-tool-review (6). The second full CLI pass
passed on unchanged production bytes. After the hook-proof correction, all four
files passed directly (23 tests); collapsing three duplicate host-labelled cases
then left 10 passing tests in post-tool-review. These observations do not establish
the original timeout cause. Timeout budgets and retry policy are unchanged.

R1 protection: all 44 public CLI approval/recovery tests pass, including both
human settings, the original refusal regression and fresh-review recovery.
R2 protection: 13 deterministic scenarios / 621 steps and 50 provenance tests
pass. Final expanded replay passes 14 / 668, including the full installed-CLI
RED-to-GREEN journey and justified REFACTOR skip. Fast smoke: 2,171 tests pass.
These overlapping counts are not additive. The original bypass RED is untouched.

Extracting the actual hook helper and injecting a terminated child with empty
stdout reproduced a false quiet pass before correction. The corrected helper
rejects it and includes its timeout diagnostic. This is controlled selectivity
proof, not historical test-first evidence. Installed-readiness diagnostics now
also retain subprocess error, signal, stdout and stderr.

Both current copied native bundles successfully run offline project installation
and public feature-ticket creation with isolated host profiles. The installed
handbook matches the bundle and the ticket contains spec.md. Temporary fixtures
are removed. This complements, rather than replaces, the CLI/PTY recovery matrix.
All five generated surfaces and 276 parity pairs / 11 contracts are current.

## Security scan limits

The dependency lanes are not green. Bun reports eight advisories (two high,
three moderate, three low). Root uv reports six urllib3 identifiers; its output
contains matching GHSA/PYSEC identifiers for three CVEs, so do not call these six
distinct defects. The separate Python experiment reports none. Go reports zero
called vulnerabilities while noting one imported-package and twelve required-module
findings without observed calls. Those are scanner results, not an exploitability
certificate.

Root/website manifests and JavaScript/Python locks and requirements are unchanged
from the merge base. The CLI manifest changes only generator scripts. No new
dependency or affected call path is introduced here. Broad upgrades or a package
fork are outside this surgical landing repair; no new ignore was added and the
unfiltered results remain preserved.
Current high-severity records were fetched this session:
[HTTP cache](https://github.com/advisories/GHSA-ch52-4w7c-c8xp),
[braces](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm), and the
[urllib3 proxy record](https://github.com/advisories/GHSA-8988-9cw3-xx77).
The HTTP-cache record lists no patched version. Do not equate green CI with a
clean unfiltered verifier.

Correction after inspecting the passing CI dependency job: main already has an
explicit disposition in .github/workflows/ci.yml. It blocks high/critical
advisories, with named exceptions for these exact braces and HTTP-cache records
until patches ship. The comments explain the trusted project-glob input and
website-build-only exposure. Running that exact existing command locally exits
0. Its policy and the affected dependency files are unchanged from origin/main.
The root Python project is safeword-dev, has no runtime dependencies, and holds
only development-tool dependencies; its urllib3 findings remain a tooling
follow-up warning, not an introduced CLI release path. The initial assessment
that these existing findings required a new human risk decision was too broad.
Use the existing repository gate for PR readiness while retaining the nonzero
raw verifier and all advisories; no gate, threshold or exception was changed.

## Quality review

**Currency:** ⚠️ Host date 2026-10-15; pinned Node 24.18.1 and Bun 1.3.14; baseline advisories above remain.
**Sources:** ✅ Existing planning contracts and current primary API documents checked.
**Correct:** ✅ Bounded work approved by independent Claude Opus; no blocking errors.
**Elegant:** ✅ Two local deduplications; no added authorization mechanism.
**No-bloat:** ✅ No new production abstraction, dependency, timeout or retry policy.
**Wiring (code only):** ✅ Existing installed-CLI approval/recovery tests protect the changed matcher; no new entry point.
**Verdict:** APPROVE bounded changes, with retained warnings and the nonzero raw verifier disclosed.

First review: 6e52a574-f401-4dd1-a187-a2b160891b16. Its host-coverage warning
led to d76e05472: four identical executions became one honestly named Claude
template case. Final review: 5f8d7ea9-1362-4049-9424-99775f1338d8, independent
Claude Opus, approve, no errors. Final warnings are answered as follows:

- Latest-job discovery and informational leftovers: retained and explicitly
  disclosed in the proposal/PR. The guarantee protects already recorded repair;
  per-ticket job lookup is broader workflow work. No failed call grants authority.
- Unchanged-byte human approval: intentional existing digest policy, explicitly
  required by this task. Configuration docs state reuse once semantic review is
  current; this also applies after recorded discovery. Changed bytes require a
  fresh configured decision. The PR repeats that boundary without a new policy.
- Concurrent ticket edits: atomic rename is not cross-writer serialization;
  concurrency outside the locked approval ledger is not certified. A new locking
  mechanism belongs with broader ticket-writer ownership, not this backport.
- Broad legacy heading matching: preserve the existing conservative refusal and
  conversion policy. No unsupported legacy migration rule is added.
- Adapter proof-map fidelity: retain the bounded mapping audit, exact counts and
  real CLI assertions; generic step success alone is not semantic proof.
- Empty stderr: retain the hook's existing quiet-output check. A hypothetical
  future runtime warning does not justify weakening it without a reproduced case.

The first review's opt-in question was checked directly with TypeScript/Gherkin
parsers: all 12 corpus-backed scenario definitions carry @live and are excluded
by the default filter. No paid conformance run was repeated. The trusted test-only
interrupt switch needs no new protection.

**Provenance:** API behavior verified this session against official Node
[path](https://raw.githubusercontent.com/nodejs/node/v24.18.1/doc/api/path.md) and
[child-process](https://raw.githubusercontent.com/nodejs/node/v24.18.1/doc/api/child_process.md)
documents, and TypeScript's
[readonly contract](https://www.typescriptlang.org/docs/handbook/2/objects.html#readonly-properties).
Readonly is compile-time protection, not runtime freezing. Review and command
logs, controlled probe and fingerprints are retained under evidence/formal-delivery/.

**Next:** Complete normal X47AWV closure and collect final-commit CI under the
existing repository policy, then perform the user-authorized Ready promotion.
Present the bounded candidate and retained evidence limits for a human merge
decision. Do not merge, release, deploy or mark the epic complete.

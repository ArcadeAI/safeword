# X47AWV formal delivery verification

2026-10-15. Material head: d76e05472bc73af72b27d3be2ad3801a6baa4fa9.
This records local results before the evidence-only commit and push. Exact pushed
head and terminal CI disposition belong to Draft PR #5881's readiness block.
No ticket activation, completion, Ready promotion, merge or release is claimed.

## Verify Checklist

**Test Suite:** ❌ Initial full CLI pass: 15 failures; second full pass: 11,080 passed / 14 skipped. Subsequent targeted checks pass; see attribution below.
**Gherkin:** ✅ Acceptance lane passes — two runs of 596 scenarios / 11,118 steps, each followed by 50 provenance passes; final changed-flow replay: 14 scenarios / 668 steps.
**Build:** ✅ Success — resolved repository build plan, including the nine-page website.
**Lint:** ✅ Clean — root ESLint, Gherkin lint; final changed hook-test ESLint and target formatting pass.
**Typecheck:** ✅ Clean — resolved plan includes package TypeScript, Astro and Python checks.
**Scenarios:** ⏭️ Skipped — delivery task has no scenario ledger; four implemented child contracts and unfinished epic work retain their own status.
**Refactor:** ✅ Completed — 0e459e074 reuses the target matcher; 58014900a shares the repair proof descriptor. Each was tested and committed separately.
**PR Scope:** ✅ Diff matches ticket scope — bounded approval repair, its proof, accurate workflow docs and authorized test-quality improvements.
**Dep Drift:** ✅ Clean — no added runtime dependencies or dependency-file changes; this is not a clean security-audit claim.
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

**Next:** Collect exact-head CI under the existing repository policy, then present
the bounded candidate and retained evidence limits for a concrete human landing
decision. Do not promote or merge; do not mark the intake task or epic complete.

# Luna retrospective verification

Authoritative hosted CI 39042244535 passed on b352845a85b3f26829ff390322a2b7e14bedfd1d
for full packages, release gates, build and static checks on Node 22.23.2
and 24.18.1. Cucumber ran on Node 24.18.1 only; Node 22 intentionally skipped
that duplicated acceptance lane. Parity, CLI contract, OpenCode conformance and
dependency audit also passed.
Only evidence updates and a misplaced manual-scenario reference correction
follow this code head. Final closure-commit CI is required again before Ready.

## Verify Checklist

**Test Suite:** ✓ 143/143 tests pass after final test-only strengthening; 2,194/2,194 smoke tests and full hosted CI pass on unchanged b352 runtime source. Closure-head CI must cover the stronger assertions.

**Gherkin:** ✅ Acceptance lane passes: 596 scenarios, 11,118 steps on Node 24 (retro-b352-cucumber-summary.txt). The legacy manual retro feature is excluded and is not counted here.
**Build:** ✅ Success — current-source builds and hosted package builds pass.
**Lint:** ✅ Clean — changed-test ESLint, formatting and current-text Gherkin lint pass. Hosted lint passed on b352; closure-head hosted lint remains required before Ready.
**Typecheck:** ✅ Clean — CLI tsc and hosted typecheck pass.
**Scenarios:** ⏭️ Skipped — this task uses inline test definitions; the legacy manual feature has separately documented proof debt.
**Refactor:** ✅ No change warranted — the existing model resolver and argv builder need only a small model-specific conditional.
**PR Scope:** ✅ Diff matches ticket scope and the user's additional BDD/TDD assessment request: model default, Luna-only reasoning, direct regression tests, generated/dogfood output and evidence.
**Dep Drift:** ⚠️ Two pre-existing website runtime names are absent from ARCHITECTURE.md (astro-mermaid and satteri); this task changes no dependencies.
**Parent Epic:** N/A.
**Reconcile:** ✅ No pattern deviation — existing resolver, builder, regeneration and process-boundary test patterns are retained.
**Experience:** ✅ No new friction — walked a maintainer through real default extraction; worst step is waiting for the child model; new user steps = 0.
**Surface Evidence:** ✅ The changed Codex extraction surface has real command proof on installed and pinned CLIs; bundle proofs and activation limits are recorded below.
**Evidence limits:** ⚠️ Local OpenCode fixture cleanup fails with ENOTEMPTY, including isolation; the local full verification plan did not complete. Hosted checks pass. Manual BDD lacks complete cross-process proof; live access is scoped to this login; no fresh Desktop activation is claimed.

## Behavior and discriminating proof

Codex defaults to gpt-6-luna with low reasoning. The flag is emitted only for
that exact model name, including an explicit Luna override. Other model names
keep their existing reasoning behavior; aliases/versioned names are not
silently given a reasoning setting. Claude sonnet, Cursor auto, prompts,
authentication, parser, sandbox and schema remain unchanged.

Three override-compatibility assertions failed before the correction. All 143
command/extractor cases pass afterward. A deliberate missing--c mutation now
fails both positive reasoning assertions; restoration passes all 143 cases.
A second bare-argument mutation on non-Luna commands passed the two old
negative builder cases; the strengthened assertions reject it. Both negative
paths now inspect every argv element, covering bound and bare reasoning
settings. Restoring production source passes all 143 cases. Logs:
retro-negative-{weak-mutation,strong-mutation,final-green}.log.
No mutation remains. Real config resolution and extractor construction are
used, faking only the subprocess edge. The explicit-Luna builder case already
passes the literal model name and proves low reasoning; separate real-config
cases prove model-name forwarding, so another identical composition test was
not added for the reviewer's optional suggestion.

Fresh unmodified buildAutoExtractor runs on Codex 0.163.0 and pinned 0.160.0,
without model overrides or injected argv, return checked success for empty
and planted-finding transcripts. The empty result is exactly empty and the
planted bug yields a grounded finding. No issues were filed by these probes.
Both candidate models also passed six predeclared synthetic screening inputs;
see model-comparison.md for methods, raw evidence and API unit-price limits.

## Independent review and dispositions

Claude/Opus source review a7f18cf9-5fa8-49af-90ba-8832176193c0 approved the final
compatibility-corrected source, tests, mirrors, metadata and audit report.
The two oversized generated CLI bundles were excluded from direct model review;
all five surfaces regenerated and passed freshness, parity and inventory checks.
Applied its stale-work-log warning; b352 hosted CI now passes. Final evidence
review 69dce3bf-c3c3-4769-8062-75f6a30b895d approved the corrected records; its
negative-argv warning is now applied and mutation-tested. Runtime source is
unchanged; the closure commit still requires full hosted CI. The optional
explicit-Luna test suggestion is answered above. Historical explicit gpt-5.5
fixtures remain deliberate model-name forwarding examples, not defaults.

Release review 89006760-0ba2-402e-a946-59c535a1afdc caught the unconditional
reasoning flag's compatibility risk. Its recommended correction is applied:
only Luna pins low reasoning. This avoids changing non-Luna overrides.

The requested test-quality assessment is in test-quality-audit.md. BDD prose
now has the current model, explicit override behavior, real process boundaries,
nonvacuous filing/redaction assertions and atomic nudge examples. The added
filing-dispatch scenario was removed from CDX602 because it duplicated GH628F
and created an orphan reference; the feature now references the existing filing
contract and positive/negative integration tests. The desired failure invariant
is retained. The broader manual BDD contract remains changes_requested for
inherited Stop/CLI failure-propagation and timeout proof gaps; this is not
represented as an approved end-to-end BDD gate.

## Delivery surface evidence

| Surface | Proof | Result |
| --- | --- | --- |
| Codex extractor on 0.163.0 | Real default extraction, strict schema, empty and planted transcripts | Passed; no filing |
| Codex extractor on pinned 0.160.0 | Same real default path through package-local CLI | Passed; no filing |
| Project/common mirrors | Installer plus 276 parity pairs and 11 contracts | Passed |
| Generated native bundles | All five generators/freshness and inventory checks | Passed; no Desktop restart claim |

## Local limits and final handoff

The first local full CLI pass had 11,149 passes, 12 skips and one OpenCode
fixture cleanup ENOTEMPTY failure. The resolver's second full pass was stopped
when the compatibility finding required a source change; an isolated OpenCode
rerun also fails cleanup. Do not call the local full plan green or attribute the
failure solely to suite load. Independent hosted CI passes this unchanged
OpenCode boundary. Neither its code nor its test timeout was modified here.

Current logs: .project/tmp/retro-override-{red,final-green,mutation,smoke,live,
pinned-live,generate,types,parity,lint}.* and retro-b352-ci.json/log. Earlier
local full-plan output is retro-final-verify.log. This task has no parent spec
or Killer Demo. Assessment was diff-scoped; no whole-repository architecture
or dead-code audit is claimed.

No release or installed-cache upgrade has occurred. Public API unit rates do
not measure ChatGPT subscription charges, screening is not statistical
model equivalence, and access is not guaranteed for every account. After normal
reviewed ticket closure, push the closure commit and wait for its full CI before
Ready. Publishing and supported installed-plugin upgrade are separate steps.

---
id: NPMDET
type: task
phase: implement
status: in_progress
scope: Make lifecycle snapshot package operations deterministic without changing production.
out_of_scope: Production installation, general npm emulation, and real-install integration tests.
done_when: Unchanged snapshots pass without npm and missing package requests remain detectable.
---

# Keep lifecycle contracts stable for maintainers

## Tests

- [x] RED: block package-manager subprocesses; current contract test fails (13/13 fail).
- [x] GREEN: regenerate once and verify unchanged fixtures with a local fake (13/13 pass).
- [x] Mutation: omit the tsx request via a disposable Vite transform; all 12 snapshots fail.
- [x] Verify targeted tests, lint, and types; report broader verification limits.

## Evidence

Targeted lifecycle and intake tests: 18/18 pass. Package TypeScript check, targeted
ESLint, Prettier, and diff whitespace checks pass. Fixture regeneration preserved
the independently observed post-release output; no lifecycle result hashes or
uninstall tree hashes changed. The fake changes lockfile contents on package
removal so file-effect observation stays real. Existing real-install golden-path
tests remain unchanged. The fast smoke lane plus lifecycle/intake tests passed
1,921/1,921 tests across 96 files with fixture updates disabled (60.22 seconds).
Those results preceded the quality-review refinements below.

## Refactor scout

Read-only mechanical and independent semantic passes reviewed the new fake and
subprocess guard. All candidates resolved; no code changes warranted.

- [x] Tuple indexing in package resolution: retain; destructuring adds little clarity here.
- [x] Long `applyPackages`: retain; it is one fixture transaction, and splitting it
  would duplicate manifest/lockfile handling or introduce single-use plumbing.
- [x] Shared fake extraction: reject; no second consumer or duplicated intent.
- [x] Subprocess-call ledger: retain; caught exceptions must not conceal real npm calls.

No separate refactor commit was warranted. The earlier 1,921-test smoke result
applied to that unchanged implementation, before the quality-review refinements.

Scout checks: targeted ESLint/Prettier clean; audit config healthy; scoped
dependency check found no violations. No new dead references or duplicate intent
in the fake. The principle-trace helper also reported nine findings in unrelated
tickets CKWE2D and 3F5Z6P (missing principles/evidence); these are outside this
refactor scope and were not changed. Whole-repository clone/dead-code scans were
not run. Configured docs inventory is README.md and the website docs; neither
needs changes for this test-only, behavior-preserving assessment.

## Quality-review follow-up

Two independent Claude passes approved with no errors. Applied the first-pass
improvements and documented remaining bounded coverage in `quality-review.md`.
Regeneration-mode focused tests passed 25/25; all lifecycle result hashes remain
unchanged. Tree hashes intentionally changed with framed hashing and template edits.
Root lint (including Gherkin lint and TypeScript) and generated-plugin checks pass.
A tool-disabled synthetic walkthrough of the shipped demand skill resisted sponsor
framing; it does not prove installed-host behavior or elimination of model bias.

The overall verify command initially timed out on another worktree's lock. Its
acceptance lane passed 1,488 scenarios with three skips and two stale-catalogue
failures observed before regeneration; both failures passed a final-head rerun
(two scenarios, 90 steps).

Full CLI verification later completed: 8,862 passed, 13 skipped, five failed.
CI reproduced those five failures: BDD proof references still named removed tests,
and the JTBD integration test still searched for the old heading. Updated the
references and heading expectations. The proof-sharing ratchet required retaining
distinct scenario checks; their assertions were removed from the broad test rather
than duplicated. The ratchet is unchanged. Final focused checks pass 75/75,
including normal-mode lifecycle snapshots and all proof mappings. Targeted lint
and package typecheck pass. Await fresh independent review and CI before merge.

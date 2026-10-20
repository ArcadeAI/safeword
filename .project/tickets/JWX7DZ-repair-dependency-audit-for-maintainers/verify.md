# Verify dependency audit repair

## Verify Checklist

**Test Suite:** ✓ 11853/11853 tests pass — CLI 11502 passed/14 skipped, relay 198 passed/1 skipped, collector 153 passed/0 skipped. The 15 skips are not counted as passes. Full pinned local output remains in .project/evidence/markdown-it-audit/full-tests.log.gz.
**Gherkin:** ✅ Acceptance lane passes in hosted CI run 39479547605; this does not qualify excluded broader planning scenarios or native hosts.
**Build:** ✅ Success — pinned local workspace build and both hosted Node lanes.
**Lint:** ✅ Clean — root ESLint/Gherkin lint; separate real markdownlint stdin probes passed as recorded under Surface Evidence.
**Typecheck:** ✅ Clean — CLI tsc in root lint; no typed source changed.
**Scenarios:** All 0 scenarios marked complete — patch uses existing audit and suites, no feature ledger.
**Refactor:** ✅ No change warranted — one dependency floor and artifact update.
**PR Scope:** ✅ Diff matches ticket scope — manifest floor, lock override mirror and single resolved artifact/integrity entry, plus supporting delivery evidence only.
**Dep Drift:** ✅ Clean — no new architectural dependency; seven inherited unfiltered audit findings remain.
**Parent Epic:** N/A — isolated prerequisite for scenario PR 5994, not epic completion.
**Reconcile:** ✅ No pattern deviation — retain the existing major-version override and CI ignore list.
**Experience:** ⏭️ N/A — development dependency, no new persona workflow.
**Surface Evidence:** ✅ 1/1 affected surfaces have recorded proof — actual markdownlint consumer resolves 14.3.3 after forced frozen reinstall, accepts valid Markdown, rejects empty links with MD042 and renders heading/bold correctly.
**Evidence limits:** ⚠️ Independent material review covered the complete lockfile delta plus whole-file hash because the full lockfile exceeds the reviewer size limit. The implementation phase-wide review could not ingest retained gzip logs (REVIEW_TARGET_INVALID_TEXT), so the documented phase-review exception was recorded instead of claiming whole-branch independent coverage. Independent delivery-record review and exact-head CI remain required. No broad native qualification is claimed. Fresh metadata-head CI remains required before Ready or merge.

Audit passed within the dependency-only diff boundary. Its zero-module graph is
non-discriminating; real consumer checks, artifact integrity and the complete delta
review supply useful proof. No repository-wide dependency clearance is claimed.

## Retained evidence

- Material source head: `4d419f51d88c977b6e3ead2347de37e88fdd5b55`.
- Hosted CI: <https://github.com/ArcadeAI/safeword/actions/runs/39479547605>, terminal success on that exact head, including both Node suites, audit, acceptance and release gates.
- Local raw results, contrary observations and independent material review:
  `.project/evidence/markdown-it-audit/verification.md` and colocated raw logs.
- Material independent Claude/opus review: `e9797a52-540f-4ddd-be90-1a7406053ee2`, approved with no errors. Its stale-installed-copy warning is addressed by forced reinstall guidance and actual resolution proof.
- Vendor patched floor: <https://github.com/markdown-it/markdown-it/security/advisories/GHSA-r7fv-28h4-cvq7>, first fixed 14.x release 14.3.2. Lockfile resolves 14.3.3.
- 2026-10-20 pre-merge exact CI-policy audit rerun: exit 0, original ignores unchanged. Raw output is retained in pre-merge-audit.log.
- source-head-ci.json retains the terminal source-head CI rollup; source-node24-job.json retains the successful acceptance and release step results.

The original evidence documents are immutable historical snapshots from the Draft
delivery, when no merge was authorized and local acceptance had not run. This
newer record adds the subsequently completed hosted acceptance lane and the user's
normal-merge authorization. Those additions do not grant administrative bypass or
qualify broader excluded planning scenarios. The original lockfile-review approval
remains current because neither its targets nor their supporting bytes changed.
The recomputed current lockfile SHA-256 is retained in current-lock.sha256:
`f4ec5a840d9469ef611c4b0d23572d228f69580c8aeda6e1ec8e956045969c02`.
material-review-targets.diff is empty against source head 4d419f51d, confirming
that the material review targets have no changes. The intake review of this new
ticket is separately stale after bookkeeping edits and is not used as current
delivery approval.

## Review dispositions

Implementation-record review a96f6f87 approved independently with no errors. Its
request for command provenance is addressed by material-review-currency.log and
the additional HEAD/hash lines in pre-merge-audit.log. Its lint wording suggestion
is applied above. The test ratio is the verifier's required executed-test pattern;
all 15 skipped cases and package totals remain explicit beside it.

The implementation phase stamp uses the documented --skip form because the
phase-wide inventory includes binary gzip output that the coordinator cannot
decode as UTF-8. phase-wide-review-blocked.json retains that failure. This is an
explicit exception, not a successful whole-branch review or a changed review
policy. The independent material and delivery-record approvals remain separate.

This record is retrospective delivery bookkeeping, not a fabricated pre-change TDD
history. The earlier lint failure, interrupted test run and stale installed copy
remain failures/contrary observations in their original evidence. The first green
CI run does not cover newly added ticket metadata; wait for its new-head CI before
Ready or merge. No administrative bypass or merge of PR 5994 is authorized here.

# Verify the Markdown and Vite dependency audit repairs

The earlier Markdown-only record is retained verbatim in
verify-markdown-it-historical.md. Its green CI was followed by a fresh Vite audit
failure; no merge was attempted. This record covers the subsequent Vite repair.

## Verify Checklist

**Test Suite:** ✓ 11855/11855 tests pass — CLI 11504 passed/12 skipped, relay 198 passed/1 skipped, collector 153 passed/0 skipped. All 13 skips are excluded from the ratio. Fresh pinned root suite exit 0 after forced frozen reinstall; raw log and process result retained.
**Gherkin:** ⚠️ Pending — new-head hosted acceptance lane required before merge; prior exact-head successes are historical.
**Build:** ✅ Success — real Astro static build, nine pages and search index; all three workspace builds also completed in the successful default test commands.
**Lint:** ✅ Clean — root ESLint, Gherkin lint and CLI typecheck; separate real markdownlint accepting/rejecting stdin probes also pass.
**Typecheck:** ✅ Clean — root lint's CLI tsc; Astro generated its types during the successful site build.
**Scenarios:** All 0 scenarios marked complete — dependency-only patch uses the existing audit and regression suites; no feature ledger or native qualification claimed.
**Refactor:** ✅ No change warranted — minimal version overrides and required resolver changes; no application source refactor.
**PR Scope:** ✅ Diff matches ticket scope — Markdown and Vite audit repairs, required Rolldown/native-binding/type updates, and supporting evidence only. No #5994 scenario-source, template, canonical-policy, #5086 or audit-ignore change.
**Dep Drift:** ✅ Clean — no new architectural dependency; unfiltered audit retains seven inherited findings (two already ignored high findings, two moderate, three low).
**Parent Epic:** N/A — isolated prerequisite for updating scenario PR 5994, not completion of epic 4200.
**Reconcile:** ✅ No pattern deviation — use existing exact-pin security overrides; keep the two original CI advisory ignores.
**Experience:** ⏭️ N/A — no new product workflow; actual development consumers are exercised.
**Surface Evidence:** ✅ 3/3 affected consumers have recorded proof — Vitest and Astro resolve Vite 8.2.4 after forced frozen reinstall; all three test workspaces and the Astro site build pass; markdownlint still resolves 14.3.3 and passes rendering/acceptance/refusal probes.
**Evidence limits:** ⚠️ New-head hosted CI/acceptance pending before Ready or merge; local tests and build are green. Windows-only exploit not reproduced; no Windows or native-model qualification claim. Inherited PostCSS 8.5.23 override remains outside Vite's declared ^8.5.26 range; successful build and tests prove only exercised paths. Material review is bounded to the manifest and exact lock delta, not unchanged lockfile entries or binary logs.

Audit passed within the diff boundary. Security-policy audit RED/GREEN is
discriminating; architecture cruise reports zero modules/edges and contributes no
architecture assurance. Whole-workspace Knip, clone totals and upgrade discovery
remain outside diff mode.

## Proof and independent review

- vite-pre-merge-red.log records the fresh failure at ea9b8288c with old lock hash.
- vite-audit-green.log records the same command and original ignores passing with
  repaired lock hash be18ed22e67790dd2ef6b3736ac4bfd2bf436d9ca0dc5bb04a16ea82888da4eb.
  Both are before commit, distinguishable by content hash. A fresh audit on the
  committed merge head is still required immediately before merging.
- vite-consumer-resolution.log records the actual Vitest and Astro Vite paths.
  Forced install completed before any current test or build began.
- Fresh independent Claude/opus material review
  01623755-ba64-44ed-a02b-2d791b6e3d3f approved with no errors; its raw result is
  vite-independent-review.json. Its targets were package.json, the incremental
  vite-lockfile.diff against ea9b8288c, and vite-repair.md. Earlier source approval
  is historical; do not describe the changed manifest's old review as current.
- Vendor fixed-release evidence and registry integrity are in vite-repair.md.
  The fixed Vite release is 8.2.4; required Rolldown ~1.2.4 resolves 1.2.14 with
  matching bindings/types. There is no unrelated broad dependency update.
- All five generated surfaces are current (vite-generated.log). Raw current
  full-suite, build, lint, forced-install and unfiltered audit outputs are retained
  alongside this record. The fresh run executes two more tests than the earlier
  run (12 rather than 14 CLI skips); no test file was changed and earlier counts
  remain historical. Only the observed current pass/skip totals are claimed.

## Contrary observations and dispositions

- Existing PostCSS override falls below Vite's requested range (already true at
  old Vite). Kept separate rather than widening the patch; retain the observation,
  site-build result and final regression result. No universal compatibility claim.
- Rolldown's multiple patch releases, new native binding and type version are
  substantive dependency changes. The site build, complete tests and current-head
  CI must pass before admin merge.
- The exact Vite override needs future maintenance; CI audit and a fresh pre-merge
  audit remain guards. No audit exception was added for the new advisory.
- The original implementation phase-wide review could not ingest preserved gzip
  logs. Its documented exception remains a limitation, not successful full-branch
  independent coverage. New material and verification reviews remain separate.
- Reopening was initially blocked by a done-phase review gate. Review 6cdebf3a
  requested reopening; a documented backward-transition exception allowed that
  correction. Fresh independent intake review 42f0f689 approved and its normal
  stamp succeeded. No review policy was modified.
- Original failed/interrupted tests, stale installed copies, seven inherited audit
  findings, native qualification gaps and wider scenario deferrals are preserved.

## Delivery

The user explicitly authorized admin merge of PR 5996 after green CI. No merge
attempt has consumed that authority. Finish verification and closure, push the
exact reviewed head, wait for terminal CI, then rerun the exact audit immediately
before merging. Only update and test PR 5994 afterward; do not promote or merge it.

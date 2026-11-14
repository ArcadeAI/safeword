# Verification — W8G4RP

## Verify Checklist

**Test Suite:** ✓ 11648/11648 tests pass in the first complete CLI pass; relay 198 passes/1 skip and collector 153 passes. Duplicate CLI pass: one non-repeating failure, detailed below; isolated unchanged case 1/1 passes.
**Gherkin:** ✅ Acceptance lane passes — 599 scenarios, 11786 steps; proof lane 52/52 passes.
**Build:** ✅ Success — workspace builds and website production build.
**Lint:** ✅ Clean — root ESLint, Gherkin lint and CLI typecheck exit 0.
**Typecheck:** ✅ Clean — website and three workspace projects.
**Scenarios:** All 0 scenarios marked complete — dependency patch has no new scenario ledger.
**Refactor:** ✅ No change warranted — manifest and generated lockfile alignment only.
**PR Scope:** ✅ Diff matches ticket scope — two manifests, generated lockfile and delivery records.
**Dep Drift:** ✅ Clean — Astro already documented; Vite and Zod remain existing dependencies.
**Parent Epic:** N/A — supporting dependency patch, not new epic feature credit.
**Reconcile:** ✅ No pattern deviation — existing root override mechanism.
**Experience:** ⏭️ N/A — dependency maintenance, no new user interaction.
**Surface Evidence:** ✅ 2/2 affected surfaces have recorded proof — built website served over HTTP; workspace typecheck and dependency compatibility test.
**Evidence limits:** ⚠️ Duplicate local CLI pass had one attempt-count failure; original run and retry both retain their nonzero aggregate exits. One full CLI pass and CI at 0c1ed33d8 are green, and the unchanged isolated case passes. Precise cause of the non-repeat is unconfirmed; no assertion or timeout was changed.

## Checks and review

- Raw `scripts/dev bun audit`: no vulnerabilities across 1173 packages, without severity filtering or suppressions. Log: `/tmp/4200-astro-compatible-audit.log`.
- Website build renders nine pages. Local HTTP check returned 200 and the Safeword page title (23477 bytes); this is a delivery smoke check, not a visual browser walkthrough.
- Existing `tests/dependency-override-compatibility.test.ts`: 1/1 passes. Log: `/tmp/4200-astro-compatible-vitest-compatibility.log`.
- All five generated surfaces are current; no generated edits.
- Diff-scoped Audit passed: no source changes or dependency violations; global Knip, clone totals and unrelated freshness discovery intentionally excluded. Principle trace is N/A: patch has no implementation plan. No changed test assertions.
- Independent full four-file review `e60466db-0685-47bf-b77b-2c148d46191d` approved. Preferred Claude Opus route timed out; actual reviewer was Claude Sonnet, cross-agent. Exact model identity was not independently qualified. Intake approval: `b677d125-74c2-4879-89d3-72b5189aed2d`.
- Review warning responses: the compatibility test log above supplies the omitted raw proof. Exact Astro pin deliberately holds the tested minimum patch addressing both advisories; later security patches require a deliberate update. Satteri versions remain separate because consumer ranges differ; site configuration only externalizes Satteri and passes no AST objects across versions. Website build/typecheck pass. No unrelated deduplication added.
- Initial Astro-only review `025564ef-35af-4889-b700-02fa3111e3a9` requested changes; Vite/Zod minima were then aligned. That failure remains preserved.

## Failed full run, preserved

`/tmp/W8G4RP-verify.log`, exit 1: CLI passes failed with 46 and 31 test failures, respectively; fixture setup and package downloads timed out, and explicit DNS lookup failures affected npm, OSV, pip and Go proxy endpoints. These failures are not erased or claimed as passing. Relay 198 passes/1 skip, collector 153 passes, behavior scenarios 599/599 and proof checks 52/52 passed; repeated lanes overlap and are not added together.

After direct network probes recovered, the unchanged full block was retried once into `/tmp/W8G4RP-verify-retry.log`, aggregate exit 1. First CLI pass: all 724 files and 11648 tests pass, 14 skips. Duplicate pass: 723 files/11647 tests pass, one failure, 14 skips. All 599 scenarios/11786 steps and 52 proof checks pass. Builds/typechecks pass. Raw Bun audit clears all 1173 packages; Python audits clear 39 packages and the other configured environment. Go finds zero reachable vulnerabilities, retaining one imported-package and 14 module-level notices. Counts from repeated lanes overlap.

The sole duplicate-pass failure is `tests/cli-protocol/review-wiring.test.ts`, “rejects missing OpenCode provenance without recording independent evidence”: expected two Codex attempts, observed one before OpenCode/Claude fallback; the refusal exit assertion passed. Isolated unchanged rerun: 1/1 passes, 138 unselected cases, exit 0 (`/tmp/W8G4RP-provenance-isolated.log`). The first complete pass and both CI Node jobs pass the same test. A scheduling/probe-budget explanation is plausible but not proven, so this is retained as a non-repeat, not declared fixed.

CI run 43561471567 on head 0c1ed33d8a78e1bf8381b50fdc40d0ce738d5c29 completed successfully without reruns. Final record-only closure commit will receive its own CI before merge. No timeouts, assertions, review routes or qualification settings changed.

Permanent raw evidence: `/Users/alex/Projects/safeword-trials/2026-11-08-main-da2778353-csv/epic-followthrough-2026-11-13/planning-preservation/astro-delivery/`.

## Retained boundaries

This patch does not complete EP9 or change historical missing RED, failures, or the 33 deferred cases (MCWV4B 18, FC33HK 12, KKP2R3 2, DRD65E 1). Converter dependencies remain unchanged. PR #7397 stays Draft until final verification and closure; #7368 follows only after this patch lands.

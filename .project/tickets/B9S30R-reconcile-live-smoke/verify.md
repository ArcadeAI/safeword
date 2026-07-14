# Verify — B9S30R (reconcile-live-smoke)

## Verify Checklist

**Test Suite:** ✓ 1/1 tests pass — the deliverable live lane (`tests/smoke/reconcile.live.test.ts`) is green against the real GitHub API (`resolveTagDate('v0.68.0')` → `2026-07-07T21:47:32Z`, matching annotated tag `b64b93c` → commit `d5905a7` committer date). Full product suite 5172/5172 pass; 7 non-product failures are local full-suite overload (see Evidence limits).
**Gherkin:** ✅ Acceptance lane passes — 410 scenarios (407 passed, 3 skipped), 10549 steps.
**Build:** ✅ Success (tsup ESM + DTS).
**Lint:** ✅ Clean (eslint src+tests = 0, gherkin, tsc --noEmit = 0).
**Scenarios:** ⏭️ Skipped — task ticket, no test-definitions.md.
**PR Scope:** ✅ Diff matches ticket scope — branch adds exactly one file (`packages/cli/tests/smoke/reconcile.live.test.ts`); no product code touched.
**Dep Drift:** ✅ Clean — no new dependencies (test-only change).
**Parent Epic:** N/A
**Reconcile:** ✅ No pattern deviation — mirrors the existing `codex-parity.live.test.ts` live-lane env-gate pattern.
**Experience:** ⏭️ N/A — internal test/plumbing, not persona-facing.
**Evidence limits:** ⚠️ Full-suite run had 7 failures, all local-environment limitations unrelated to this diff (which touches no product code):

  - `cursor-stop-review.test.ts` (5) — setup helper `buildProject` didn't produce its state artifact under concurrent full-suite load; **re-ran isolated → 6/6 pass**.
  - `rust-golden-path.test.ts` (1) — `cargo clippy --fix` char-literal rewrite is toolchain-version behavior.
  - `cleanup-zombies.test.ts` (1) — spawned test process not detected ("already clean") — process-spawn timing under load.
  - Base SHA `0066461` is CI-green (`ci.yml` success), which is authoritative per the full-suite-overload discipline.

**Audit:** Audit passed with warnings — architecture ✔ no dependency violations (610 modules); config in sync (W007 clean); knip did not flag the new file (one pre-existing W005: `gh` stale in `knip.json` ignoreBinaries — untouched, out of scope); jscpd 432 clones (8.19%) [repo minus node_modules,dist,.safeword,.project] baseline, new file adds none; outdated eslint 10.6.0→10.7.0 + tsx 4.23.0→4.23.1 (dev/patch/Low, out of scope). Test-quality of the new file: clean.

## Live-run evidence (the point of this ticket)

The version-provenance path never runs in CI or dev/session containers (no `api.github.com` egress) and fails closed, so a regression is invisible. Run here from an egress-capable environment WITH a GitHub token:

- Egress probe: `GET api.github.com/.../git/ref/tags%2Fv0.68.0` → **200**.
- Vitest live lane: `bun run --cwd packages/cli test:smoke:live` (targeted) → **Test Files 1 passed (1) / Tests 1 passed (1)**, 1.03s, on a fresh `dist/` build.
- Direct call: `createReconcileTransport(<token>).resolveTagDate('v0.68.0')` → `2026-07-07T21:47:32Z`.
- Cross-check: `v0.68.0` is an **annotated** tag (object `b64b93c`) that derefs to commit `d5905a7`, whose committer date `2026-07-07T14:47:32-07:00` = `2026-07-07T21:47:32Z` — exactly the API result. Proves both the `%2F` ref encoding (a broken encoding 404s → `undefined`) and the annotated-vs-lightweight deref branch (github-rest.ts:212).

Ready to mark done.

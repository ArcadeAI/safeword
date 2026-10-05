---
id: 2W56F0
slug: stale-lifecycle-fixtures-gate
type: task
phase: done
external_issue: https://github.com/ArcadeAI/safeword/issues/5312
external_prs: [https://github.com/ArcadeAI/safeword/pull/5363]
status: done
created: 2026-10-04T23:49:00.391Z
last_modified: 2026-10-05T02:58:00.000Z
---

# Catch stale lifecycle fixtures before CI for contributors editing templates

**Goal:** A template edit is caught by the pre-commit generated-surface gate and repaired by its --fix command, while lifecycle result-hash changes stay guarded.

**Why:** Template prose edits failed CI on PRs #5270 and #5286 via tree_sha256 drift with no local signal (#5312).

## Tests

- `packages/cli/tests/scripts/lifecycle-fixtures.test.ts` — stale after prose edit / added file / pre-digest manifest; ignores `.DS_Store`; tree-only drift accepted; moved result hash named.
- `packages/cli/tests/scripts/lifecycle-fixtures.test.ts` (gate) — the real `check-generated-surfaces.ts` fails on a stale scratch manifest and names the surface; the `--fix` regenerate step updates then verifies and names moved results (fake contract runner).
- `packages/cli/tests/lifecycle/origin-main-contract.test.ts` — manifest digest matches templates; result vs tree drift fail with distinct messages naming `check-generated-surfaces.ts --fix`.

## Work Log

- 2026-10-04T23:49:00.391Z Started: Created ticket 2W56F0
- 2026-10-04T22:55Z Complete: 5th surface in check-generated-surfaces.ts (templates digest in manifest; --fix regenerates + verifies, fails on result_sha256 change). RED->GREEN on manifest digest test. Commit 2864816.
- 2026-10-04T23:10Z Complete: tdd-review found untested gate logic + locale-dependent sort; extracted scripts/lib/lifecycle-fixtures.ts with 7 tests (RED first), code-unit sort. Commit 64db712.
- 2026-10-04T23:12Z Complete: refactor — contract test reuses staleness helper. Commit 86ce496.
- 2026-10-04T23:14Z Complete: quality-review — Codex cross-agent APPROVE, no findings.
- 2026-10-04T23:48Z Found: PR #5363 CI 13 pass / 9 skipped at 86ce496. Known gap (src/ changes moving tree) tracked in #5368.
- 2026-10-05T00:50Z Found: cross-agent review 1de79f3f requested changes — gate wiring untested. Fixed in bfd52f0 (subprocess test of the real gate; deleting the wiring line turns it red).
- 2026-10-05T02:55:20.492Z Phase: implement → done

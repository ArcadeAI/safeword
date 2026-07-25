# Verify: Bind spec invariants to falsifying scenarios

## Verify Checklist

**Test Suite:** ✅ Full suite green in CI on Node 22.22.3 and Node 24 —
[run 30177280263](https://github.com/ArcadeAI/safeword/actions/runs/30177280263).
Targeted suites also green locally (132 passed across 13 files).
**Build:** ✅ Success (tsup ESM + DTS via the vitest build lock)
**Lint:** ✅ Clean (eslint, lint-gherkin, tsc --noEmit)
**Format:** ✅ Prettier clean
**Parity:** ✅ 193 pairs and 8 contracts in sync
**Scenarios:** N/A — task, no scenario ledger (see ticket.md Type note)
**PR Scope:** ✅ Diff matches ticket scope. No piggybacked changes.
**Dep Drift:** ✅ None — no dependency change
**Parent Epic:** N/A
**Reconcile:** ✅ Follows the existing mirror-drift test pattern
(`feature-source-documentation.test.ts`) and the cross-cutting lens format
already used by Surface coverage and Wiring.
**Experience:** ⏭️ N/A — agent-facing review prose

## Evidence

- `bun run lint` — eslint, gherkin lint, and typecheck pass.
- `bun run format:check` — clean.
- `bun scripts/parity-check.ts --mode=all` — 193 pairs, 8 contracts in sync.
- `bun run generate:codex-plugin` — 26 assets regenerated; catalogue release test green.
- `tests/skills` + `feature-source-documentation` + `codex-plugin-catalogue.release` — 132 passed.

## Negative control

The drift test was verified to bind, not merely pass: removing the lens from
`.agents/skills/review-spec/SKILL.md` failed
`review-spec-invariant-binding.test.ts` on exactly that surface (1 failed, 33
passed); restoring it returned the suite to green. A test that passes both with
and without the change under test is the vacuous shape this ticket exists to
catch, so it was checked rather than assumed.

## Calibration against a known positive

The lens was validated against the case that motivated it. QRX2DN's `spec.md`
line 64 states the invariant ("must never become a lifecycle-mutation
fallback"); its ledger row 11 names it ("never selects a fallback for unbound,
non-done, or already-done state"); every scenario behind that row binds a
session id, so the no-identity precondition the invariant names went
unexercised. Applying the lens to that pair yields a must-fix under the
named-but-weaker clause — the defect that shipped as issue #1425.

## Evidence limits

The full package suite could not be run green in the authoring container:
`tests/hooks/self-report.test.ts:410` chmods a directory to `0o555` and asserts
the write fails, but the session runs as uid 0 and root bypasses permission
bits — verified directly, not assumed. The diagnosis was confirmed rather than
assumed: the same test passes in CI on both Node lanes, which run non-root.

That limit is now closed by CI rather than argued around. Run 30177280263
executed lint, Dogfood parity, and the full suite on Node 22.22.3 and Node 24,
all green, against the merge of this branch with `main` at 45a304a — so the
result also covers integration with #1422, which landed after this branch was
cut and touches none of these files.

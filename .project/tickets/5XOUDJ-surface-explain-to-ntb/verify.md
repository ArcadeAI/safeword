# Verify — surface-explain-to-ntb (5XOUDJ)

## Verify Checklist

**Test Suite:** ✓ 491/491 tests pass (done-gate lane: hooks + schema)
**Gherkin:** ✅ Acceptance lane passes (69 scenarios / 741 steps)
**Build:** ⏭️ Skipped — no build step (test-plan emits none)
**Lint:** ✅ Clean (markdownlint: 0 errors on README + both SAFEWORD.md copies)
**Scenarios:** ⏭️ Skipped — patch, no test-definitions.md
**Dep Drift:** ✅ Clean — no dependency changes
**Parent Epic:** K6CAJN (siblings: 1/7 done)
**Reconcile:** N/A — additive doc edits, conformed to the existing command-list and Enforcement-section patterns

## What was verified

Implements option (a) from the 5XOUDJ figure-it-out — surface `/explain` via
docs only, no code:

- **README** — added `/explain` to the command list (between `/debug` and
  `/lint`) with NTB framing: "Plain-English version of any safeword block,
  verdict, or your current state."
- **SAFEWORD.md** (template + byte-identical dogfood) — added an Enforcement-section
  rule: the user can run `/explain` on a block; the agent offers it in one line
  **on confusion-signal** (asks "what?", pastes a block, stalls) and stays quiet
  when they're moving fine. This is what gives the agent awareness of `/explain`
  (its skill description is hidden by `disable-model-invocation: true`) without
  flipping that flag.
- **Both SAFEWORD copies byte-identical** — `diff -q` clean.
- **Threads NTB+TB** — offer fires on confusion-signal, not block-occurrence, so
  a TB who clears a block silently never sees it.
- **Higher-floor safety net split out** — the always-visible block-hint
  reliability fix (figure-it-out option c, bug #17356) is filed as fast-follow
  19E2XQ under epic K6CAJN, since it touches the gate hooks.

Docs-only change; the TS suite + BDD lane were run to confirm nothing broke.

Ready to mark done.

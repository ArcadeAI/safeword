# Verify — plainness-contract-persona-aware (QQJK5S)

## Verify Checklist

**Test Suite:** ✓ 491/491 tests pass (done-gate lane: hooks + schema)
**Gherkin:** ✅ Acceptance lane passes (69 scenarios / 741 steps)
**Build:** ⏭️ Skipped — no build step (test-plan emits none)
**Lint:** ✅ Clean (markdownlint: 0 errors on both SAFEWORD.md copies)
**Scenarios:** ⏭️ Skipped — task, no test-definitions.md
**Dep Drift:** ✅ Clean — no dependency changes
**Parent Epic:** K6CAJN (siblings: 0/6 done)
**Reconcile:** N/A — conformed to the section's existing bold single-idea-rule pattern

## What was verified

The change reworks the "Talking to the user" rules in SAFEWORD.md (template +
byte-identical dogfood copy) so the plainness contract threads both the
Non-Technical Builder and the Technical Builder.

- **Both copies byte-identical** — `diff -q` clean.
- **Three threading acceptance criteria met** — gloss on actionability not
  detected audience; layer (inline gloss a fluent reader skips at no cost);
  one gloss, once, ≤1 clause.
- **No regression** — the prior "prefer the plain word upfront" rule, dropped in
  the first pass, was restored when the paragraph was split into two rules.
- **Reviewed + refactored** — an independent fresh-context `/quality-review`
  flagged two CRITICALs (dropped rule; 180-word paragraph violating the
  section's own scan-not-read ethos); both fixed by splitting into "Speak
  plainly" + "Gloss jargon at the decision point".
- **No markdown breakage** — markdownlint clean; section structure intact.

Docs-only prose change; no application code touched, so the TS suite and BDD
lane were run to confirm the template edit broke nothing the schema/hook tests
or acceptance scenarios assert.

Ready to mark done.

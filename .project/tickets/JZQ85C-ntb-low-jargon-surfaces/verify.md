# Verify — ntb-low-jargon-surfaces (JZQ85C)

## Verify Checklist

**Test Suite:** ✓ done-gate lane green + 70 targeted tests (hooks integration + config-guard patterns)
**Gherkin:** ✅ Acceptance lane passes (149 scenarios / 2,492 steps)
**Build:** ✅ tsup build clean; `tsc --noEmit` clean
**Lint:** ✅ Clean (prettier --check passes on all six changed files)
**Scenarios:** ⏭️ Skipped — task, no test-definitions.md
**Dep Drift:** ✅ Clean — no dependency changes
**Parent Epic:** K6CAJN
**Reconcile:** Applied the QQJK5S "gloss at the decision point" contract; no new pattern

## What was verified — and the scope call

Applying the shipped plainness contract (gloss where it's load-bearing in an
_ask_; leave informational narration a developer skims), the three LOW surfaces
split into two reworded, one light-touch, one verify-only:

- **`pre-tool-config-guard.ts`** (a permission **ask** → reworded) — was
  _"{category} change requires approval … Per SAFEWORD policy: Fix code, don't
  weaken configs."_; now _"The agent wants to change a settings file that
  controls your safety checks ({category}). Approving this could weaken those
  checks … the agent should explain why."_ Highest-value: it's a real decision
  the human is asked to make.
- **`post-tool-bypass-warn.ts`** (user-visible warning → reworded) — dropped
  "Bypass pattern detected" / "Per SAFEWORD policy" / "Scope suppressions: line
  > block > file > project"; now leads plain: _"The agent tried to silence a
  > safety check instead of fixing the underlying code."_ The exact symbols
  > (`@ts-ignore`, etc.) are still listed for the developer.
- **`session-lint-check.ts`** (developer config-health narration → light touch)
  — replaced the `SAFEWORD Lint Check:` header with a plain lead (_"Heads-up:
  your code-style tools aren't fully set up, so safeword's automatic checks may
  not run:"_). The per-tool lines ("ESLint config not found", install commands)
  stay technical — they name the exact fix a developer needs, and the contract
  says don't gloss skimmable narration. Tests asserting those lines still pass.
- **`session-compact-context.ts`** (verify-only, **not changed**) — its
  `Phase | Gate` labels are injected as **agent context** to re-orient the agent
  after a compaction, not shown to the human as a primary message. The labels
  are correct for that audience. Confirmed it stays agent-context; rewording
  would strip vocabulary the agent uses. Left as-is by design.

Templates synced byte-identical to dogfood copies (all three). No tests asserted
the reworded strings (config-guard test checks patterns, not the reason text;
bypass-warn text is untested); the lint-check warning lines the tests _do_ check
were intentionally preserved.

Ready to mark done.

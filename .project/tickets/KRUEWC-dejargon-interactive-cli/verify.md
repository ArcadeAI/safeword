# Verify — dejargon-interactive-cli (KRUEWC)

## Verify Checklist

**Test Suite:** ✓ 492/492 tests pass (done-gate lane) + 51 setup/upgrade/migration integration tests (16 migration, 35 setup/upgrade)
**Gherkin:** ✅ Acceptance lane passes (69 scenarios / 741 steps)
**Build:** ⏭️ Skipped — no build step
**Lint:** ✅ Clean (eslint 0 errors)
**Scenarios:** ⏭️ Skipped — task, no test-definitions.md
**Dep Drift:** ✅ Clean — no dependency changes
**Parent Epic:** K6CAJN (siblings: 5/8 done)
**Reconcile:** N/A — applied the QQJK5S plain-language contract to CLI output

## What was verified

De-jargoned the interactive CLI surfaces an NTB reads raw (no agent, no
`/explain` between them and the terminal):

- **Interactive namespace prompt** (the sharp "ask" — `upgrade.ts`) — was
  _"Move project namespace from .safeword-project/ to .project/ (recommended)?
  [y/N]"_; now _"Safeword can update an internal folder name to the current
  standard (.safeword-project becomes .project). It keeps your history and is
  safe. Do this now? [y/N]"_ — plain, names the effect, reassures.
- **Non-interactive nudge** — dropped "Namespace:", "legacy", "converge"; plain
  wording, exact command preserved.
- **"are now bundled in safeword"** → _"now come built into safeword, so your
  project no longer needs its own copy."_
- **"Generated dependency-cruiser config for /audit command"** → _"Set up the
  project-structure checks that /audit uses."_

## Behavior + scope calls

- **No behavior change.** The prompt still defaults to **No** (declines on
  empty input). I did **not** flip the default to auto-move — moving a repo's
  folder structure on a reflexive enter is a behavior change that deserves
  explicit sign-off, not a unilateral call.
- **Deferred (open question for the user):** flip the interactive prompt default
  to **Yes** so an unsure NTB gets the recommended outcome by hitting enter.
  Better adoption, but a behavior change — left for an explicit decision.
- **Left technical (by the contract):** the eslint peer-mismatch warning. It's
  dependency-manager narration (which ESLint major conflicts with safeword's),
  not an NTB "ask" — glossing informational narration a TB skims would violate
  the "gloss only at the decision point" rule.

CLI source only — no template/dogfood mirror to sync.

Ready to mark done.

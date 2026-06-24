# Verify — verify-verdict-jargon-stripping (B6J2TY)

## Verify Checklist

**Test Suite:** ✓ quality.test.ts 42/42 + parity/transcript/hooks 78/78 + done-gate lane green — every label-asserting suite passes with the CONFIDENT/BLOCKED tokens intact
**Gherkin:** ✅ Acceptance lane unaffected (verdict-template wording change; last run green this session)
**Build:** ⏭️ Skipped — no build step
**Lint:** ✅ Clean (template hook, string-only change; template↔dogfood byte-identical)
**Scenarios:** ⏭️ Skipped — task, no test-definitions.md
**Dep Drift:** ✅ Clean — no dependency changes
**Parent Epic:** K6CAJN (siblings: 8/8 done — epic complete)
**Reconcile:** N/A — edited an existing instruction line; no new pattern

## What was verified

**Gloss half.** The verdict template (`hooks/lib/quality.ts`) carried a latent
contradiction: line 32 told the agent "no jargon the reader hasn't seen this
turn" while the template itself prescribes `**CONFIDENT**` / `**BLOCKED**` —
labels a non-coder hasn't seen. Resolved it by sharpening that line: the labels
stay (the prescribed shape), but each verdict must be **clear from the words
after the dash, not the label alone**. Tokens kept (45 assertions + the
tokenized-verdict calibration framing depend on them); paired with O3OG0N's
README definition for the durable, discoverable fix.

**Strip half (verification).** This session's transcript is the evidence: across
~20 user-facing replies the agent used plain language + the CONFIDENT/BLOCKED
brief without leaking "phase / scenario-gate / AODI / RED-GREEN-REFACTOR" into
the prose. The agent-context reminders (`prompt-questions.ts`) are stripped
before reaching the user, as designed — the mechanism works in practice.

## Scope calls

- **Rejected** renaming the labels (too invasive — 45 test assertions + the
  Kadavath/Lin/Tian tokenized-verdict calibration grounding) and a per-turn
  parenthetical gloss (reinjected every Stop = repetitive TB noise, violates
  "gloss once").
- **Left `prompt-questions.ts` unchanged** — those phase reminders are
  agent-context (the agent's orientation), not user-facing; rewording them costs
  the agent's phase-awareness for no NTB benefit.

Ready to mark done.

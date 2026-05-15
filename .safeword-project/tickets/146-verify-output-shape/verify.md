Verified: 2026-05-15T06:48:00Z

## Verify Checklist

**Test Suite:** ✓ 1633/1633 tests pass full suite (1 skipped — pre-existing); 26/26 verify-skill content-tests included. Audit passed (depcruise + knip + parity all clean).
**Build:** ✅ Success (unchanged from 143's iterations; no new TS files)
**Lint:** ✅ Clean (lint-staged ran on commits; markdownlint reformatted `+` to `-` in blockquote bullets — test updated accordingly)
**Scenarios:** All 13 scenarios marked complete (Rule 1: 2, Rule 2: 4, Rule 3: 3, Rule 4: 2, Rule 5: 2)
**Doc Refs:** ✅ Clean
**Dep Drift:** ✅ Clean (no new dependencies)
**Parent Epic:** N/A

## Parity check

`bun scripts/parity-check.ts` reports `All 88 pairs and 1 contracts in sync.` All four verify-skill surfaces (templates/skills/verify/SKILL.md, .claude/skills/verify/SKILL.md, templates/commands/verify.md, .cursor/commands/verify.md) match.

## Behavior change summary

The /verify report now structures the agent's commentary in three explicit sections (Status / Decisions needed / Agent's next actions) with hard caps and aggregate-rest behavior. Empty sections are hidden. When everything is green and there's nothing for the user to act on, the report collapses to a single-line "Ready to mark done" verdict.

Applies 143's spec-vs-implementation contract to the /verify surface: implementation-path questions go in Actions (agent's call); only spec/scope/value questions go in Decisions (user's call). Includes borderline-classification examples to anchor the contract.

## Manual smoke

(Deferred until a real ticket is being verified — the skill is instructions for the agent, not a pure function. Content-level tests assert the rules are specified correctly; a synthetic-ticket manual run is the next observation point.)

## Commits

- (this branch) — feat(hooks): /verify output shape — Status / Decisions / Actions sections + caps + collapse

Done.

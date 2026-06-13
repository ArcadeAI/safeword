---
id: 166
type: task
phase: intake
status: in_progress
created: 2026-05-18T05:26:00Z
last_modified: 2026-05-18T05:26:00Z
scope: |
  Expand SAFEWORD_SCHEMA.contracts to cover cross-file invariants that currently
  drift silently. Targets surfaced by ticket 152 audit:
  - Skill ↔ skill handoffs (e.g., BDD's TDD.md must reference parseTddStep's expected
    `RED|GREEN|REFACTOR` regex shape; BDD's VERIFY.md must reference /verify + /audit
    invocations)
  - Hook ↔ hook coupling (e.g., stop-quality.ts must import analyzeScenarioFormat;
    pre-tool-quality.ts must import deriveTddStep)
  - Phase ↔ artifact coupling (e.g., the phase names enumerated in
    prompt-questions.ts:62-74 must match the enum in ticket-template.md)
  Add corresponding entries in tests/parity.test.ts contract suite.

  Sub-task (safeword-internal, rolled in from earlier audit-improvement debate):
  - Add a contract-coverage report runnable as part of safeword's own /verify
    or /audit work — not shipped to users since SAFEWORD_SCHEMA.contracts is
    safeword source-only. Heuristic: scan source files that are imported by N
    other files AND referenced by name in M docs/skills, but lack any contract.
    Surface as "could be contracted" candidates so future contract additions
    are informed by actual coupling, not guesswork.
out_of_scope: |
  - Inventing new abstractions (only declarative `requires:` strings)
  - Runtime enforcement (contracts are release-time / pre-commit only)
  - Migrating away from text-match contracts to AST-aware checks
  - Shipping the coverage report as a user-facing /audit feature (safeword-
    internal only — users don't have SAFEWORD_SCHEMA to reason about)
done_when: |
  - At least 4 new contracts added (skill handoffs + hook coupling + phase enum)
  - Each contract has a comment explaining what regression it prevents
  - Release parity passes (`bun run test:release`)
  - Removing any required token from the target file causes parity to fail
  - Coverage-report sub-task: a script or test that enumerates candidate
    couplings without contracts; output reviewed and any high-leverage ones
    added as contracts in this same ticket's work
---

# Expand schema contract mesh for cross-file drift detection

**Goal:** Use the existing `SAFEWORD_SCHEMA.contracts` mechanism to lock more cross-file invariants so future PRs can't silently desync paired files.

**Why:** Ticket 152 surfaced that the same concept (test-definitions format) was described independently in 5+ surfaces with no coupling. Two contracts were added there (template + scenario-format.ts). The audit revealed the mechanism is underused — the schema only has 3 contracts total covering one concept. More contracts cost ~5 lines each and prevent the next equivalent of "PR #121 updated SCENARIOS.md but not the template/guide/README."

## Work Log

- 2026-05-18T05:26:00Z Started: ticket created from 152 audit follow-up

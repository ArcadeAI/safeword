---
id: W42G34
slug: bash-ledger-write-gate
type: feature
phase: implement
status: in_progress
scope:
  - a pure predicate module (templates/hooks/lib/) that classifies a shell command as a write-shaped reference to a ledger file (test-definitions.md under the tickets namespace), with documented detection limits
  - deny wiring in the Bash branch of pre-tool-quality.ts (source of truth for Claude + Codex), with a denial message naming the Edit channel
  - widen cursor/gate-adapter.ts requiresFailClosedShellGate so Cursor's before-shell-execution consults the gate for ledger-writing commands
  - unit tests (tests/hooks/), a Gherkin feature source with lineage tags, and template<->dogfood parity
out_of_scope:
  - simulating shell to validate the resulting ledger content (rejected via /figure-it-out - statically impossible)
  - PostToolUse detection or repair of ledger writes that slip the predicate (done-gate distinct-SHA check remains the backstop)
  - one-checkbox-per-edit enforcement on the Edit path and any change to the edit-tool artifact cascade (parallel G1/G4 branch owns that region - collision avoidance per #644 remediation)
  - catching obfuscated writes (variable paths, eval, command substitution, script files) - documented as limits, not chased
done_when:
  - the literal #644 command (sed -i on a ledger path) is denied at PreToolUse with a message naming the Edit channel
  - read-only references (grep/cat/git diff) and unrelated commands pass; mere mention of the path without a write shape passes
  - the predicate is consulted on all three harnesses (Claude direct, Codex via adapter translation, Cursor via requiresFailClosedShellGate)
  - bun scripts/parity-check.ts reports no drift; full test suite green
created: 2026-07-03T21:19:49.637Z
last_modified: 2026-07-03T21:19:49.637Z
---

# Gate Bash-channel writes to the R/G/R ledger (#644 G3)

**Goal:** Deny Bash-channel writes to R/G/R ledger files at PreToolUse on all three harnesses, forcing ledger mutations onto the Edit channel where the SHA-or-skip annotation gate can validate them (#644 G3).

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.

## Work Log

- 2026-07-03T21:19:49.637Z Started: Created ticket W42G34
- 2026-07-03T21:24:00Z Found: design converged via /figure-it-out — channel-forcing deny chosen over simulate-and-validate (statically impossible) and PostToolUse repair (cannot deny); recorded in spec.md References
- 2026-07-03T21:27:00Z Auto-confirmed: JTBD sub-phase gate (autonomous session; remediation prompt for #644 G3 pre-approved intent — sized as feature per its explicit instruction "full strict BDD")
- 2026-07-03T21:27:30Z Auto-confirmed: AC sub-phase gate (autonomous session; ACs derive directly from the pre-approved intent: deny Bash ledger writes, spare read-only, cover three harnesses, document limits, actionable denial)
- 2026-07-03T21:28:00Z Auto-confirmed: engineering-scope sub-phase gate (autonomous session; scope boundary pre-set by remediation: stay in Bash branch, avoid edit-cascade region owned by parallel G1/G4 branch)
- 2026-07-03T21:31:00Z Complete: intake - Understanding converged, scope established; spec.md self-reviewed and stamped; dimensions.md authored (feature-readiness gate demanded it before the phase edit); phase -> define-behavior
- 2026-07-03T21:36:00Z Complete: define-behavior - 13 scenarios defined across 5 rules (features/bash-ledger-write-gate.feature + R/G/R ledger); phase -> scenario-gate
- 2026-07-03T21:48:00Z Found: independent /review-spec (fresh-context subagent) round 1 FAIL - 1 blocking (truncate + inline-interpreter write shapes unpinned), 2 strengthen (source-vs-target boundary, harness allow-side); all applied (+3 scenarios, +2 outline rows)
- 2026-07-03T21:52:00Z Complete: scenario-gate - re-review PASS; discretionary finding also applied (+1 scenario locking interpreter over-approximation); 17 scenarios total; review stamped; impl-plan.md written (Status: planned, proof plan + build order in Approach); phase -> implement
- 2026-07-03T22:10:00Z Progress: implement - all 17 scenarios ledgered with SHA-or-skip; 4 real RED-GREEN cycles (anchor 5d6930d/d6e79f0, shape outline f91627a/fd9effd, Cursor pre-filter 0e19bcd/2d14bdb) + 13 pin scenarios (allow-side/seam/doc-contract, skip-RED with reasons); 16 commits; whole-ticket /quality-review dispatched to fresh-context reviewer; full suite running

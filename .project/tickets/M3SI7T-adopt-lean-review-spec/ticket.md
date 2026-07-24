---
id: M3SI7T
slug: adopt-lean-review-spec
type: feature
phase: intake
status: in_progress
parent: 7ZLTWB
depends_on: [21RAT9]
scope:
  - Ship the validated lean review-spec candidate (experiments/gepa-review-spec/gepa/candidate-lean.md) into the live skill.
  - Migrate across every surface, byte-parity - the customer template (packages/cli/templates/skills/review-spec/SKILL.md), the dogfood copies (.claude/, Codex .agents/skills/), and the Cursor .mdc pair.
  - Grep packages/cli/tests for review-spec content assertions BEFORE migrating (they go red in CI on a content change).
  - Version bump (the 5 release-tracked artifacts) + release, since a skill change ships to customers.
out_of_scope:
  - Any further prompt optimization - the candidate is frozen; this ticket only adopts it.
done_when:
  - The lean candidate is the live review-spec skill on all three harnesses, byte-parity green (parity-check + tests).
  - A human (the user) has read and approved the 103-line prompt before it ships.
  - CI green on the content change; version bumped + released.
created: 2026-07-24T04:13:44.000Z
last_modified: 2026-07-24T04:13:44.000Z
---

# Adopt the lean review-spec candidate into the live skill

**Goal:** Ship the lean candidate — validated at Tier-1 (−46% false alarms) and Tier-2 (−34%, floor clean, real `claude -p` harness), recall intact — into the production review-spec skill across all harnesses.

**Status:** Ready to start — the candidate PASSED the Tier-2 ship gate (21RAT9). Gated only on the human read (the user) + the cross-harness migration mechanics.

**Riskiest step:** the byte-parity migration across template + dogfood + Cursor — a content-assertion test or a parity pair drifts and CI goes red. Grep the tests first; sync all surfaces in one commit.

## Work Log

- 2026-07-24 Created. Candidate: `experiments/gepa-review-spec/gepa/candidate-lean.md` (+32% vs the current skill, 103 lines). Passed Tier-1 and Tier-2 gates. Next: user reads it, then migrate byte-parity across all surfaces + bump + release.

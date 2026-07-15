---
id: G5337S
slug: pr-review-skill
type: feature
phase: intake
status: in_progress
depends_on: [CWGYH0]
scope:
  - The `pr-review` SKILL.md — the durable asset and the only real moat. Authored RUNNER-AGNOSTIC so it ports to the `review-pr` CLI without rewrite.
  - Three-pass procedure: COLD (code only, no narrative) → INTENT (the Linear contract) → BODY (last, only to catch body-vs-diff mismatch).
  - Four dimensions: intent conformance, scope discipline, alternatives, blast radius.
  - Triage verdict (safe-to-merge / needs-a-human / not-reviewable-as-is) as the PRIMARY output; findings second.
  - Uncapped findings behind an evidence bar; plain-language consequence on every finding (NTB1.R1).
out_of_scope:
  - The workflow, config, ownedFiles, kill switch, trigger gating, fork safety — all 36EEMY.
  - The eval corpus and its bar — CWGYH0.
  - Author-model detection — X1Z5MG. v1 implies it by config.
done_when:
  - Rules TB1.R1-R11 and NTB1.R1-R4 each have a proving scenario or an explicit skip.
  - The skill is silent on a certified-clean PR.
  - A finding it cannot verify never blocks; the skill says so rather than dropping it.
scope:
out_of_scope:
done_when:
parent: WAWQA6
created: 2026-07-15T14:24:45.692Z
last_modified: 2026-07-15T14:24:45.692Z
---

# pr-review-skill

**Goal:** The cross-model reviewer skill: read a PR against its declared intent (Linear contract), return a triage verdict plus uncapped bar-cleared findings. Serves TB1 + NTB1.

**Why:** The skill is the moat; the runner is a commodity. Everything else in this epic is delivery. Blocked-on CWGYH0 in spirit rather than sequence: the eval is what tells us whether the judgment is worth shipping, so build the skill against the eval, not ahead of it.

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.

## Work Log

- 2026-07-15T14:24:45.692Z Started: Created ticket G5337S

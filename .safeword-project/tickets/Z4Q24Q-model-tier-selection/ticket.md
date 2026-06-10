---
id: Z4Q24Q
slug: model-tier-selection
parent: VKNF1T-platform-uplift-epic
type: feature
phase: intake
status: in_progress
created: 2026-06-10T00:01:03.794Z
last_modified: 2026-06-10T00:01:03.794Z
---

# Model-tier policy: where to use opus / sonnet / fable across safeword tasks

**Goal:** Decide which safeword tasks/skills/sub-agents run on which model tier — opus (deep reasoning), sonnet (fast/cheap, judgment-light), fable (creative/prose) — so capability lands where it pays and cost is saved where it doesn't.

**Why:** Safeword spawns many sub-agents — Explore file-maps, quality-review, audit, figure-it-out research, dynamic workflows — that all inherit the session model today. Some genuinely need opus-level reasoning (design review, option-weighing, adversarial verification); others are mechanical (grep/file-mapping, format checks) and burn opus tokens for no gain; prose tasks (alex-voice, changelog/doc drafting) may suit fable. A deliberate per-task tier policy improves the cost/quality tradeoff.

> Status: **intake** — research/policy.

## Candidate mapping (starter)

- **opus** — figure-it-out option-weighing, quality-review / audit deep dives, adversarial verification, architecture/design decisions.
- **sonnet** — Explore / file-mapping sub-agents, mechanical refactors, format/lint checks, status synthesis — fast, cheap, judgment-light.
- **fable** — prose/voice surfaces: alex-voice, changelog / release notes, doc generation (if/when safeword does these).

## Open questions (converge before spec)

- **Decision axis:** per task-type (reasoning vs mechanical vs prose), per skill, or per sub-agent call? Lean: per task-type, set at the sub-agent spawn site.
- **Mechanism:** the Agent/Workflow tools take an explicit `model` param — where's the default? A safeword config, per-skill frontmatter, or inline at spawn?
- **Interaction with [dynamic-workflows](../9BDDGP-dynamic-workflows-for-safeword/ticket.md) (9BDDGP):** workflows pick model per agent — this policy _is_ part of that calibration. Coordinate or fold in.
- **Fable's relevance:** does fable touch safeword's dev-focused work at all, or only the prose/voice surfaces?
- **Calibration:** how to tell a tier choice is right (quality regression vs token savings)? Spot-check via evals (skill-creator's harness — see C2F601).

## Related

- Parent: [platform-uplift epic](../VKNF1T-platform-uplift-epic/ticket.md).
- [9BDDGP](../9BDDGP-dynamic-workflows-for-safeword/ticket.md) — workflows pick model per agent; this policy feeds it.
- [C2F601](../C2F601-absorb-claude-skills/ticket.md) — skill-creator's eval harness for calibrating tier choices.

## Work Log

- 2026-06-10T00:01:03.794Z Started: Created ticket Z4Q24Q

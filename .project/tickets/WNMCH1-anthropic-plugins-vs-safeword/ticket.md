---
id: WNMCH1
slug: anthropic-plugins-vs-safeword
type: task
phase: intake
status: in_progress
created: 2026-07-19T16:06:08.779Z
last_modified: 2026-07-19T16:06:08.779Z
---

# Anthropic claude-code plugins vs safeword capability comparison

**Goal:** Capture a thorough compare/contrast of Anthropic's 13 claude-code plugins against safeword's capability surface

**Why:** Reference for what safeword uniquely covers, what to borrow, and what to run alongside

## Deliverable

- [`comparison.md`](./comparison.md) — full compare/contrast: framing, 11 head-to-head capability areas with verdicts, safeword-only capabilities, Anthropic-only capabilities, philosophy table, and recommendations.

## Sources

- Anthropic marketplace `anthropics/claude-code` — 13 plugins, read from file contents (commands/agents/skills/hooks).
- Safeword v0.69.0 surface — ~20 skills, 40+ hooks, CLI, 5-phase workflow, read from `.claude/skills`, `.safeword/`, templates.

## Key findings

- Different species: Anthropic = à-la-carte point-tools; safeword = integrated gate-enforced process. They are complementary, not competing.
- Closest rival to safeword's enforcement philosophy: `security-guidance` (auto, session-diff, blocks-until-fixed); deeper on security specifically than safeword's general gate.
- Safeword-only territory: debugging, tickets/memory, spec+scenario gates, verify done-gate, retros, refactor/audit, versioning, auto-lint, architecture drift, 3-runtime parity.
- Anthropic-only territory: frontend design, plugin/SDK authoring, specialist review agents, commit commands, hookify DSL, teaching output modes, Ralph loop, model migration.
- Highest-value plugins to run alongside safeword: `pr-review-toolkit`, `security-guidance`, `frontend-design`, `commit-commands`.

## Work Log

- 2026-07-19T16:06:08.779Z Started: Created ticket WNMCH1
- 2026-07-19T16:06Z Filed comparison.md deliverable into ticket; research task complete (documentation artifact, no code change).

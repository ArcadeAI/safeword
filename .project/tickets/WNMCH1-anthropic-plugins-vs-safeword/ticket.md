---
id: WNMCH1
slug: anthropic-plugins-vs-safeword
type: task
phase: intake
status: in_progress
created: 2026-07-19T16:06:08.779Z
last_modified: 2026-07-19T16:06:08.779Z
external_issue: 1166
---

# Anthropic claude-code plugins vs safeword capability comparison

**Goal:** Capture a thorough compare/contrast of Anthropic's 13 claude-code plugins against safeword's capability surface

**Why:** Reference for what safeword uniquely covers, what to borrow, and what to run alongside

## Deliverable

- [`comparison.md`](./comparison.md) — full compare/contrast: framing, 11 head-to-head capability areas with verdicts, safeword-only capabilities, Anthropic-only capabilities, philosophy table, and recommendations.

## Sources

- Anthropic marketplace `anthropics/claude-code` — 13 plugins, read from file contents (commands/agents/skills/hooks).
- Anthropic marketplace `anthropics/knowledge-work-plugins` — `product-management` (8 skills) + `design` (7 skills) role playbooks, read from SKILL.md contents (§8).
- Safeword v0.69.0 surface — ~20 skills, 40+ hooks, CLI, 5-phase workflow, read from `.claude/skills`, `.safeword/`, templates.

## Key findings

- Different species: Anthropic = à-la-carte point-tools; safeword = integrated gate-enforced process. They are complementary, not competing.
- Closest rival to safeword's enforcement philosophy: `security-guidance` (auto, session-diff, blocks-until-fixed); deeper on security specifically than safeword's general gate.
- Safeword-only territory: debugging, tickets/memory, spec+scenario gates, verify done-gate, retros, refactor/audit, versioning, auto-lint, architecture drift, 3-runtime parity.
- Anthropic-only territory: frontend design, plugin/SDK authoring, specialist review agents, commit commands, hookify DSL, teaching output modes, Ralph loop, model migration.
- Highest-value plugins to run alongside safeword: `pr-review-toolkit`, `security-guidance`, `frontend-design`, `commit-commands`.

## Action candidates (see comparison.md §7)

**Gaps worth borrowing (net-new):** G1 commit/PR/cleanup commands incl. `clean_gone` (low) · G2 specialist review agents w/ per-axis rubrics (med) · G3 hookify-style user-authored guardrail DSL (med) · G4 agentic security tracer (high) · G5 frontend-design skill (med) · G6 teaching output modes (low) · **G7 connector-agnostic `~~category` placeholder pattern** from the PM/design role plugins (med).

**Overlap to sharpen (borrow the mechanic):** S1 scope Stop-review to this-session's diff via git-stash baseline (**pursue**) · S2 render each test with "the regression it prevents" (**pursue**) · S3 cheap-triage model ladder + validate-then-filter stage (consider) · S4 biased-parallel option generation in figure-it-out (consider) · S5 escalating-cost review tiers (later) · **S6 fold write-spec PM rigor (outcomes-not-outputs, non-goals, INVEST) into spec/self-review** (consider).

**Recommended first moves:** S1, S2, and G1 — high value, low risk, no philosophy change.

## GitHub tracking

Epic **#1166** `[Epic] Borrow & sharpen from Anthropic claude-code plugins [WNMCH1]` with 11 sub-issues:

- Recommended: S1 #1167 · S2 #1168 · G1 #1169
- Backlog: S3 #1170 · S4 #1171 · S5 #1172 · G2 #1173 · G3 #1174 · G4 #1175 · G5 #1176 · G6 #1177

(Adjacent: #1165 autonomous cross-vendor PR review — related to G2/S3, cross-linked not duplicated.)

## Work Log

- 2026-07-19T16:06:08.779Z Started: Created ticket WNMCH1
- 2026-07-19T16:06Z Filed comparison.md deliverable into ticket; research task complete (documentation artifact, no code change).
- 2026-07-19T16:19Z Added §7 action candidates to comparison.md (gaps to borrow + overlap to sharpen) and summarized recommended first moves here.
- 2026-07-19T17:03Z Filed epic #1166 + 11 sub-issues (#1167–#1177) on ArcadeAI/safeword; linked external_issue: 1166. Structure decided via /figure-it-out (epic + all 11, tiered).
- 2026-07-21T03:48Z PR #1160 merged. Restarted branch from origin/main and added §8 (product-management + design role plugins from anthropics/knowledge-work-plugins) as follow-up; added borrow candidates G7 (connector-agnostic `~~category` pattern) and S6 (write-spec PM rigor → spec/self-review).

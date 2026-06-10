---
id: VKNF1T
slug: platform-uplift-epic
type: feature
phase: intake
status: open
epic: platform-uplift
created: 2026-06-06T21:18:25.265Z
last_modified: 2026-06-06T21:18:25.265Z
---

# Epic: Absorb Claude's platform advances and harden safeword's surfaces

**Goal:** Group this session's seven tickets under one initiative — keep safeword current with Claude's evolving platform (figure-it-out everywhere, absorb upstream skills, dynamic workflows, plain-language explanation) while sharpening the surfaces those depend on (audit, CLI output, self-verification).

**Why:** Raised together in one session, these aren't independent — `audit` is reshaped by three of them at once, the two CLI tickets gate each other, and the research spikes feed the figure-it-out work. Tracking them as one epic keeps the couplings visible so we don't resolve the same surface three different ways.

> **Framing — a tracking/roadmap epic, not a tight feature.** The seven fall into three clusters (below), grouped as one initiative per direction.

## Tickets

**A — Absorb Claude's capabilities** (mostly research/intake)

| ID         | Title                                                                   | State             |
| ---------- | ----------------------------------------------------------------------- | ----------------- |
| **ZBVGPF** | Embed figure-it-out into skills + BDD/TDD + replan; runs every time     | intake            |
| **C2F601** | Audit Claude Code/Cowork skills, absorb (adopt/adapt/ref/skip)          | intake (research) |
| **9BDDGP** | Dynamic workflows: mechanism (which skills) + positioning               | intake (research) |
| **NTT094** | Explain-in-English: plain-language view of safeword artifacts/state     | intake            |
| **PHATHE** | Catch-me-up: on-demand session recap (where you are + what's next)      | intake            |
| **PV5K6D** | Embed brainstorm + elicit at the right workflow points (ties to ZBVGPF) | intake            |
| **Z4Q24Q** | Model-tier policy: opus / sonnet / fable per task                       | intake            |

**B — Sharpen the audit surface**

| ID         | Title                                                                   | State             |
| ---------- | ----------------------------------------------------------------------- | ----------------- |
| **263422** | Pull dependency-freshness out of audit, delegate to Dependabot — or not | intake (decision) |

**C — Harden the surfaces** (output legibility + robustness)

| ID         | Title                                                                          | State              |
| ---------- | ------------------------------------------------------------------------------ | ------------------ |
| **469YSR** | Styled output orphans its glyph on a leading-newline message                   | task (build-ready) |
| **3293WH** | Auto-run health verification after setup/upgrade; demote `check`               | intake (feature)   |
| **ZRXM6Q** | Render ticket references slug-first (slug + ID locator) across hooks/CLI/INDEX | ✅ done            |

## Cross-cutting threads (why one epic)

- **`audit` is the pivot.** [263422](../263422-audit-deps-vs-dependabot/ticket.md) trims it, [9BDDGP](../9BDDGP-dynamic-workflows-for-safeword/ticket.md) wants it re-architected into a fan-out workflow, [C2F601](../C2F601-absorb-claude-skills/ticket.md) weighs it against Claude's `code-review` ultra. **Settle audit's target shape once, jointly** — trimming then re-architecting is rework.
- **469YSR → 3293WH.** Self-verify surfaces `check`'s output _inside_ setup/upgrade, so the orphaned-glyph fix lands first or together.
- **figure-it-out ↔ deep-research.** [ZBVGPF](../ZBVGPF-embed-figure-it-out/ticket.md), [C2F601](../C2F601-absorb-claude-skills/ticket.md), and [9BDDGP](../9BDDGP-dynamic-workflows-for-safeword/ticket.md) all touch the same research/decision machinery; coordinate so they converge, not triplicate.
- **Dogfood loop.** Resolving 263422 calls for a figure-it-out pass — which ZBVGPF is about embedding. The epic eats its own cooking.

## Sequencing

1. **[469YSR] now** — leaf dependency; unblocks clean self-verify output → then **[3293WH]**.
2. **Decide `audit`'s shape jointly** ([263422] + [9BDDGP] + [C2F601]) **before** executing any audit edit.
3. **Research spikes** ([C2F601], [9BDDGP]) inform [ZBVGPF] and [NTT094]; run them before committing those designs.

Only 469YSR (and then 3293WH) are concrete build today; the rest are intake/research and want a `/figure-it-out` or spec pass before implementation.

## Out of scope

- The stale-package-from-memory fix (add-time version check in SAFEWORD.md "Authority") — flagged in [263422](../263422-audit-deps-vs-dependabot/ticket.md) as a separate small patch, not part of this epic.

## Settled

- **Name** (user-delegated): "Absorb Claude's platform advances and harden safeword's surfaces." Slug/folder `platform-uplift-epic` retained — renaming would churn 7 `parent:` refs for no gain.
- **One epic, not split:** the CLI-hardening pair (469YSR + 3293WH) stays in this epic per repeated direction; revisit only if the slate grows. (Real design questions live in the child tickets, not here.)

## Work Log

- 2026-06-06T21:18:25.265Z Started: Created epic VKNF1T.
- 2026-06-06T21:19:00Z Pulled this session's 7 tickets under VKNF1T (per user). Matched the active-epic shape (TT1MQW): `status: open`, `epic:` key, `## Tickets` table, children linked via `parent:`. Organized into 3 clusters (absorb-Claude / sharpen-audit / harden-CLI) and recorded the cross-cutting couplings — audit-is-the-pivot (263422+9BDDGP+C2F601), 469YSR→3293WH, figure-it-out↔deep-research. Each child's frontmatter gets `parent: VKNF1T-platform-uplift-epic`. Name + one-epic-vs-split left open.
- 2026-06-06T22:47:00Z Name committed (user delegated the call): "Absorb Claude's platform advances and harden safeword's surfaces" — kept the descriptive H1, retained slug `platform-uplift-epic` (folder rename = needless churn across 7 parent refs). One-epic decision affirmed; both epic-level open questions closed → moved to ## Settled.
- 2026-06-06T23:02:00Z 8th child added: ZRXM6Q (render ticket refs slug-first) from a /figure-it-out pass on "make this better for customers." Relabeled cluster C "Harden the CLI" → "Harden the surfaces" since it now spans hook/CLI/INDEX output, not just CLI. ZRXM6Q supersedes the earlier ticket-reference-style routing question.

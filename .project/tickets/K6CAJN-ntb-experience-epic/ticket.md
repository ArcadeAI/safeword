---
id: K6CAJN
slug: ntb-experience-epic
type: epic
phase: done
status: done
created: 2026-06-21T14:24:00Z
last_modified: 2026-06-23T06:24:00Z
children: [QQJK5S, UJSZXB, KRUEWC, 5XOUDJ, 19E2XQ, DC6276, O3OG0N, B6J2TY, AV3PYY, JZQ85C]
---

# Epic: Make safeword legible to the Non-Technical Builder

**Goal:** Close the gaps where safeword speaks to the Non-Technical Builder (NTB) in raw jargon — across the CLI terminal, first-run runtime checks, gate blocks, and the framing rules that govern translation — so a user who can't read the diff always gets a plain-language explanation and a concrete next action.

**Why:** `personas.md` names the NTB as "likely the larger audience" and the place where "safeword's value is highest," yet the full audit (`PRODUCT-AUDIT-ntb.md`, 2026-06-21) found the product's most-read framing rule assumes a developer, and the least-mediated surfaces (terminal CLI, bun/dependency preflight) are the ones an NTB hits first. These findings are coupled — H1 governs every block the agent relays, so it gates the value of the rest — which is why they track as one initiative rather than six loose tickets.

**Source:** `PRODUCT-AUDIT-ntb.md` (findings-only audit on this branch). Each child cites the audit finding it closes.

## Children (priority order)

| ID         | Sev | Title                                                                                              |
| ---------- | --- | -------------------------------------------------------------------------------------------------- |
| **QQJK5S** | H1  | Make the "Talking to the user" plainness contract persona-aware                                    |
| **UJSZXB** | H2  | Humanize first-run runtime/dependency failures (bun, deps-not-installed)                           |
| **KRUEWC** | H3  | De-jargon the interactive CLI; auto-default the namespace-move prompt                              |
| **5XOUDJ** | M1  | Surface `/explain` to the NTB (README + proactive-offer rule)                                      |
| **19E2XQ** | M1+ | Make the `/explain` block-hint reliably reach the user — Claude systemMessage (5XOUDJ fast-follow) |
| **DC6276** | M1+ | Ship `/explain` to Cursor — the command doesn't exist there at all                                 |
| **O3OG0N** | M2  | Add an NTB front door — "driving safeword without reading code"                                    |
| **B6J2TY** | M3  | Confirm the agent strips verdict/phase jargon; gloss CONFIDENT/BLOCKED                             |

## Out of scope

- Re-litigating the prior language-axis audit (`PRODUCT-AUDIT-leakage.md`) — separate concern.
- The `/explain` gate-pointer (already shipped: ZCYD5P / NTT094). M1 is about _discovery_, not the pointer.

## Work Log

- 2026-06-21T14:24:00Z Created: Epic + 6 children from PRODUCT-AUDIT-ntb.md findings (H1-H3, M1-M3).
- 2026-06-21T17:48:00Z QQJK5S (H1) shipped + closed — plainness contract now threads NTB+TB.
- 2026-06-21T20:04:00Z Added 19E2XQ (M1+) — the `/explain` block-hint reliability fix, split from 5XOUDJ per its figure-it-out. 7 children now.
- 2026-06-21T20:07:00Z 5XOUDJ (M1) shipped + closed — `/explain` in README + offer-on-confusion rule.
- 2026-06-22T03:46:00Z Cross-agent figure-it-out: scoped 19E2XQ to Claude `systemMessage` (Codex already covered via stderr), and added DC6276 (M1+) — ship `/explain` to Cursor, which lacks it entirely. 8 children now.
- 2026-06-23T06:24:00Z Epic complete — 8/8 children done (QQJK5S, 5XOUDJ, 19E2XQ, DC6276, UJSZXB, KRUEWC, O3OG0N, B6J2TY). Every PRODUCT-AUDIT-ntb.md finding (H1-H3, M1-M3) closed, plus two cross-agent fast-follows (19E2XQ, DC6276).
- 2026-06-24T02:21:00Z Post-epic follow-ups linked: AV3PYY (namespace default-Yes, shipped) and JZQ85C (LOW jargon surfaces, backlog).

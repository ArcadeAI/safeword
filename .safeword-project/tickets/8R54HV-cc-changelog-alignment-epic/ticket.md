---
id: 8R54HV
slug: cc-changelog-alignment-epic
type: feature
phase: intake
status: open
epic: cc-changelog-alignment
created: 2026-05-31T21:05:09.533Z
last_modified: 2026-05-31T21:05:09.533Z
---

# Epic: Claude Code changelog alignment (Mar-May 2026)

**Goal:** Realign safeword's hooks and skills with Claude Code behavior changes and new primitives shipped in CC `2.1.117`–`2.1.159` (~Mar–May 2026).

**Why:** Safeword's entire value is hook-enforced gates. A CC change to hook lifecycle can silently weaken a gate (the done gate is now bypassable), and several new CC primitives (`reloadSkills`, `disallowed-tools`, `context: fork`, `effort:`) let safeword do its job with less friction and less blast radius.

## Context

Reviewed the CC changelog from `2.1.117` through `2.1.159` against the installed safeword machinery (`.safeword/hooks/`, `.claude/skills/`, `.claude/settings.json`). Safeword is built against CC `0.39.x`-era plugin conventions; there is no recorded `claude-code-version` baseline yet — ticket **116** owns establishing that tracking and is the umbrella for this review. This epic captures the actionable findings.

Source: `https://raw.githubusercontent.com/anthropics/claude-code/main/CHANGELOG.md`.

## Tickets

| ID         | Title                                                            | Tier              | Depends on |
| ---------- | ---------------------------------------------------------------- | ----------------- | ---------- |
| **EKNEW0** | Done gate no longer hard-blocks under Stop-hook 8-block cap      | 1 — breaks        | —          |
| **WQQGVV** | Verify `if:` hook conditions still fire (git-bare-fix)           | 1 — breaks        | —          |
| **625HVK** | Detect disabled/managed-only hooks; warn gates are inactive      | 1 — breaks        | —          |
| **5ARWDG** | Verify per-turn reminders land under lean system prompt default  | 1 — watch         | —          |
| **Z10A9Q** | Emit `reloadSkills:true` from setup/upgrade SessionStart         | 2 — adopt         | —          |
| **XXX66G** | Lock read-only review skills with `disallowed-tools`             | 2 — adopt         | —          |
| **9V9DVF** | Run heavy skills in forked context (`context: fork`)             | 2 — adopt         | —          |
| **0QTXMB** | Per-skill `effort:` frontmatter + `$CLAUDE_EFFORT` gate scaling  | 2 — adopt         | —          |
| **TDYPR0** | `sessionTitle`, `args` exec form, `updatedToolOutput`, validate  | 2 — adopt (minor) | —          |
| **X4518B** | Position review skills vs native `/code-review`, `/simplify`     | 3 — strategic     | —          |

## Sequencing

1. **Tier 1 first** — EKNEW0 (done gate) is the only one that breaks a stated guarantee; WQQGVV and 625HVK are correctness/visibility of existing gates. 5ARWDG is a verification spike.
2. **Tier 2 next** — independent, mostly mechanical adopts. Z10A9Q and XXX66G are the fastest wins.
3. **Tier 3 last** — X4518B is a positioning decision that may reshape the Tier 2 skill work (if we delegate to native review, fewer skills to harden).

## Related

- Ticket **116** — establishes `claude-code-version` baseline tracking + the recurring review process this epic feeds.
- Ticket **107** — earlier new-hook-events work; check for overlap before implementing TDYPR0.

## Work Log

- 2026-05-31T21:05:09.533Z Started: Created ticket 8R54HV
- 2026-05-31 Reviewed CC 2.1.117–2.1.159; filed 10 child tickets grouped into 3 tiers.

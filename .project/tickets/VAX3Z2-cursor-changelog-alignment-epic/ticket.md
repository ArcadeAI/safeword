---
id: VAX3Z2
slug: cursor-changelog-alignment-epic
type: feature
phase: intake
status: open
epic: cursor-changelog-alignment
created: 2026-05-31T21:09:47.366Z
last_modified: 2026-05-31T21:53:21.000Z
---

# Epic: Cursor changelog + docs alignment

**Goal:** Restore real enforcement to safeword's Cursor integration — it currently relies on the two _non-blocking_ hook events — and pick up the blocking chokepoints + distribution path Cursor now offers.

**Why:** Safeword's value is enforced gates. Research (2026-05-31) found safeword's Cursor hooks (`afterFileEdit`, `stop`) are **both observe-only**, so on Cursor the gates are effectively advisory. Cursor exposes genuinely-blocking events safeword isn't using.

## Headline finding: current Cursor gates don't block

`.cursor/hooks.json` wires `afterFileEdit` (observe-only) and `stop` (observe-only — can only nudge via `followup_message`). Neither can deny an action. Safeword's phase/LOC/done gates therefore do **not** enforce on Cursor the way they do on Claude Code.

## Hook lifecycle (what can actually block)

| Event                                                     | Blocks?                                                   | Safeword use                                           |
| --------------------------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------ |
| `beforeSubmitPrompt`                                      | **Yes** (`continue:false`)                                | turn-start gate + phase reminder — the real chokepoint |
| `preToolUse`                                              | **Yes** (deny)                                            | phase gate (no edit before `test-definitions.md`)      |
| `beforeShellExecution`                                    | **Yes** (allow/deny/ask)                                  | LOC/commit gate, dangerous-command policy              |
| `beforeReadFile` / `beforeMCPExecution` / `subagentStart` | **Yes** (deny)                                            | optional policy / govern parallel subagents            |
| `sessionStart`                                            | No (inject `additional_context`+`env`)                    | bootstrap SAFEWORD context                             |
| `afterFileEdit` / `postToolUse`                           | No                                                        | observe-only (**what we use today**)                   |
| `stop` / `subagentStop`                                   | No (nudge via `followup_message`, `loop_limit` default 5) | done gate **cannot block** here                        |

## Open questions — answered

**(a) Stop-hook block-cap analogue?** Different mechanism. Cursor's `stop` _cannot block at all_ — it only returns `followup_message` to auto-continue, capped by `loop_limit` (default 5, `null` = unlimited). The genuinely-blocking hooks have **no documented cap on consecutive denials**. Implication: safeword's done gate can't be enforced at `stop` on Cursor; it degrades to nudging (ticket AKNWZK).

**(b) Events to wire beyond afterFileEdit/stop?** Yes — we're using the two weakest. Add `beforeSubmitPrompt`, `sessionStart`, `beforeShellExecution`, `preToolUse` (tickets F2TKR3, RBZR3F, T3DV1K).

## Changelog findings (Jan–May 2026)

- **2.4 (Jan 22)** — introduced `stop` + `beforeSubmitPrompt`; Claude Code hook compatibility in CLI; hook commands 40x faster start. _Adopt_ (foundation).
- **2.4** — Agent **Skills** (`SKILL.md`) + `/migrate-to-skills` converts rules **and commands**. _Watch_ — `.cursor/commands/*.md` is now the legacy surface.
- **3.0 (Apr 2)** — fixed multi-root workspaces reading hook files from _all_ folders (was: first only). _Breaks (latent)_ on <3.0.
- **3.0** — enterprise third-party plugin imports default **off**. _Breaks (enterprise)_ for plugin distribution.
- **May 1 — Team Marketplace / Plugins** bundle hooks+skills+subagents+rules+MCP; install modes Default-Off / Default-On / **Required**. _Adopt_ — clean distribution + "Required" = enforcement posture (ticket DXYKJX).
- **3.6 (May 29)** — **Auto-review Run Mode**: classifier subagent auto-approves Shell/MCP/Fetch calls. _Breaks (verify)_ — could race hook deny (ticket TDX8NT).
- Cursor SDK (Apr 29), `/loop` skill + Automations (3.5), Context Usage Breakdown (3.3). _Watch_.

**Research gap:** Feb–Mar 2026 changelog entries weren't retrievable (history bottoms out ~Apr 8 on reachable pages). Default failure mode for hooks is **fail-open** (ticket ANAXG4).

## Sources

cursor.com/docs/hooks(.md), /docs/context/rules, /docs/context/commands, cursor.com/changelog (+ /page/2-4, /changelog/3-0, /2-4), cursor.com/blog/hooks-partners.

## Tickets

| ID         | Title                                                              | Tier                |
| ---------- | ------------------------------------------------------------------ | ------------------- |
| **F2TKR3** | Wire `beforeSubmitPrompt` turn-start blocking gate                 | restore enforcement |
| **RBZR3F** | Add `sessionStart` context injection                               | restore enforcement |
| **T3DV1K** | Port phase/LOC gates to `preToolUse` + `beforeShellExecution` deny | restore enforcement |
| **AKNWZK** | Re-architect done/stop gate (stop can't block)                     | correctness         |
| **ANAXG4** | `failClosed:true` on gating hooks (default fail-open)              | correctness         |
| **TDX8NT** | Verify deny wins over Auto-review Run Mode (3.6)                   | watch/verify        |
| **DXYKJX** | Package as Team-Marketplace plugin (Required mode)                 | distribution        |

## Sequencing

F2TKR3 / RBZR3F / T3DV1K first — they close the silent gate gap. ANAXG4 ships alongside (one-line per-hook flag). AKNWZK documents the unavoidable Cursor limitation. TDX8NT + DXYKJX after the gates work.

## Related

Epic **8R54HV** (Claude Code) — reuse gate logic; note Cursor's `stop` can't block (unlike CC), so the done gate diverges. Ticket **116** — `cursor-version` baseline.

## Work Log

- 2026-05-31T21:09:47.366Z Started: Created ticket VAX3Z2
- 2026-05-31 Placeholder created; Cursor integration confirmed present.
- 2026-05-31 Researched Cursor hooks/rules/commands/changelog (live docs). Found current gates non-blocking; filed 7 child tickets.

---
id: VAX3Z2
slug: cursor-changelog-alignment-epic
type: feature
phase: intake
status: open
epic: cursor-optimization
created: 2026-05-31T21:09:47.366Z
last_modified: 2026-06-24T04:30:00Z
---

# Epic: Cursor optimization

_(originally "Cursor changelog + docs alignment"; broadened 2026-06-24 to the single home for all Cursor work, and the epic key renamed `cursor-changelog-alignment` → `cursor-optimization` across all children. Id `VAX3Z2` and the ticket directory slug are unchanged.)_

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

Core children (own the `cursor-optimization` epic key). Status revalidated 2026-06-24, refreshed again against current Cursor docs on 2026-06-24 after P9K783:

| ID         | Title                                                              | Tier                | Status           |
| ---------- | ------------------------------------------------------------------ | ------------------- | ---------------- |
| **RBZR3F** | Add `sessionStart` context injection                               | restore enforcement | ✅ done          |
| **151**    | Migrate four Cursor rules to `@reference` pattern                  | drift/parity        | ✅ done (folded) |
| **F2TKR3** | Wire `beforeSubmitPrompt` turn-start blocking gate                 | restore enforcement | ready to close (rejected; no hook ships) |
| **T3DV1K** | Port phase/LOC gates to `preToolUse` + `beforeShellExecution` deny | restore enforcement | ready to close |
| **ANAXG4** | `failClosed:true` on gating hooks (default fail-open)              | correctness         | ready to close |
| **AKNWZK** | Re-architect done/stop gate (stop can't block)                     | correctness         | ready to close |
| **P9K783** | Harden Cursor done-gate close-detection (verify payload fields)    | correctness         | PR #424 open |
| **TDX8NT** | Verify deny wins over Auto-review Run Mode (3.6)                   | watch/verify        | open (Shell-only) |
| **JFBFEP** | Add an action-based MCP safety gate for Cursor                     | correctness         | open             |
| **DXYKJX** | Package as Team-Marketplace plugin (Required mode)                 | distribution        | open             |

### Cross-epic Cursor work (soft-linked, not re-parented)

These are Cursor-specific deliverables whose natural home is a cross-agent epic. They keep their parent and carry `relates_to: VAX3Z2`, so this epic indexes all Cursor work without orphaning them from their Claude+Cursor+Codex coordination.

| ID         | Title                                           | Home epic                | Status      |
| ---------- | ----------------------------------------------- | ------------------------ | ----------- |
| **1833FW** | Keep Cursor verify evidence aligned             | agent-surface-refactor   | in_progress |
| **F1HTQ4** | Generate Cursor command/rule wrappers from meta | agent-surface-refactor   | in_progress |
| **Y6HZR7** | Auto-upgrade under Cursor                       | auto-upgrade-cross-agent | blocked     |

## Sequencing

Remaining sequencing: land P9K783 (#424), then empirically verify `TDX8NT` for Shell deny precedence under Auto-review. Design/build `JFBFEP` before letting `DXYKJX` bundle MCP defaults; plugin packaging can proceed in parallel for non-MCP surfaces.

## Related

Epic **8R54HV** (Claude Code) — reuse gate logic; note Cursor's `stop` can't block (unlike CC), so the done gate diverges. Ticket **116** — `cursor-version` baseline.

## Work Log

- 2026-05-31T21:09:47.366Z Started: Created ticket VAX3Z2
- 2026-05-31 Placeholder created; Cursor integration confirmed present.
- 2026-05-31 Researched Cursor hooks/rules/commands/changelog (live docs). Found current gates non-blocking; filed 7 child tickets.
- 2026-06-16 Gap noted (from FJKM4X): guides loaded via `.safeword/guides/` tell agents to "call `/figure-it-out`" — a literal slash command in Claude Code. In Cursor, `safeword-figure-it-out.mdc` already uses the `@reference` pattern correctly, but it has `alwaysApply: false` and activates by description match, not by explicit invocation from guide text. There is no direct bridge from "guide says call figure-it-out" to "MDC rule loads the procedure." In practice the context conditions overlap so the rule likely activates correctly, but it is not mechanically guaranteed the way Claude Code's slash command invocation is. Consider: (a) `alwaysApply: true` for figure-it-out.mdc since it's always relevant when a design choice surfaces, or (b) a guide-aware rule activation mechanism if Cursor exposes one.
- 2026-06-24 **Consolidated all Cursor work under this epic + revalidated; broadened title to "Cursor optimization."** Checked GitHub issues — no Cursor epic exists there (ticket-system-only); only tangential open issues are #292 (Claude Code plugin spike) and #19 (MCP-in-plugin), nothing to fold. Folded pure-Cursor **151** (rules → `@reference`) in as a core child. Soft-linked three cross-agent Cursor tickets via `relates_to` without re-parenting: **1833FW**, **F1HTQ4** (agent-surface-refactor), **Y6HZR7** (auto-upgrade-cross-agent). **Revalidation against live code closed two as done:** RBZR3F (`sessionStart` already wired in `.cursor/hooks.json` → `session-safeword-context.ts`, emits `additional_context` for cursor) and 151 (the four rules are already 6-line `@reference` pointers; structural `checkCursorRulesThin` guard live; status was just never flipped). Remaining open children re-verified as still needed: F2TKR3/T3DV1K (`beforeSubmitPrompt`/`preToolUse`/`beforeShellExecution` not wired in `.cursor/hooks.json`), ANAXG4 (no `failClosed` anywhere), AKNWZK (done-gate rearchitect still pending — note: the `followup_message` nudge mechanism already exists in `cursor/stop.ts` for quality-review, useful precedent), TDX8NT + DXYKJX (unstarted). No duplicate tickets found; 151↔G1A6BS cover disjoint rule sets.
- 2026-06-24 `/quality-review` + `/figure-it-out` refresh after P9K783: current Cursor docs confirm the implemented hook shape (`preToolUse`, `beforeShellExecution`, `failClosed`, stop `loop_limit`) and current plugin shape (`.cursor-plugin/plugin.json`, hooks/MCP bundling, Team Marketplace Required/Optional). Marked F2TKR3/T3DV1K/ANAXG4/AKNWZK as ready to close in this index pending explicit close confirmation; P9K783 is PR #424. Split MCP out of TDX8NT into new ticket JFBFEP because safeword has no `beforeMCPExecution` gate today and Arcade should use an action-based MCP policy instead of blocking MCP wholesale.

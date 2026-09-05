---
id: G2E72G
slug: afk-mode
type: feature
phase: intake
status: in_progress
product_plan_contract: v1
created: 2026-05-23T19:15:19.361Z
last_modified: 2026-09-05T00:14:00.000Z
scope:
  - "M1 - denylist enforced at a blockable lifecycle boundary (PreToolUse), mirroring reviewGate's config plumbing in pre-tool-quality.ts; never skill prose"
  - "M1 - initial denylist: history rewrite or force-push, branch delete or reset --hard, external messages (email/Slack/etc.), file deletion outside the ticket folder, marking a ticket done, touching production config or secrets"
  - "M1 - hard gates (LOC commit, done gate, verify artifact) demonstrably unchanged under AFK"
  - "M2 - /afk slash command toggling the mode on the active ticket; clear error when no ticket is active"
  - "M2 - per-user safeword config default so the mode can be opted into globally"
  - "M2 - pause classification: routine confirmation auto-continues; genuine fork routes to /figure-it-out"
  - "M2 - work-log recording - forks carry question/options/pick/rationale; auto-continues carry a one-line reason (classification-drift detector)"
  - "M2 - fork resolution that errors or times out halts and asks (fail closed)"
  - "M2 - mode visibility in two independent places - ticket state plus a session announcement"
  - "M3 - rename shipped YOLO prose to AFK across templates, .claude, plugin, codex-plugin, and the two tests asserting it; parity enforced by test"
out_of_scope:
  - Session-level or env-var activation (SAFEWORD_AFK=1)
  - Project-level config (per-user only for v1)
  - Auto-creating a ticket when /afk runs without one
  - Time-boxed activation (--afk 30m)
  - Gradient autonomy levels (light/standard/reckless)
  - AFK auto-marking a ticket done (human still confirms)
  - Separate decisions artifact - decisions log inline in the work log instead
  - Cost ceiling enforcement (deferred to v2)
  - Any tool-permission bypass - AFK removes deliberative pauses, never tool confirmations
done_when:
  - A denylisted action under AFK is blocked by a hook, not by guidance, and the block survives an agent that tries to reason past it
  - Hard gates (LOC, done, verify) fire identically with AFK on and off
  - User can run /afk on a ticket to flip the mode, observable in ticket state; /afk with no active ticket returns a clear error
  - User can set a per-user config default, and a run active by default announces itself rather than starting silently
  - An AFK-marked two-way-door ticket reaches verify with no user turns except denylist stops and hard gates
  - Every resolved fork lands in the work log with question, options considered, pick, and rationale; every auto-continue lands with its one-line reason
  - A fork resolution that errors or times out halts and asks instead of proceeding on a default
  - No shipped surface on any of the three hosts describes autonomy the mechanism does not implement
---

# AFK mode: finish a ticket unattended and leave a decision trail

**Goal:** Let a builder hand off a bounded ticket and walk away, and come back to finished work plus a decision trail they can audit — with anything irreversible still waiting for them.

**Why:** Today the agent stops on every Clarify question, design pick, or mid-build ambiguity. For a builder who wants a hands-off run (overnight, batch tickets, low-stakes work), each pause is a stall with nobody there to answer it. The deeper prompt is drift already shipped: three template surfaces and two tests describe a mode that `packages/cli/src/` never implemented, and six tickets treat it as a premise.

## Behavior

AFK does not remove pauses; it sorts them. Three classes:

| Class                | Recognized by                                           | Behavior                                                             |
| -------------------- | ------------------------------------------------------- | -------------------------------------------------------------------- |
| Routine confirmation | artifact drafted, agent already holds the answer         | continue; log one line naming why it was routine                     |
| Genuine fork         | the outcome depends on the answer                        | resolve via `/figure-it-out`; log question, options, pick, rationale |
| Irreversible         | on the denylist                                          | halt for explicit human confirmation, enforced by hook               |

The classification is the feature. One mechanism for all three either wastes research proving the builder wanted to continue, or turns real decisions into unrecorded coin flips.

**Hard gates still fire:** LOC commit gate, done gate, verify artifact. AFK removes deliberative pauses, not protective ones.

**Not a permission bypass:** every tool confirmation an attended session would show, an AFK session still shows. This is the opposite of what "YOLO mode" means in Claude Code and Cursor, which is why the name changed.

## Activation

- **Per-user config** (per-user, not per-project; exact location settled during plan-implementation): sets the default. Because a saved default can leave the mode on without the builder choosing it this session, an AFK run announces itself at the start.
- **`/afk` slash command**: per-ticket toggle, written to the active ticket's state. Errors clearly if no ticket is active.

## Deferred (not in v1)

- **Cost ceiling** — fork resolution does real research and burns tokens. Routing means it fires only on genuine forks, which are rare in a bounded ticket, so v1 ships without a cap and we measure. Tracked for v2.

## Resolved Open Questions

1. Activation → per-user config + `/afk` slash. ✅
2. Interception → **routed by pause class**, not intercept-everything (supersedes the May answer). ✅
3. Auto-progression → human still confirms done. ✅
4. Audit format → inline in ticket work log, forks and auto-continues both. ✅
5. Risky-action carveout → denylist, enforced at a blockable hook boundary rather than in prose. ✅
6. Naming → `/afk`; "YOLO" means tool-permission bypass everywhere else in the ecosystem. ✅
7. Cost ceiling → deferred to v2.
8. Fork-resolution failure mode → **fail closed**: halt and ask, never proceed on a default. ✅

## Work Log

- 2026-05-23T19:15:19.361Z Started: Created ticket G2E72G
- 2026-05-23T19:15:30.000Z Drafted intake: sketch + 8 open questions
- 2026-05-24T05:07:00.000Z Clarify complete: scope/out_of_scope/done_when bounded. 6 opens resolved, 2 deferred (cost ceiling → v2; /figure-it-out failure mode → BDD). Advancing to define-behavior.
- 2026-09-04T15:58:00.000Z Intake re-opened. Ticket sat at define-behavior since 2026-05-24 with no spec.md, while YOLO prose shipped into DISCOVERY.md, cold-start-check.md and their mirrors and two tests began asserting that prose. Reset to `phase: intake`, adopted `product_plan_contract: v1`, authored Product Bet + 4 JTBD (TBU1-3, SWM1) in spec.md. Surfaced the central fork: shipped docs say gates *auto-confirm*, the ticket says every pause routes through `/figure-it-out` — two different products wearing one name. Awaiting confirmation on unit 1.
- 2026-09-04T15:59:04.919Z Phase: define-behavior → intake
- 2026-09-05T00:14:00.000Z Intake complete. `/figure-it-out` on naming → **`/afk` accepted by alex**; ticket renamed `yolo-mode` → `afk-mode` (dir, slug, INDEX entry, title) before scenario lineage could lock in the dead name. Evidence: IIHS found names that overstate autonomy drive overtrust (48% believed hands-off-wheel safe under "Autopilot" vs ≤33% elsewhere), so the name describes the builder's situation rather than the agent's capability; AFK is the established term for this exact pattern in AI-coding vocabulary; "YOLO" means tool-permission bypass in Claude Code and Cursor, the inverse of what this mode does. Mode-error literature (Sarter & Woods; NN/g) added TBU3.R4 — a config-default mode is an uncommanded mode change, so it needs two independent indicators. Authored full Product Plan: 4 jobs, 10 Rules, 3 milestones (M1 protective floor before any autonomy switch exists; M2 unattended runs with a decision trail; M3 one contract across hosts), and Killer Demo. Rewrote engineering scope against Option C — note out_of_scope's old "never fall back to asking" line is **reversed** by TBU3.R3.
- 2026-09-05T00:06:00.000Z `/figure-it-out` on the central fork → **Option C accepted by alex**: route each pause by class rather than one mechanism for all. Confirmations auto-confirm with a one-line reason; genuine forks route to `/figure-it-out` and log question/options/pick/rationale; irreversible actions escalate, enforced by a PreToolUse hook rather than skill prose (Principle 1 — prose is tier-4 self-report; Cursor ships the analogous classifier and states plainly it is not a security boundary). Evidence: SAGE-Agent/EVPI (ACL Findings 2026, arXiv 2511.08798) — targeting only decision-changing questions raised coverage 7-39% while cutting questions 1.5-2.7x; Cursor 3.6 auto-review (allowlist → sandbox → classifier) reports ~84% fewer prompts. Open question #8 (deferred in May) **resolved: fail closed** — when `/figure-it-out` errors or times out the run stops and asks, because the research call *is* the decision procedure; advisory checks (cold-start) fail open, decision procedures do not.

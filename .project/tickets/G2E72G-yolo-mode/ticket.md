---
id: G2E72G
slug: yolo-mode
type: feature
phase: define-behavior
status: superseded
created: 2026-05-23T19:15:19.361Z
last_modified: 2026-06-16T14:32:13.236Z
scope:
  - New /yolo slash command that toggles YOLO mode on/off for the active ticket
  - Per-user safeword config setting (default mode) so users can opt into YOLO globally
  - When YOLO active, intercept every would-be user prompt and route it through /figure-it-out
  - Auto-pick whatever /figure-it-out returns; log the decision (question, options, pick, rationale) inline in the ticket work log
  - Enforce a denylist of actions that always confirm with the user even under YOLO
  - Initial denylist - git push / push --force, branch delete or reset --hard, sending external messages (email/Slack/etc.), file deletion outside the ticket folder, marking ticket done, paid-API spend above a threshold, touching production config or secrets
  - /yolo with no active ticket errors clearly
  - Hard safeword gates (LOC commit, done gate, verify artifact) still fire under YOLO
out_of_scope:
  - Session-level or env-var activation (SAFEWORD_YOLO=1)
  - Project-level config (per-user only for v1)
  - Auto-creating a ticket when /yolo runs without one
  - Falling back to asking the user when /figure-it-out is inconclusive - we trust the output, pick the top result, log it
  - Time-boxed activation (--yolo 30m)
  - Gradient autonomy levels (light/standard/reckless)
  - YOLO auto-marking ticket done (human still confirms)
  - Separate yolo-decisions.md artifact - decisions log inline in work log instead
  - Cost ceiling enforcement (deferred to v2)
done_when:
  - User can run /yolo on a ticket to flip YOLO on or off, observable in ticket frontmatter
  - User can set per-user safeword config to make YOLO the default mode
  - A YOLO-marked ticket runs end-to-end without user prompts except for denylist items
  - Every autonomous decision lands in the ticket work log with question, options considered, pick, and rationale
  - Denylist items still prompt the user even under YOLO
  - /yolo invoked without an active ticket returns a clear error
  - Hard gates (LOC, done, verify) still trigger under YOLO
---

# YOLO mode: route user-feedback pauses through /figure-it-out

> **Superseded by [90AZDV](../90AZDV-configurable-hitl-autonomy/ticket.md)** (2026-06-16). 90AZDV generalizes this binary on/off mode into a per-axis gradient (the "gradient autonomy levels" this ticket explicitly deferred), adds project-level config with a non-committed personal override (this ticket was per-user only), and routes autonomous breakpoints through a context-loaded sub-agent rather than inline `/figure-it-out`. The denylist, inline decision-logging, hard-gates-still-fire rule, and the deferred `/figure-it-out` failure-mode question carry over to 90AZDV.

**Goal:** Give safeword an autonomous mode that resolves ambiguity via `/figure-it-out` instead of pausing for the user, so a ticket can run end-to-end with minimal human turns.

**Why:** Today the agent stops on every Clarify question, design pick, or mid-build ambiguity. For users who want hands-off runs (overnight, batch tickets, low-stakes work), each pause is friction. `/figure-it-out` already does evidence-based decision-making — YOLO wires it into the pause points.

## Behavior

When YOLO is active for a ticket, every point where the agent would normally hand control back to the user gets intercepted:

1. Restate the question internally.
2. Invoke `/figure-it-out` with the question and surrounding context.
3. Pick its top result, log the decision (question, options considered, pick, rationale) to the ticket work log.
4. Proceed as if the user had answered.

**Exceptions (denylist):** destructive or externally-visible actions still confirm with the user even under YOLO — see scope for the initial list.

**Hard gates still fire:** LOC commit gate, done gate, verify artifact. YOLO removes deliberative pauses, not protective ones.

## Activation

- **Per-user config** (safeword user config — exact location TBD during implement, but per-user not per-project): sets default mode. Users who want YOLO everywhere flip it once.
- **`/yolo` slash command**: per-ticket toggle. Writes `mode: yolo` (or removes it) on the active ticket's frontmatter. Errors if no active ticket.

## Deferred (not in v1)

- **Cost ceiling** — `/figure-it-out` does real research and burns tokens. v1 has no cap; we'll measure real usage first and add a ceiling if it bites. Tracked for v2.
- **Failure mode for `/figure-it-out` errors/timeouts** — needs a concrete answer (abort to user vs. retry vs. skip with default). Will be pinned during BDD scenario writing.

## Resolved Open Questions

1. Activation → per-user config + `/yolo` slash. ✅
2. Interception → everything except a denylist. ✅
3. Inconclusive `/figure-it-out` → trust the output, pick top result, log. ✅
4. Auto-progression → human still confirms done. ✅
5. Audit format → inline in ticket work log. ✅
6. Risky-action carveout → denylist enumerated above. ✅
7. Cost ceiling → deferred to v2.
8. `/figure-it-out` failure mode → pin during BDD.

## Work Log

- 2026-05-23T19:15:19.361Z Started: Created ticket G2E72G
- 2026-05-23T19:15:30.000Z Drafted intake: sketch + 8 open questions
- 2026-05-24T05:07:00.000Z Clarify complete: scope/out_of_scope/done_when bounded. 6 opens resolved, 2 deferred (cost ceiling → v2; /figure-it-out failure mode → BDD). Advancing to define-behavior.
- 2026-06-16T14:32:13.236Z Superseded by 90AZDV (configurable-hitl-autonomy) at user direction. 90AZDV absorbs the keepers (denylist, inline decision log, hard gates fire, no-active-ticket error, deferred failure-mode question) and generalizes the binary mode into a per-axis gradient with project+personal config and a sub-agent indirection. No further work here.

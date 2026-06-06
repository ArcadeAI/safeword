---
id: ZRXM6Q
slug: slug-first-ticket-refs
parent: VKNF1T-platform-uplift-epic
type: task
phase: implement
status: in_progress
created: 2026-06-06T23:01:40.214Z
last_modified: 2026-06-06T23:01:40.214Z
scope: |
  Make every safeword surface that names a ticket lead with the human slug
  (or title) and demote the Crockford ID to a trailing locator/link —
  `embed-figure-it-out (ZBVGPF)`, never bare `ZBVGPF`. The slug already lives
  in the folder name `<ID>-<slug>`, so this is a DISPLAY change, not a data
  change. Surfaces, in MVP order:
    1. Hook-injected context — the prompt-hook current-ticket line and the
       resume-check line (templates/hooks/**). Highest leverage: it's what
       makes the agent (and thus the customer's chat) speak in names.
    2. CLI output that names tickets — check, ticket-new confirmation,
       sync-tickets — and the generated INDEX.md / INDEX-completed.md.
    3. SAFEWORD.md "Talking to the user" — a one-line rule as the backstop.
  Ship via template sync + cursor/codex parity.
out_of_scope: |
  - Changing the ID scheme (Crockford Base32 stays — it's the collision-free
    locator for parallel sessions + git branches).
  - Renaming existing ticket folders (`<ID>-<slug>` is already correct).
  - The on-demand /explain capability — that's the explain-in-english ticket
    (NTT094), the pull-based complement, not this push-rendering default.
done_when: |
  - Hook-injected ticket references lead with the slug; the ID still appears
    as a trailing locator. Verified on a real prompt-hook + resume-check fire.
  - CLI output and INDEX.md lead with the slug; ID retained as locator/link.
  - A regression guard asserts the injection templates emit no bare-ID-led
    reference (test or lint).
  - SAFEWORD.md "Talking to the user" carries the slug-first rule.
  - Templates synced and cursor/codex parity holds.
  - `npx vitest run` for touched test files passes from packages/cli/.
---

# Render ticket references slug-first (slug + ID locator) across hooks, CLI, and INDEX

**Goal:** Every safeword surface that names a ticket leads with the human slug and demotes the Crockford ID to a trailing locator — starting with the hook-injected context that shapes how every agent (and every customer's chat) refers to work.

**Why:** Opaque IDs (`ZBVGPF`) force the reader to _recall_ what the code means; the slug (`embed-figure-it-out`) lets them _recognize_ it — and the slug is already sitting in the folder name. The root cause of agents talking in codes is that the hooks _feed_ them codes: fix the injection and the chat legibility fixes itself, for every customer, across Claude Code / Cursor / Codex — without depending on the model to remember a rule.

## Decision (figure-it-out, 2026-06-06)

Chose **fix the surfaces (render slug-first)** over two alternatives:

- **Convention only** (a SAFEWORD.md rule) — too soft. This session disproved it: the talk-plainly discipline already exists, yet the agent parroted IDs because the injected context led with IDs. A rule asks the model to recall-and-translate; it forgets.
- **On-demand `/explain`** (NTT094) — pull-based and heavier; doesn't fix the default surfaces. Kept as the complement for full-artifact explanation, not this fix.

**Evidence:** recognition-over-recall is [NN/g usability heuristic #6](https://www.nngroup.com/articles/recognition-and-recall/) (their part-number "ML-38" example is our "ZBVGPF" case); stable-ID-plus-human-slug is [documented best practice](https://cloud.google.com/blog/products/api-management/api-design-choosing-between-names-and-identifiers-in-urls) (safeword already stores both → display-only); issue trackers (Jira/Linear) always show the key _with_ the title, never the key alone.

## Open decisions (small — implementer's call, reversible)

- **Slug vs. full title in prose.** Lean: slug (compact, matches the folder name); fall back to title where a sentence needs the fuller phrase.
- **Exact format.** Lean: `slug (ID)` in plain text, `[slug](path)` where a link fits. Keep it one consistent shape across surfaces.
- **INDEX column order.** Lean: slug/title first column, ID second.

## Related

- Parent: [platform-uplift epic](../VKNF1T-platform-uplift-epic/ticket.md).
- [explain-in-english](../NTT094-explain-in-english/ticket.md) (NTT094) — the pull-based complement; same legibility theme, bigger and on-demand.
- Supersedes last turn's open "durable rule: new ticket vs. fold" routing question — this _is_ that ticket.
- Persisted agent-behavior half lives in memory (`feedback_ticket_reference_style`).

## Work Log

- 2026-06-06T23:01:40.214Z Started: Created ticket ZRXM6Q.
- 2026-06-06T23:02:00Z Framed from a /figure-it-out pass (user: "how do we make this better for safeword customers?"). Reframed as display-not-data — slug already in folder name. Recommended fixing the surfaces over convention-only (soft; this session disproved it) and over on-demand /explain (pull-based, heavier — stays NTT094). Highest-leverage surface = hook-injected context (root cause of agents speaking in codes). Sized task: cross-surface rendering change, shape decided, no new state/flows. scope/out_of_scope/done_when set; small format decisions left to the implementer. Parented under VKNF1T.
- 2026-06-06T23:12:00Z Picked up; phase intake→implement. Second /figure-it-out (code shape): map showed no shared formatter and no CLI↔hooks bridge; per-turn prompt hook injects no ticket ID (the bare codes came from CLI output + INDEX + compact-context). Decided: tiny `formatTicketRef(id, slug)→"slug (ID)"` in src/utils + a synced mirror in templates/hooks/lib (matches active-ticket.ts precedent); apply at ticket-new / check / INDEX / compact-context; add a slug-first active-ticket line to the prompt hook. Rejected import-from-templates (dependency inversion) and inline-per-site (drift). Format `slug (ID)`, slug not title.
- 2026-06-06T23:40:00Z CLI sites done (helper + ticket-new/INDEX/check, commit 943bc2e9). Generalized the helper's 2nd param to a human _label_ (slug or title) — most sites have the title, not the slug. Hooks: did compact-context (`Ticket: title (id)`), edited template + `.safeword` copy in lockstep (dogfood-direction guard requires both). **Deferred** the net-new per-turn prompt-questions active-ticket line: it's added injected behavior (not a reformat) with reinjection-noise risk (cf. QSNKBB) + folder→slug derivation — wants its own noise-calibration pass. Tracked as a follow-up, not dropped.

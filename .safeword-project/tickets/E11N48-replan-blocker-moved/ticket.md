---
id: E11N48
slug: replan-blocker-moved
parent: VKNF1T-platform-uplift-epic
type: task
phase: done
status: done
created: 2026-06-12T01:21:13.808Z
last_modified: 2026-06-12T01:21:13.808Z
scope: |
  Extend the replan-on-resume heads-up with a "blocker moved" advisory: when a
  ticket's `depends_on` target reached a terminal status (done / cancelled /
  superseded / wontfix) AND that target's ticket.md changed in the commit window
  since this ticket's last_modified, surface a distinct opt-in heads-up naming
  the blocker slug-first. Reuses the existing replan pipeline (commit window,
  HEAD-advance dedup, parseTicketIdList). Pure core: detectMovedBlockers +
  formatBlockerMovedHeadsUp in replan-relevance.ts; wrapper resolves depends_on
  → target status + ticket.md path in replan.ts. Template + dogfood byte-identical.
out_of_scope: |
  - Reopen detection (terminal → active) and true status-diffing across the
    window — v1 keys on "currently terminal AND ticket.md in window"; defer the
    precise transition diff (rare false positive: an edit to an already-done
    blocker, which is dismissible).
  - Firing on a blocker's CODE-scope file changes (option 3) — too noisy.
  - Firing on any blocker ticket.md edit regardless of status (option 2) —
    contradicts the tracker-validated "fire on resolution" signal.
  - Auto re-ordering / gating — advisory only, consistent with replan's design.
done_when: |
  - A ticket depends_on a target that is terminal and whose ticket.md changed in
    the window → evaluateReplan surfaces a slug-first "blocker is now done"
    heads-up.
  - A non-terminal target, or a terminal target whose ticket.md is NOT in the
    window, does not fire.
  - Composes with the existing path-relevance heads-up + HEAD-advance dedup.
  - Pure-core unit tests (detectMovedBlockers, formatBlockerMovedHeadsUp) +
    wrapper test; template ↔ dogfood byte-identical; full suite green.
---

# Replan blocker-moved advisory — depends_on target reached terminal status

**Goal:** When a ticket you depend on reaches a terminal status since you last touched this ticket, replan-on-resume warns the plan may be stale.

**Why:** AKZJXC made `depends_on` machine-readable but replan can't yet reason over it — a cleared blocker silently leaves a stale plan. Mature trackers (Linear, Jira) fire exactly on the blocker's resolution transition, not on arbitrary edits; this brings that signal to safeword's resume boundary.

## Work Log

- 2026-06-12T01:21:13.808Z Started: Created ticket E11N48
- 2026-06-12T01:25:00Z Fast-follow to AKZJXC. /figure-it-out on the trigger design — researched how Linear/Jira signal blocker changes: both key on the blocker's status TRANSITION TO RESOLVED (Linear logs history + flips the flag green on resolve/reopen; Jira teams automate on status→Resolved), never on arbitrary edits. Decided Option 1 (refined): fire when a depends_on target is CURRENTLY terminal (done/cancelled/superseded/wontfix) AND its ticket.md is in the commit window. Rejected Option 2 (any ticket.md touch — noisy work-log appends, contra the research) and Option 3 (code-scope files — over-broad). Detection stays simple (no status-at-boundary git-show); reopen + true-transition-diff deferred to v2. Reuses commit window + HEAD-dedup + parseTicketIdList. Pure core: detectMovedBlockers + formatBlockerMovedHeadsUp (no src/ imports — hooks are standalone, slug-first format inlined).

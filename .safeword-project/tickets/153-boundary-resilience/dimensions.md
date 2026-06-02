# Dimensions — Ticket 153: Replan-on-Resume (design B)

Re-derived 2026-06-02 after the `/figure-it-out` rescope. Epic-anchor hook + verify soft-prompt are **deferred**; this covers **replan-on-resume only**, with the relevance-filtered + tiered + opt-in trigger.

## Decisions baked in

| #   | Question                                  | Decision                                                                                                                                                                                                  | Rationale                                                                                                             |
| --- | ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| 1   | What is a "relevant" commit?              | Changed paths (`git diff --name-only`) intersect the ticket's referenced paths = (file-path-like tokens in `ticket.md`/`spec.md`/`test-definitions.md`) ∪ (files the ticket has already modified in git). | Combines the two cheap change-impact signals (textual + history) without a dependency graph; deterministic, zero-dep. |
| 2   | No path signal (names none, touched none) | Do not fire (silent).                                                                                                                                                                                     | For a drift-catcher a false negative is harmless (status quo); over-firing trains dismissal — bias quiet.             |
| 3   | How the user opts in                      | Concise heads-up at the resume boundary naming the relevant-commit count; one step to decline; investigation runs only on accept.                                                                         | Task-boundary + opt-in alleviates disruption (proactive-UX research).                                                 |
| 4   | `last_modified` update timing             | Once at replan-complete on every fired path (decline / accept-success / accept-failure).                                                                                                                  | Single update point; prevents re-debating the same commits.                                                           |
| 5   | Sub-agent failure                         | Silent fallback + stderr; `last_modified` still updates.                                                                                                                                                  | No indefinite re-debate loop.                                                                                         |
| 6   | Ticket-file mutation                      | Never auto; only on explicit user approval.                                                                                                                                                               | Output safety.                                                                                                        |
| 7   | Epic tickets                              | Never trigger (filtered upstream by `getActiveTicket()`).                                                                                                                                                 | You work sub-tickets, not epics.                                                                                      |

## Behavioral dimensions

| Dimension                     | Partitions                                                         |
| ----------------------------- | ------------------------------------------------------------------ |
| Active ticket type            | non-epic (eligible) / `epic` (excluded)                            |
| Commits since `last_modified` | 0 / ≥1                                                             |
| Relevance of commits          | none touch referenced paths / ≥1 touches                           |
| Path signal available         | yes (artifacts name paths, or ticket has touched files) / none     |
| User response to heads-up     | decline / accept                                                   |
| Sub-agent outcome (on accept) | report (still-good/change/cancel/split/merge) / failure-or-timeout |
| Ticket-file mutation          | none / explicit-approval-only                                      |

## Partitions → rules (see test-definitions.md)

- type × commits × relevance × path-signal → **Rule: fire only on relevant drift**
- user response → **Rule: opt-in; decline does no work**
- accept × outcome → **Rule: isolated proposal-only investigation** + **Rule: failure degrades safely**
- `last_modified` timing → **Rule: updates once at replan-complete**

## Invariant

- `templates/hooks/` ↔ `.safeword/hooks/` byte-identical (`diff -q`).

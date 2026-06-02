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

## Refinements (scenario-gate, 2026-06-02) — supersede the relevant rows above

- **Relevance denylist:** exclude high-churn manifests from the intersection — `package.json`, lockfiles (`*-lock.*`, `bun.lock`, `package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`), `tsconfig*.json`, `.gitignore`. (figure-it-out: static denylist over research-grade IDF.)
- **Commit query:** `git log --since=<last_modified>` (a timestamp can't be a `..HEAD` range ref).
- **Re-fire suppression (revised — supersedes decision 4 + the earlier bump-`last_modified` note):** the hook records the prompted HEAD sha in **session state** (`quality-state.json`, alongside `lastReviewed*`), NOT by bumping `last_modified`. `last_modified` is both the staleness baseline AND the active-ticket mtime ([active-ticket.ts:229](packages/cli/templates/hooks/lib/active-ticket.ts)) — bumping it on a prompt would corrupt active-ticket resolution. A new session has no marker → re-evaluates from `last_modified` (correct: fresh context re-anchors).
- **Trigger granularity:** fires when there are relevant commits since `last_modified` AND HEAD differs from the recorded prompted HEAD — so it doesn't re-fire every turn while HEAD is unchanged.
- **Architecture split:** hook = detection + relevance + heads-up injection + session-marker write (unit-tested). Agent = decide/decline, run the investigation sub-agent, proposal-safety, failure fallback (skill prose, live-verified).
- **Build order:** (1) ✓ pure relevance fn; (2) ✓ surface-decision fn + git-log parser + heads-up text; (3) ✓ git gathering (`git --since=<last_modified>`) + `extractReferencedPaths` + session-HEAD marker (`replanPromptedHead` on `QualityState`) + wire into `prompt-questions.ts` UserPromptSubmit hook + heads-up injection (`replan.ts` I/O shell, 6 integration tests); (4) ✓ skill prose in SAFEWORD.md ("Replan on resume").
- **Scope trim (implement):** the relevance signal ships as **textual-only** — `extractReferencedPaths` over the ticket's artifacts. Decision 1's "∪ files the ticket has touched" history signal is **deferred**: at the resume boundary the ticket has usually edited nothing yet (so the signal is empty exactly when replan matters most), and the only cheap proxy (`git log --grep=<id>`) risks the false positives this filter exists to suppress. No scenario requires touched-files _presence_ to fire, so the trim breaks nothing. Revisit if a real ticket misses relevant drift its prose didn't name.

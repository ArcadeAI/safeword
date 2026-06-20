---
id: 9E6Q4V
slug: staleness-check-vs-origin-main
type: task
phase: intake
status: in_progress
created: 2026-06-19T21:43:25.517Z
last_modified: 2026-06-19T21:44:00Z
---

# Staleness checks ignore origin/main divergence (miss upstream restructures)

**Goal:** Make safeword's staleness signals warn when `origin/main` has moved on — especially when upstream commits touch files the current branch/ticket is editing — not just when the branch's own commits have.

**Why:** A long-running worktree epic silently built obsolete work against a base that main had structurally changed; the divergence surfaced only via a manual `git fetch` at push time. That's a near-miss for a conflicting PR and real wasted effort.

## Evidence (this session, reasoning-skills epic B6MZ4Z)

- The branch ran **28 commits behind `origin/main`** while authoring 5-skill changes across ~8 commits.
- One of those upstream commits — `30459ff4` "refactor(cursor): migrate 4 fat rules to @reference pointers (ticket 151)" — **deleted the fat Cursor rules** (`safeword-debugging`, `safeword-quality-reviewing`, `safeword-refactoring`) and replaced them with `@`-reference stubs.
- This epic spent ~5 commits **hand-authoring condensed bodies in those exact Cursor files** (+ 2 review-fix commits on them) — all now obsolete; main had already migrated them away.
- safeword's **resume-check fired but on a local-only baseline** (verified: `.safeword/hooks/lib/replan-relevance.ts`): its window is "commits since the ticket's `last_modified`" on the **local branch**, filtered to **ticket-referenced paths** — so it counted this epic's own ~5 commits and never saw `origin/main`'s 28. (The file's own comment notes a history signal was _deliberately deferred_ — the local path-relevance scope is by design, not a bug.) It gave false reassurance; the structural collision was invisible to it.
- `parity-check` was green (157 pairs) throughout — correctly, since it checks the local tree, not upstream divergence. So no existing gate covered this.

## The gap

The replan/resume-check signal (`replan-relevance.ts`) is intentionally scoped to **local** commits (since `last_modified`) ∩ ticket-referenced paths. Nothing computes divergence vs `origin/main`, so there is no signal for "upstream has restructured files you're editing — integrate before continuing." This proposes an **adjacent** signal in that family, not a change to the existing path-relevance filter.

## Related (replan / resume-check family)

- `replan-relevance.ts` — ticket 153 (design B): the local path-relevance filter this would sit beside.
- [97BZ9S — figure-it-out-on-replan](../97BZ9S-figure-it-out-on-replan/ticket.md): the `/figure-it-out` re-decide offer appended to resume heads-ups.
- [E11N48 — replan-blocker-moved](../E11N48-replan-blocker-moved/ticket.md): a sibling resume signal (a depends-on blocker reached terminal) — precedent for adding a new signal to this surface.
- TT1MQW (upstream-changelog-monitor): a _different_ upstream — external tool changelogs, not git `origin/main`. Not a dup.

## Suggested direction (for intake — resist over-building)

- At session-start and/or the implement-phase gate: `git fetch` (or use already-fetched refs) and compute divergence vs `origin/main`.
- Warn when the branch is significantly behind **and** especially when upstream commits touch files the current ticket/branch is modifying (the high-signal case).
- Keep it a lightweight nudge ("behind N; upstream touched files X you're editing — integrate first"), not a hard block. Don't fetch on every prompt (cost/offline); a session-start or pre-implement check is enough.

## Decided approach (figure-it-out, 2026-06-20)

Revalidated against current `main` (post-#266): gap still open — no hook computes `origin/main` divergence; unclaimed; no duplicate. Key find: `session-start-reentry.ts` already warns (via `detectConflictFiles`) when **another local session** edited dirty files — 9E6Q4V is the **upstream axis** of that same pattern.

**Extend `session-start-reentry.ts` with a no-fetch upstream-divergence warning:**

- `detectUpstreamDivergence(projectRoot)` in `lib/re-entry`: `behind = git rev-list --count HEAD..origin/main` (LOCAL ref, **no fetch**); if `behind > 0`, intersect `git diff --name-only HEAD...origin/main` with (dirty files ∪ ticket-referenced paths) — reuse `replan-relevance`'s `relevantChangedPaths` for the overlap.
- Sibling `renderUpstreamWarning` line (additionalContext), nudge not block: "behind N as of last fetch; upstream touched files you're editing: X — `git fetch` + integrate first."
- **No fetch** (matches the SessionStart hook layer's no-I/O ethos + `replan-relevance` purity); the message owns ref-staleness by prompting `git fetch`.
- v1 = behind-count + overlap + fetch-prompt. Defer a secondary "origin/main ref mtime is old → fetch" trigger unless the never-fetch false-reassurance shows up.
- **Rejected:** new standalone hook (extra parity/schema wiring); fetch-on-session (network/offline/latency for marginal freshness).
- Ships cross-harness as a hook: `templates/hooks/` source + `.safeword/hooks/` dogfood + Codex parity; tests in `packages/cli/tests/hooks/`.

## Out of scope

- The condensed-Cursor-rule drift problem itself (a separate symptom) — ticket 151's `@`-reference migration already addresses that by eliminating duplicated bodies.

## Done when

- A staleness signal exists that accounts for `origin/main` divergence, foregrounding upstream changes to files the current work edits.
- It's a nudge, not a block; no per-prompt fetch.

## Work Log

- 2026-06-19 Filed from the reasoning-skills epic (B6MZ4Z) retro: discovered at push-time that the branch was 28 behind and main's ticket-151 Cursor migration had obsoleted this epic's condensed-Cursor work; the resume-check had only counted the branch's own commits. Captured as a process issue per user request.
- 2026-06-19 `/quality-review` (provenance gate, dogfooded): the central claim was filed as fact but only inferred — **verified** it against `.safeword/hooks/lib/replan-relevance.ts` (window = commits since `last_modified` on the local branch ∩ ticket-referenced paths; history signal deliberately deferred; no `origin/main` fetch). Upgraded the claim to `(verified)`, reframed as an _adjacent_ signal (not a bug in the path-relevance filter), and cross-linked the replan family (153 / 97BZ9S / E11N48; TT1MQW is a different upstream). No duplicate ticket found.
- 2026-06-20 Picked up post-#266-merge. Revalidated: gap still open on current `main` (no hook computes origin/main divergence; unclaimed; no dup). `/figure-it-out` → **decided approach** (see section above): extend `session-start-reentry.ts` (no-fetch, reuse `detectConflictFiles` pattern + `replan-relevance` filter), nudge not block. Web-research skip justified (internal hook design + in-repo precedent). Ready for implement.

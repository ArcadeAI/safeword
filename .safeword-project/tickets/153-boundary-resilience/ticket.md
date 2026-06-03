---
id: 153
type: feature
phase: done
status: done
created: 2026-05-18T06:12:00Z
last_modified: 2026-06-02T23:00:00Z
scope:
  - Replan-on-resume triggers at activeTicket transition to a non-epic ticket, but ONLY when commits since `last_modified` touch paths the ticket references (contextual relevance filter) — not "any commit" — to keep the alert-to-action ratio high
  - Tiered: a cheap inline triage runs first (relevant-path intersection + commit summary); escalate to a fresh sub-agent (`isolation: worktree`) investigation ONLY when drift is plausible; no relevant change → stay silent, no sub-agent spawned
  - On plausible drift, surface a concise opt-in heads-up at the resume boundary ("N relevant commits since this was planned — re-check?") rather than auto-running a mandatory investigation
  - Replan output is chat-only; ticket frontmatter/body changes only with explicit user approval
  - `last_modified` updates once at replan-complete (whether or not changes applied) so subsequent resumes don't re-debate the same commits
  - Sub-agent failure (timeout/error) → silent fallback + stderr; `last_modified` still updates
  - templates/ and .safeword/hooks/ stay byte-identical after changes
out_of_scope:
  - Epic-anchor hook (re-inject epic `## Contracts`) and the verify soft-promotion checklist — DEFERRED to a follow-up; build only when a recurring cross-ticket-contract failure justifies the per-turn cost (was Mechanisms 1 & 3)
  - "Any commit counts" triggering — replaced by the relevance filter above (the alert-fatigue evidence makes any-commit the core annoyance)
  - Proactive sibling sweep (JIT-only per CHI 2025; per-ticket replan covers cascading invalidation through natural progression)
  - Auto-detection of cross-ticket interfaces from sibling code (research-grade not product-grade in 2026)
  - New `kind: contract` ticket subtype, new slash commands, opt-out frontmatter (if the relevance filter mis-fires, fix the filter)
  - Sub-agent-per-whole-ticket architecture — only the meta-investigation runs in a sub-agent, not the ticket's actual work
done_when:
  - Resuming a non-epic ticket fires nothing when no commits since `last_modified` touch paths the ticket references (the silent, common case)
  - Resuming when relevant commits landed surfaces a concise opt-in heads-up naming the count; declining is one step and runs no investigation
  - Accepting the heads-up runs the investigation in a fresh sub-agent (`isolation: worktree`) and returns a chat-only report proposing one of: still good / change scope / cancel / split / merge, with rationale
  - The relevance filter compares the commits' changed paths against paths the ticket references; an irrelevant-only commit set does not fire
  - `last_modified` updates once at replan-complete (whether or not changes applied); ticket files change only with explicit user approval
  - Sub-agent failure (timeout/error) → silent fallback + stderr; `last_modified` still updates
  - templates/hooks/ and .safeword/hooks/ pass `diff -q`
  - Tests cover: silent-on-irrelevant-commits, heads-up-on-relevant-commits, opt-in-decline-does-no-work, escalation-runs-the-sub-agent, `last_modified` update timing, sub-agent-failure fallback
---

# Boundary Resilience: Replan-on-Resume

> **Revision 2026-06-02 — supersedes the Mechanism 1/2/3 body below.** Scoped to **replan-on-resume only** (per `/figure-it-out`): the epic-anchor hook + verify soft-promotion are **deferred** to a follow-up (build only when a recurring cross-ticket-contract failure justifies the per-turn cost). The replan trigger is redesigned to **design B** — fire only on commits that touch paths the ticket references (relevance filter, not "any commit"); cheap inline triage first; escalate to the sub-agent investigation only on plausible drift; surface it as an opt-in heads-up at the resume boundary. Rationale: alert-fatigue evidence shows "any commit → auto-run heavy investigation" yields a low alert-to-action ratio and trains users to ignore it. **`dimensions.md` + `test-definitions.md` below are STALE** (built for the old any-commit trigger + epic-anchor) — being re-derived in define-behavior.

**Goal:** Eliminate the plan-staleness failure mode when resuming a ticket after sibling work landed — a ticket written before its siblings shipped reflects assumptions the new commits have invalidated, and today nothing re-checks the plan at resume. (The companion failure — forgetting cross-ticket contracts mid-session — is deferred with the epic-anchor hook.)

**Why:** Reported by Nate in a real Safeword session — built a Coordinator service successfully, then by the time he reached the Engine sub-ticket Claude was making "simplifying and incorrect assumptions" about the cross-service interface. Course-correctable with "the spec is the law," but the underlying cause is structural: Safeword's ticket-scoped phase gates re-read ticket artifacts each turn but never re-read epic-scoped truth, and ticket plans are treated as static once written. Both are addressable with minimal new mechanism — we already have the hook patterns and the verify checklist surface.

## Background

Diagnosis traced two compounding mechanisms:

1. **Truth drift (context rot).** Anthropic's own documentation calls it context rot — performance degrades as a gradient with token count, not a cliff. Opus 4.x effective context for multi-constraint coding work is ~200K despite the 1M nominal window. Cross-component work amplifies it because the model's attention shifts to the new component and the spec drifts out of recency. Auto-compact at default 95% threshold lossy-summarizes early-conversation content — including the epic spec.
2. **Plan staleness.** A ticket written before sibling sub-tickets shipped reflects assumptions that the sibling work has now updated. Today nothing re-validates the plan at resume; the model executes against a stale plan.

Today's Safeword design forces re-reading of **ticket-scoped** artifacts at each phase gate but does not re-read **epic-scoped** artifacts and does not re-validate plans against changed reality.

## Mechanism 1 — Epic-Anchor Hook

**Trigger:** Sub-ticket has `epic: <id>` frontmatter field.

**Behavior:** On every `UserPromptSubmit` and on `SessionStart:compact`, the hook reads the epic ticket's `## Contracts` section from disk and injects it via `hookSpecificOutput.additionalContext`. Section-only (not whole ticket); falls back to a file-path-and-summary stub when the section exceeds the 10K-char cap.

**Why this shape:** Anthropic's [memory docs](https://code.claude.com/docs/en/memory) explicitly route load-bearing facts to hooks. Path-scoped rules vanish on compaction; hook-injected content survives. Safeword already has this pattern wired for ticket.md ([prompt-questions.ts](.safeword/hooks/prompt-questions.ts), [session-compact-context.ts](.safeword/hooks/session-compact-context.ts) — see [ticket 032](.safeword-project/tickets/completed/032-post-compact-context-reinject)). This extension reuses the existing pattern with a new payload, no new mechanism.

## Mechanism 2 — Replan-on-Resume

**Trigger:** At ticket transition (when `quality-state.json` `activeTicket` changes to a non-epic ticket — see "Why epics never trigger replan" below), run `git log <ticket.last_modified>..HEAD --oneline | wc -l`. If > 0, a `UserPromptSubmit` hook injects an instruction making the model's first action on that turn a replan investigation.

**Behavior:** The investigation runs in a fresh sub-agent spawned via the Agent tool with `isolation: worktree`. The sub-agent reads codebase changes since `last_modified`, fetches latest docs for relevant tools (Context7 / web), surfaces relevant recent research. It returns a condensed report to the parent proposing one of: still good / change scope / cancel / split / merge — with rationale. If invalidation detected, the report appends a one-line cascade hint naming likely-affected sibling tickets in the same epic (free signal — sub-agent already has the context loaded).

**Why a sub-agent (not inline):** "Is this plan still right" is meta to "do the ticket." Inlining the investigation pollutes the parent session with codebase greps, doc fetches, and research before any real work starts — burning the parent's context budget on a question whose answer is most often "yes, keep going." Sub-agent isolation keeps the parent context clean and condenses the investigation to its conclusion. The [`isolation: worktree`](https://code.claude.com/docs/en/sub-agents) primitive (GA in Claude Code) makes this cheap to implement. Note this is meta-task isolation, not work isolation — the user still drives the ticket interactively after the sub-agent returns its report.

**No proactive sweep.** CHI 2025 Codellaborator ([arXiv 2502.18658](https://arxiv.org/html/2502.18658)) found speculative proactivity actively disliked, while task-boundary intervention had 53.3% engagement vs 12.1% disruption. All shipped agentic coding tools (Cursor, Cline, Aider, Codex, Claude Code Plan Mode) operate strictly JIT — no major tool has shipped speculative cross-task replanning, which is itself signal. Per-ticket auto-replan provides cascading coverage through natural progression (when the user reaches ticket N+1, that ticket gets its own replan).

**`last_modified` updates after replan completes** regardless of whether the user applied any proposed changes. Without this, every subsequent resume would re-debate the same commits.

## Why epics never trigger replan-on-resume themselves

`getActiveTicket()` in [.safeword/hooks/lib/active-ticket.ts:152](.safeword/hooks/lib/active-ticket.ts) already filters out tickets with `type: epic` when resolving the active ticket. This is correct behavior — you don't "work" an epic, you work its sub-tickets. Replan-on-resume only fires when a _sub-ticket_ becomes active. Test-definitions must reflect this: there is no "replan fires on an epic ticket" scenario to test against; instead, the test is "epic ticket type is correctly excluded from the replan trigger."

## Mechanism 3 — Verify-Skill Soft Promotion

Extend /verify with a non-blocking checklist item:

> "Did this sub-ticket finalize interface decisions that future sub-tickets in `epic-<id>` must honor? If yes, append to the epic ticket's `## Contracts` section before marking verify complete."

Soft, not hard. Real-world data will tell us whether hard-gating is needed; default to trusting Claude's judgment, opt-in escape hatch deliberately omitted.

## Design Rationale (Research-Backed)

- **Hooks over CLAUDE.md** for load-bearing facts — Anthropic's stated guidance. CLAUDE.md is "no guarantee of strict compliance"; hooks execute deterministically.
- **Promote-on-verify over decompose-first** — Spec Kit Agents ([arXiv 2604.05278](https://arxiv.org/html/2604.05278v1)) shows only +1.7% SWE-bench gain from upfront decomposition — a modest, not dominant, win. Practitioner consensus (Tessl, Osmani, Vellum) leans evolving-spec rather than spec-then-discard.
- **JIT-only replan** — CHI 2025 Codellaborator: proactive intervention at task boundaries had 53.3% engagement vs 12.1% disruption (good); speculative proactivity actively disliked. Per-ticket arrival IS a task boundary.
- **Commits-since-last-touched as the universal staleness signal** — directly measures whether the world has moved, subsumes time-based heuristics, dependency-change checks, and sibling-completion signals into one cheap git command.
- **Sub-agent isolation for the replan investigation** — the investigation is meta to the ticket's actual work; isolating it keeps the parent's context budget for the work itself. Claude Code's [`isolation: worktree`](https://code.claude.com/docs/en/sub-agents) sub-agent primitive makes this a low-cost pattern; the parent receives only the condensed report.

## Anti-Bloat Scorecard

| New                        | Count                                                         |
| -------------------------- | ------------------------------------------------------------- |
| New frontmatter fields     | 1 (`epic:`)                                                   |
| New hooks                  | 0 (2 extensions to existing hooks)                            |
| New artifact types         | 0 (reuse `type: epic`; new section convention `## Contracts`) |
| New slash commands         | 0                                                             |
| Opt-out flags              | 0                                                             |
| Proactive sweep mechanisms | 0 (JIT-only)                                                  |
| Auto-investigation flows   | 1 (replan)                                                    |
| Approx code change         | ~50 lines hooks + replan flow + tests                         |

## Investigation Needed (Before Implementation)

1. **Regression-check the historical additionalContext double-inject bug ([anthropics/claude-code#14281](https://github.com/anthropics/claude-code/issues/14281), filed 2025-12-17, now CLOSED).** The fix should be in any current Claude Code version, but our epic-anchor injection is exactly the shape that exercised the original regression — verify in dogfood before shipping.
2. **Confirm `UserPromptSubmit` hook can detect `activeTicket` transition reliably.** The hook needs to compare current `quality-state.json:activeTicket` against the previous turn's value (state-diffing). Persist the previous-turn snapshot **inline within `quality-state.json`** as a sibling field — tentatively `previousActiveTicket: string | null` — following v0.34.0's append-only state precedent (`learningsNudgesPending[]`, `learningsNudgesAcknowledged[]` shipped in #126). No sibling file in `.safeword/state/`; single state file keeps the snapshot atomic with the rest of session state.
3. **Format of the auto-replan prompt template** — needs to instruct Claude to investigate codebase changes (one `git diff` since last_modified), fetch latest docs for relevant tools (Context7), and conclude with a structured proposal. Template needs to be written and tested for output quality.
4. **`## Contracts` section parsing** — markdown heading scan. Need to decide what counts as the section boundary (next `##` heading) and how to handle nested subsections.

## Decomposition

Four ordered tasks. A is the dependency root; B and C can parallelize; D depends only on A.

### A — `epic:` frontmatter parsing

Verify [lib/hierarchy.ts](.safeword/hooks/lib/hierarchy.ts) `parseFrontmatter()` returns the new `epic:` field unchanged. The parser is already permissive; expected to be zero-code with a single unit test confirming the field round-trips.

- **Test layer:** unit test for `parseFrontmatter()` reading `epic: 999`
- **Covers:** prerequisite for B, C, D
- **Estimate:** trivial

### B — Epic-anchor hook (Mechanism 1)

Extend [prompt-questions.ts](.safeword/hooks/prompt-questions.ts) and [session-compact-context.ts](.safeword/hooks/session-compact-context.ts) with: epic-file resolution by id-prefix glob, strict `## Contracts` section parser, size cap with static stub fallback, graceful no-op + stderr warning on missing file, malformed-value safety.

- **Test layer:** Vitest unit tests for section parsing, size-cap boundaries (9999 / 10000 / 10001), heading-variant rejection, empty-section no-op, missing-file behavior, malformed-value safety, disk re-read on every injection
- **Covers:** Rules 1-5, 12
- **Estimate:** moderate; ~40 lines of hook logic + parser + tests

### C — Verify-skill soft-prompt (Mechanism 3)

Append a non-blocking checklist item to the verify skill that conditions on the active ticket having `epic:` field. Outputs guidance to append to the epic's `## Contracts` section if cross-ticket bindings exist.

- **Test layer:** unit test of verify checklist output for `epic:`-having vs `epic:`-lacking tickets; assertion that the item is non-blocking
- **Covers:** Rule 11
- **Estimate:** small; ~15 lines + tests

### D — Replan-on-resume (Mechanism 2)

UserPromptSubmit state-diffing to detect activeTicket transitions; git-log commit-count check against `last_modified`; replan-instruction injection when count > 0; a `replanInvestigation()` wrapper module that invokes the Agent tool with `isolation: 'worktree'` and returns a condensed report; cascade-hint conditioning when invalidation found + open siblings exist; `last_modified` update on replan-complete (including failure path).

- **Test layer:** unit tests for the wrapper (asserting `isolation: 'worktree'` in the invocation options), trigger-gate (non-epic + commits, non-epic + 0 commits, epic-as-activeTicket filtered upstream); integration tests for the hook → wrapper → ticket-state update flow
- **Covers:** Rules 6-10
- **Estimate:** largest; ~80 lines + wrapper module + tests

### Order rationale

- A first: blocks B/C/D, but cheap to confirm
- B and C parallelizable after A: independent code paths, distinct test surfaces
- D last: largest blast radius (introduces sub-agent invocation), benefits from B's parser being already-tested if D ever needs to read epic state
- Within each task: standard RED → GREEN → REFACTOR with a commit at GREEN

## Related Tickets

- [032-post-compact-context-reinject](.safeword-project/tickets/completed/032-post-compact-context-reinject) — predecessor pattern this extends
- [094-cross-session-phase-blocking](.safeword-project/tickets/completed/094-cross-session-phase-blocking) — related context-collapse work
- [110-multi-session-coordination](.safeword-project/tickets/110-multi-session-coordination) — orthogonal multi-session work, may compose
- [133-schema-drift-detection](.safeword-project/tickets/133-schema-drift-detection) — adjacent drift-detection work
- [126-prompt-hook-reminders](.safeword-project/tickets/completed/126-prompt-hook-reminders) — pattern reference for one-shot prompt-hook injections
- [155-audit-skill-reorganize](.safeword-project/tickets/155-audit-skill-reorganize) — proposes moving audit checks to hooks; if it lands first, coordinate hook ordering with 153's extensions. Non-blocking today.

## Work Log

- 2026-06-02T23:00:00Z Done. /verify + /audit green (2394/2394 tests, build/lint/typecheck clean, 39/39 scenarios, 118 parity pairs, depcruise/knip clean). /quality-review found + fixed a shell-injection in `runGit` (execSync→execFileSync; commit 22b6f074) and filed a follow-up task for the repo's other `execSync`-interpolation git calls. Reconcile: 1 justified deviation (execFileSync for free-text input), uplevel filed. Feature dogfood-confirmed itself live — the prompt hook fired its own `Resume check` heads-up on a commit touching `replan.ts`. verify.md present. Status → done.
- 2026-06-02T22:30:00Z Complete: implement (4 build steps). Pure core in `replan-relevance.ts` — `relevantChangedPaths`, `shouldSurfaceReplan`, `extractReferencedPaths`, `decideReplan` (epic-excluded + HEAD-marker re-fire suppression), `parseGitLogNameOnly`, `formatReplanHeadsUp` (24 unit tests). I/O shell `replan.ts` — gathers ticket `last_modified` + referenced paths + commits-since + HEAD, delegates to the pure core, returns heads-up line + HEAD to record; never throws (6 integration tests over a real git repo). Wired into `prompt-questions.ts`; new `replanPromptedHead` field on `QualityState` records the prompted HEAD (never bumps `last_modified` — that's the active-ticket mtime). Agent protocol in SAFEWORD.md → "Replan on resume" covers the [agent] scenarios (opt-in, isolated sub-agent, chat-only, no mutation without approval, fail-without-loop). Commits: 9a72e84c / 446a892f / debbf459 / 71fe8543. Scope trim: textual relevance signal only (touched-files history signal deferred — see dimensions.md). 118 parity pairs in sync, typecheck clean. Phase → verify.
- 2026-05-24T13:17:00Z Re-applied May-23 re-validation clarification (Investigation Needed #2 now specifies `previousActiveTicket` as inline sibling field in `quality-state.json`, following v0.34.0's append-only state precedent). Original May-23 commit `90f725c` landed on `chore/dogfood-bump-0.35.1` which got reset/rebased before merge; commit is now orphaned and not on any branch. The May-23 re-validation pass itself (57-commit codebase delta check) had verdict "design holds, no CONFLICTS" — that conclusion still stands; this entry just re-instates the design-clarification artifact on main.
- 2026-06-02T21:32:00Z Complete: scenario-gate — AODI clean; adversarial pass added 3 scenarios (denylisted-manifest-silent, no-transition-no-refire, further-relevant-commit-re-fires), trimmed the decline overlap, and split scenarios [hook] (unit-tested) vs [agent] (skill prose, live-verified). Baked: relevance denylist, `git --since`, hook-bumps-`last_modified`-on-surface, build order. Phase → implement.
- 2026-06-02T21:18:00Z Complete: define-behavior — re-derived dimensions.md (7 baked decisions incl. the relevance-filter definition: artifact path-tokens ∪ ticket-touched-files ∩ changed paths, silent on no signal) + test-definitions.md (10 scenarios / 5 rules / 1 invariant, standard R/G/R). Phase → scenario-gate.
- 2026-06-02T20:56:00Z Rescoped (via /figure-it-out "best for users"): cut to **replan-on-resume only** (epic-anchor + verify soft-prompt deferred), and redesigned the trigger to **design B** — relevance-filtered (commits touching ticket-referenced paths, not any commit), tiered (cheap triage → sub-agent only on plausible drift), opt-in heads-up at the resume boundary. Evidence: alert-fatigue research (cut false positives at the source) + proactive-programming UX (task-boundary intervention, opt-in alleviates disruption). Reset phase → define-behavior; dimensions.md + test-definitions.md flagged stale, to be re-derived for the new trigger. Implementation should land on its own branch (153 is standalone — not part of the bdd-chain-hardening epic on this branch).
- 2026-06-02T20:36:00Z Revalidated (via /figure-it-out, ~10 days + intervening commits later): still valuable — the two failure modes are real (this very session is an example) and the replan mechanism is unbuilt; Claude Code 2026 ships no native plan-revalidation, so not obsolete. Reconciliation outcome: 153 is the canonical home for replan-on-resume; `5JN5E4-revalidate-ticket-on-pickup` (bare intake, same intent) is **superseded** by 153's fuller design. Dropped the `epic:`-frontmatter-field scope line — that field already shipped (sync-tickets groups by it). Migrated `phase: decomposition → implement` (decomposition phase retired per FSX1PP/ADR; 153's own log already said "advances to implement next") — this unblocks W9GPE7. Design otherwise intact; `## Contracts`-on-epics remains the net-new convention.
- 2026-05-20T05:58:00Z Complete: Phase 5 — Decomposition. Four ordered tasks (A→B→C→D) with A as the parsing dependency root, B and C parallelizable after A, D depending only on A and largest in blast radius. Each task names its test layer and scenario coverage from test-definitions.md. Phase advances to `implement` next.
- 2026-05-20T05:52:00Z Complete: Phase 4 — Scenarios validated (AODI) + adversarial pass. Quality-review skill audited the draft against AODI criteria and ran an adversarial pass; the audit produced (a) three atomicity splits (missing-epic → no-op vs stderr-warning; oversized → stub-injected vs full-section-absent; no-changes-without-approval → no-action vs accepted), (b) two observability restructures (wrapper-layer assertion for `isolation: worktree`; hook-payload-layer assertion for #14281 regression), (c) five adversarial scenarios (heading variants, empty section, 10K boundary, mid-session epic edit, sub-agent failure mode), and (d) one structural relabel (parity diff moved to Invariants section, separate from RED/GREEN/REFACTOR loop). All applied to the final test-definitions.md. Phase 4 exit criteria met.
- 2026-05-20T05:50:00Z Complete: Phase 3 — 27 scenarios defined across 12 rules + 3 invariants in test-definitions.md, derived from the 13-row dimensions table in dimensions.md. Eight open questions (stub format, missing-file behavior, sub-agent failure, partial-accept semantics, empty-Contracts handling, heading match strictness, size-cap threshold, empty vs absent equivalence) all decided and baked into dimensions.md's "Decisions baked in" table so scenarios assume them as given.
- 2026-05-20T05:34:00Z Quality-review verification of cited primary sources flagged four miscitations. Fixed: (1) removed arXiv 2604.11378 "Task-Decoupled Planning" citation — paper at that ID is actually "Structured Graph Harness," a position paper with no 82% token-reduction claim (hallucinated by an earlier research agent). JIT-only conclusion now rests on CHI 2025 + prior art from all shipped tools, which is sufficient. (2) Reframed sub-agent justification — dropped appeal to "Anthropic harness post recommends fresh-context sub-agents for meta-tasks" since the linked post lists multi-agent architectures as Future Work, not a recommendation. Kept context-pollution argument and `isolation: worktree` availability, which stand on their own. (3) Removed "Anthropic subagent docs recommend output files as handoff between stages" from Design Rationale — phrase does not appear in the docs. (4) Reworded Investigation Needed #1 on bug #14281 — issue is CLOSED (filed 2025-12-17), so framed as regression-check on a previously-fixed bug rather than open risk. Design conclusions unchanged; evidence base now accurate.
- 2026-05-20T05:23:00Z Re-validation pass: 5 commits landed since last touch (vendored-ignores #116, ticket-155 orphan rescue #115, config-version strip #114, release-tag gate, v0.33.0). Dispatched two parallel research agents: codebase-delta impact and latest-Anthropic-shipping check. Verdict: all 5 commits NEUTRAL to design; nothing shipped in last 2-7 days that changes the design. Applied three improvements: (1) replan investigation now runs in fresh sub-agent (`isolation: worktree`), (2) clarified trigger semantics — replan IS the model's first action on the triggered turn, not "before the first model turn", (3) explicit note that epics never trigger replan (already filtered by `getActiveTicket()` at active-ticket.ts:152). Refined investigation item 2 to specify UserPromptSubmit hook + state-diffing approach. Added 155-audit-skill-reorganize to coordination links.
- 2026-05-18T06:12:00Z Created: feature ticket synthesizing a long design conversation. Diagnosis (truth drift + plan staleness) and design (epic-anchor hook + replan-on-resume + verify soft-prompt) anchored in research dispatched during conversation: Anthropic context-engineering + memory + subagent docs, Spec Kit Agents paper, Martin Fowler SDD survey, CHI 2025 Codellaborator, Task-Decoupled Planning paper, prior art from all shipped agentic coding tools. Anti-bloat scorecard explicit. Awaiting user review before phase transition to define-behavior.

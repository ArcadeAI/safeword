# Test Definitions — Ticket 153: Replan-on-Resume (design B)

Re-derived 2026-06-02 (`/figure-it-out` rescope; replan-only). **Shipped relevance signal** = path tokens the ticket's artifacts reference ∩ commits' changed paths, **minus** a high-churn denylist (`package.json`, lockfiles, `tsconfig*.json`, `.gitignore`); silent on no signal. (The "∪ files the ticket has touched" history enrichment was deferred — at resume the ticket has usually edited nothing yet, and a `git log --grep=<id>` proxy risks the false positives this filter exists to avoid.)

**Architecture split:** **[hook]** scenarios are unit-tested (a deterministic function over ticket + git state decides whether to surface the heads-up and records the prompted HEAD). **[agent]** scenarios are skill prose (SAFEWORD.md → "Replan on resume") — the hook only injects the opt-in heads-up; the agent runs the investigation. Agent scenarios are verified by live observation (like FSX1PP/V6N5PW), and their R/G/R close with `skip: <reason — agent behavior>`.

## Rule: Replan fires only on relevant drift **[hook]**

### Scenario: epic_ticket_never_triggers

Given the active ticket is `type: epic`
When the activeTicket transition fires
Then no replan check runs (epics are excluded upstream)

- [x] RED 446a892f
- [x] GREEN 446a892f
- [x] REFACTOR 71fe8543

### Scenario: no_commits_since_last_modified_is_silent

Given a non-epic ticket and `git log --since=<last_modified>` returns 0 commits
When the ticket becomes active
Then no heads-up is surfaced

- [x] RED 446a892f
- [x] GREEN 446a892f
- [x] REFACTOR 71fe8543

### Scenario: commits_touching_no_referenced_path_are_silent

Given a non-epic ticket with ≥1 commit since `last_modified`, none of whose changed paths intersect the ticket's referenced paths
When the ticket becomes active
Then no heads-up is surfaced

- [x] RED 446a892f
- [x] GREEN 446a892f
- [x] REFACTOR 71fe8543

### Scenario: commit_touching_only_denylisted_manifest_is_silent

Given a non-epic ticket that references `package.json`, and the only commit since `last_modified` changed `package.json` + `bun.lock`
When the ticket becomes active
Then no heads-up is surfaced (denylisted high-churn paths don't count toward relevance)

- [x] RED 446a892f
- [x] GREEN 446a892f
- [x] REFACTOR 71fe8543

### Scenario: relevant_commit_surfaces_opt_in_headsup

Given a non-epic ticket with ≥1 commit whose changed paths intersect the ticket's referenced paths (after denylist)
When the ticket becomes active
Then a concise opt-in heads-up is surfaced naming the relevant-commit count

- [x] RED 446a892f
- [x] GREEN 446a892f
- [x] REFACTOR 71fe8543

### Scenario: ticket_with_no_path_signal_is_silent

Given a non-epic ticket that references no file paths and has modified no files, with ≥1 commit since `last_modified`
When the ticket becomes active
Then no heads-up is surfaced (no signal → bias quiet)

- [x] RED debbf459
- [x] GREEN debbf459
- [x] REFACTOR 71fe8543

## Rule: Fires on transition, once per commit-batch **[hook]**

### Scenario: same_head_does_not_re_fire

Given a relevant heads-up already surfaced and the prompted HEAD recorded in session state, and HEAD has not advanced
When the next turn fires
Then no heads-up is surfaced (re-fire keys on HEAD advancing, not every turn)

- [x] RED 446a892f
- [x] GREEN 446a892f
- [x] REFACTOR 71fe8543

### Scenario: further_relevant_commit_after_replan_re_fires

Given a heads-up surfaced and the prompted HEAD recorded, and a _new_ relevant commit then advances HEAD
When the ticket is resumed
Then a fresh heads-up is surfaced (the recorded HEAD silences only the already-seen commits, not future ones)

- [x] RED 446a892f
- [x] GREEN 446a892f
- [x] REFACTOR 71fe8543

## Rule: Surfacing records the prompted HEAD in session state **[hook]**

### Scenario: surfacing_headsup_records_prompted_head

Given a relevant commit triggers a heads-up
When the hook surfaces it
Then the current HEAD is recorded as the prompted HEAD in `quality-state.json` (and `last_modified` is left untouched), so resuming with HEAD unchanged is silent even if the user ignored the heads-up

- [x] RED debbf459
- [x] GREEN debbf459
- [x] REFACTOR 71fe8543

## Rule: Opt-in — declining does no work **[agent]**

### Scenario: declining_headsup_runs_no_investigation

Given a heads-up has been surfaced
When the user declines
Then no sub-agent is spawned and the agent proceeds with the requested work

- [x] RED skip: agent behavior — verified by live observation, not unit-tested
- [x] GREEN skip: agent behavior
- [x] REFACTOR skip: agent behavior

## Rule: Accept runs an isolated, proposal-only investigation **[agent]**

### Scenario: accept_runs_subagent_returns_chat_only_report

Given a heads-up has been surfaced
When the user accepts
Then the investigation runs in a fresh sub-agent (`isolation: worktree`) and returns a chat-only report proposing one of still-good / change-scope / cancel / split / merge with rationale

- [x] RED skip: agent behavior — skill prose, verified live
- [x] GREEN skip: agent behavior
- [x] REFACTOR skip: agent behavior

### Scenario: proposal_does_not_mutate_ticket_without_approval

Given the investigation report proposes a scope change
When the report is presented
Then the ticket frontmatter and body are unchanged until the user explicitly approves

- [x] RED skip: agent behavior — skill prose, verified live
- [x] GREEN skip: agent behavior
- [x] REFACTOR skip: agent behavior

### Scenario: subagent_failure_falls_back_silently

Given the user accepted and the investigation sub-agent errors or times out
When the failure occurs
Then the agent notes it in one line and proceeds; no indefinite re-debate (the heads-up won't re-fire until new commits advance HEAD)

- [x] RED skip: agent behavior — skill prose, verified live
- [x] GREEN skip: agent behavior
- [x] REFACTOR skip: agent behavior

## Invariants

- `templates/hooks/` and `.safeword/hooks/` are byte-identical (`diff -q`) after all changes.

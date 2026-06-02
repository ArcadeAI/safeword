# Test Definitions — Ticket 153: Replan-on-Resume (design B)

Re-derived 2026-06-02 after the `/figure-it-out` rescope (replan-only; epic-anchor deferred). Relevance = (path tokens in ticket artifacts ∪ files the ticket has touched) ∩ commits' changed paths; silent on no signal.

## Rule: Replan fires only on relevant drift

### Scenario: epic_ticket_never_triggers

Given the active ticket is `type: epic`
When the activeTicket transition fires
Then no replan check runs (epics are excluded upstream)

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: no_commits_since_last_modified_is_silent

Given a non-epic ticket and `git log <last_modified>..HEAD` returns 0 commits
When the ticket becomes active
Then no heads-up is surfaced

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: commits_touching_no_referenced_path_are_silent

Given a non-epic ticket with ≥1 commit since `last_modified`, none of whose changed paths intersect the ticket's referenced paths
When the ticket becomes active
Then no heads-up is surfaced (the relevance filter suppresses it)

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: relevant_commit_surfaces_opt_in_headsup

Given a non-epic ticket with ≥1 commit whose changed paths intersect the ticket's referenced paths
When the ticket becomes active
Then a concise opt-in heads-up is surfaced naming the relevant-commit count

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: ticket_with_no_path_signal_is_silent

Given a non-epic ticket that references no file paths and has modified no files, with ≥1 commit since `last_modified`
When the ticket becomes active
Then no heads-up is surfaced (no signal → bias quiet)

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: Opt-in — declining does no work

### Scenario: declining_headsup_runs_no_investigation

Given a heads-up has been surfaced
When the user declines
Then no sub-agent is spawned, and `last_modified` is updated so the same commits do not re-fire

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: Accept runs an isolated, proposal-only investigation

### Scenario: accept_runs_subagent_returns_chat_only_report

Given a heads-up has been surfaced
When the user accepts
Then the investigation runs in a fresh sub-agent (`isolation: worktree`) and returns a chat-only report proposing one of still-good / change-scope / cancel / split / merge with rationale

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: proposal_does_not_mutate_ticket_without_approval

Given the investigation report proposes a scope change
When the report is presented
Then the ticket frontmatter and body are unchanged until the user explicitly approves

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: `last_modified` updates once at replan-complete

### Scenario: last_modified_updates_once_then_same_commits_silent

Given any fired path completed (decline, accept-success, or accept-failure) and `last_modified` was set to that moment
When the ticket is resumed again with no commits beyond those
Then no heads-up is surfaced (the same commits are not re-debated)

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: Sub-agent failure degrades safely

### Scenario: subagent_failure_falls_back_silently

Given the user accepted and the investigation sub-agent errors or times out
When the failure occurs
Then there is a silent fallback with a stderr log, and `last_modified` still updates (no indefinite re-debate)

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Invariants

- `templates/hooks/` and `.safeword/hooks/` are byte-identical (`diff -q`) after all changes.

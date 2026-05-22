# session-reentry-brief — test definitions

Ticket: 645W8H | 21 scenarios across 8 rules (Rule 5 rewritten + Rule 8 added post-elicit, 2026-05-22)

## Rule: Stop hook records intent when present, skips otherwise

### Scenario: Assistant message ends with Next: imperative

Given a Claude Code session has produced an assistant message ending with `**Next:** commit and PR`
And the Stop hook receives the session's stdin payload
When the Stop hook runs
Then `.safeword-project/re-entry.md` gains one new appended line
And that line's Next: imperative reads `commit and PR`

- [x] RED e1a9f28
- [x] GREEN 06ba40d
- [x] REFACTOR skip: slice 1 standalone; lib extraction lands when Slice 2 first reuses a helper.

### Scenario: Assistant message has no Next: line

Given a Claude Code session has produced an assistant message without any `**Next:**` line
When the Stop hook runs
Then `.safeword-project/re-entry.md` is unchanged (no new line appended)

- [x] RED skip: behavior implemented as a side-effect of scenario 1.1's GREEN bail-out; no failing test to write — regression coverage added in GREEN commit.
- [x] GREEN a085a1a
- [x] REFACTOR skip: regression test only; no production code change, nothing to refactor.

### Scenario: Next: line has empty imperative

Given an assistant message ending with `**Next:**` (whitespace only after the bold preface)
When the Stop hook runs
Then `.safeword-project/re-entry.md` is unchanged

- [x] RED skip: regex `.+` capture + post-trim `imperative.length > 0` guard from scenario 1.1's GREEN already drop empty values; nothing left to drive.
- [x] GREEN 63b70cc
- [x] REFACTOR skip: regression test only; no production code change.

## Rule: Hook injects every deterministic field; agent only authors the imperative

### Scenario: Deterministic fields come from hook context, not assistant text

Given an assistant message whose Next: imperative contains a misleading string like `session_id=DECEPTIVE123`
And the Stop hook receives stdin with `session_id=actual_abc`
When the Stop hook runs
Then the appended log line's session_id field equals `actual_abc`
And the log line's timestamp equals the wall clock at write time (within 1s tolerance)

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Ticket field reflects active-ticket frontmatter when ticket exists

Given a worktree with active ticket `645W8H` at phase `scenario-gate`
When the Stop hook runs with an extractable Next:
Then the appended log line contains `ticket=645W8H/scenario-gate`

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Ticket field uses sentinel when no active ticket exists

Given a worktree with no active ticket in `.safeword-project/`
When the Stop hook runs with an extractable Next:
Then the appended log line contains `ticket=∅/freeform`

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: Concurrent writers don't interleave

### Scenario: Two simultaneous Stop hooks produce two distinct correctly-tagged lines

Given two Claude Code sessions running in the same worktree
And both sessions finish their turn at the same moment (Stop hooks fire concurrently)
And each session has an extractable Next: imperative
When both Stop hooks append to `.safeword-project/re-entry.md`
Then the file contains both new lines
And each line is correctly tagged with its own session's session_id
And neither line is garbled mid-content

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: SessionStart injects a filtered tail

### Scenario: Resume by name shows that session's last 3 entries

Given `.safeword-project/re-entry.md` contains entries from session `abc` and session `xyz`
And the user invokes `claude --resume abc`
When the SessionStart hook fires
Then additionalContext contains the last 3 entries tagged with session_id `abc`
And the entries are ordered oldest first

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: --continue shows the most-recent session's last 3 entries

Given `.safeword-project/re-entry.md` contains entries from multiple sessions
And the user invokes `claude --continue`
When the SessionStart hook fires
Then additionalContext contains the last 3 entries belonging to the session whose most-recent entry is latest in the log

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Fresh claude start surfaces most-recent entry from another session

Given `.safeword-project/re-entry.md` contains entries from previous session(s)
And the user invokes bare `claude` (no `--resume` or `--continue`)
When the SessionStart hook fires
Then additionalContext contains the most-recent entry in the log
And that entry is tagged `(from another session)` in the rendered output

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Absent or empty log → silent injection

Given `.safeword-project/re-entry.md` either does not exist or exists but is empty
When the SessionStart hook fires (any resume path)
Then no additionalContext related to re-entry is injected
And no error is raised or logged

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: Conflict detection surfaces dirty-file overlap between sessions

_Replaces the previous "multi-session trailer" rule after /elicit Q2 → silent unless conflict. Conflict = another session edited a file in its last 10 turns AND that file is dirty in `git status`._

### Scenario: No file overlap → no warning

Given another Claude session edited files in this worktree in its last 10 turns
And none of those files are currently dirty in `git status`
When the SessionStart hook fires
Then additionalContext contains no conflict warning line

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Single dirty-file overlap → warning names the file

Given another Claude session edited `foo.ts` in its last 10 turns
And `foo.ts` is currently dirty in `git status`
When the SessionStart hook fires
Then additionalContext includes a warning line naming `foo.ts`

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Multiple dirty-file overlaps → all named

Given another Claude session edited `foo.ts` and `bar.ts` in its last 10 turns
And both files are currently dirty in `git status`
When the SessionStart hook fires
Then additionalContext includes a warning line naming both files

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: Render stays bounded

### Scenario: Only last 3 matching entries render when more match

Given the filter matches more than 3 entries (e.g., 5 entries from the current session)
When the SessionStart hook injects additionalContext
Then exactly the last 3 of those entries appear in the rendered output

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Each entry occupies one line in rendered output

Given the filter matches one or more entries
When the SessionStart hook injects additionalContext
Then each entry appears on exactly one line (no wrapping, no multi-line entries)

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: Resilience guards

### Scenario: Stop-hook stdin missing session_id → skip, no exception

Given the Stop hook receives stdin without a `session_id` field (documented Claude Code edge case)
When the Stop hook attempts to process
Then no entry is written to `.safeword-project/re-entry.md`
And no uncaught exception escapes the hook

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Multi-line Next: imperative sanitized to first single-line segment

Given an assistant message's Next: imperative contains newlines (e.g., `**Next:** do X\nand then Y`)
When the Stop hook runs
Then the appended log line's Next: imperative is a single line
And that line equals the first segment of the imperative before the newline

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: Status-line script surfaces latest Next: with conflict prefix

_Added post-elicit (Q1 = D + Q2 conflict refinement). Slice 3._

### Scenario: Normal status line shows the latest Next: imperative

Given the current session has entries in `.safeword-project/re-entry.md`
When the status-line script runs with the standard Claude Code JSON input on stdin
Then stdout includes the most recent Next: imperative for this session

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Conflict prefix appears when dirty-file overlap exists

Given the current session has entries in `.safeword-project/re-entry.md`
And a dirty-file conflict exists with another session (per Rule 5 detection)
When the status-line script runs
Then stdout includes `⚠️ conflict: <file>` before the Next: imperative

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Empty or missing re-entry log → no Next: indicator

Given `.safeword-project/re-entry.md` is empty or missing
When the status-line script runs
Then stdout contains no Next: indicator (graceful absence; status line falls through to other content if any)

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

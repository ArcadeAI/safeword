# Test Definitions: 3ZRP8G monitor source adapters

## Scope

Validate the read-only upstream changelog monitor foundation for Claude Code, Codex CLI, and Cursor sources.

## Acceptance Tests

### 3ZRP8G.SM1.AC1 - Source adapters normalize stable text

Given raw upstream content for Claude Code markdown, Codex Atom releases, and Cursor changelog HTML
When the monitor normalizes each source
Then it returns deterministic text suitable for snapshot comparison
And Cursor cosmetic markup changes do not change the normalized text.

### 3ZRP8G.SM1.AC2 - Snapshot comparison ignores metadata headers

Given a committed snapshot with safeword metadata headers
When the monitor compares the live normalized content to that snapshot
Then only the reviewed snapshot body participates in change detection.

### 3ZRP8G.SM1.AC3 - Changed sources produce actionable issue bodies

Given a stale snapshot for a monitored source
When the monitor builds the GitHub issue payload
Then the body includes the source URL, snapshot path, relevance checklist, and a bounded diff.

### 3ZRP8G.SM1.AC4 - Issue writes are idempotent

Given an open monitor issue already exists for a source
When the monitor reports the same source again
Then it updates that issue instead of creating a duplicate.

## Non-Goals

- The monitor must not commit or mutate snapshot files.
- The monitor does not validate that a human review PR advanced snapshots correctly; that belongs to 31B5AM.

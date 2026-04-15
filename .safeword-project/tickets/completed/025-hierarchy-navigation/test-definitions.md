# Test Definitions: 025 - Hierarchy Navigation After Ticket Completion

## Scenarios

### Scenario 1: Navigate to next undone sibling

- [x] **Given** child ticket 013a (with `parent: 001`, unquoted number format) is in phase: done
      **And** parent ticket 001 has `children: [6, 7, 8]` (unquoted number format)
      **And** sibling 7 has `status: in_progress` (not done)
      **When** the stop hook runs hierarchy navigation
      **Then** it soft-blocks with a directive containing sibling 7's ticket ID and path to its ticket.md

### Scenario 2: Skip done siblings, find next undone

- [x] **Given** child ticket 013b is marked done
      **And** parent 013 has `children: ['013a', '013b', '013c', '013d']`
      **And** 013a and 013c are both `status: done`
      **And** 013d is `status: in_progress`
      **When** the stop hook runs hierarchy navigation
      **Then** it navigates to 013d (skipping already-done 013a and 013c)

### Scenario 3: All siblings done — cascade parent to done

- [x] **Given** child ticket 013e is marked done
      **And** parent 013 has `children: ['013a', '013b', '013c', '013d', '013e']` (quoted string format)
      **And** all siblings 013a-013d are already `status: done`
      **When** the stop hook runs hierarchy navigation
      **Then** parent ticket 013's frontmatter is updated to `status: done, phase: done`
      **And** parent's `last_modified` is updated

### Scenario 4: Multi-level cascade — navigate to parent's sibling

- [x] **Given** child ticket 013e is the last undone child of parent `013` (quoted string format)
      **And** parent 013 is itself a child of grandparent epic 001 (`parent: '013'`)
      **And** grandparent 001 has `children: ['012', '013', '014']`
      **And** sibling 014 has `status: ready` (not done)
      **When** the stop hook runs hierarchy navigation
      **Then** parent 013 is marked `status: done, phase: done`
      **And** it soft-blocks with a directive to navigate to ticket 014

### Scenario 5: Standalone ticket (no parent) — allow stop

- [x] **Given** a ticket with `parent: null` is in `phase: done`
      **And** evidence has been provided (tests pass, scenarios complete)
      **When** the stop hook runs hierarchy navigation
      **Then** stop is allowed (exit 0, no blocking)

### Scenario 6: Broken hierarchy — parent directory missing

- [x] **Given** a child ticket has `parent: '999'`
      **And** no directory matching `999-*` exists in tickets/
      **When** the stop hook runs hierarchy navigation
      **Then** stop is allowed gracefully (no crash, no block)

### Scenario 7: Children field empty or missing

- [x] **Given** a child ticket has `parent: '016'`
      **And** parent ticket 016 exists but has no `children:` field (or `children: []`)
      **When** the stop hook runs hierarchy navigation
      **Then** stop is allowed (empty hierarchy = nothing to navigate)

### Scenario 8: Max recursion depth prevents infinite loop

- [x] **Given** a ticket hierarchy 5+ levels deep with cascading completions
      **When** the stop hook cascades done status up the tree
      **Then** it stops cascading at depth 5 and allows stop (exit 0)

## Notes

- **Format coverage**: Scenarios 1-4 deliberately use varied YAML formats (unquoted numbers, quoted strings, mixed) to verify parsing handles real ticket data. Exhaustive format edge cases covered by unit tests.
- **Self-navigation prevention**: Scenario 1 implicitly tests that the current ticket is marked done before sibling checking — if it weren't, the hook would navigate back to the current ticket instead of the next sibling, and the assertion would fail. The ordering invariant is documented in implementation code comments.

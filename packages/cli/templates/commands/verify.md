---
description: Run completion checklist for current feature ticket (project)
---

# Done

Run completion checklist before marking a feature ticket done.

## Instructions

### 1. Find Current Ticket

Find the most recently modified in_progress ticket:

```bash
# Find in_progress tickets, excluding epics
for f in .safeword-project/tickets/*/ticket.md; do
  [ -f "$f" ] || continue
  grep -q "^status: in_progress" "$f" && ! grep -q "^type: epic" "$f" && echo "$f"
done | head -1
```

Read the ticket to get:

- `parent:` field (if any)
- Ticket ID/slug for test-definitions lookup

### 2. Run Automated Checks

Run these in sequence, reporting each result:

1. **Run `/lint`** to auto-fix style issues first
2. Then run verification:

```bash
# Full test suite
bun run test 2>&1

# Build check
bun run build 2>&1
```

The `/lint` command handles linting with auto-fix. Report any remaining unfixable errors.

### 3. Validate Test Definitions

1. Find matching file: `.safeword-project/tickets/{id}-{slug}/test-definitions.md`
2. Count scenarios: total `- [` lines
3. Count completed: `- [x]` lines
4. Report: "Scenarios: X/Y complete"

If any unchecked `[ ]` remain, list them.

### 4. Check Parent Epic (if applicable)

If ticket has `parent:` field:

1. Read parent ticket
2. Get `children:` array
3. Check each child's `status:`
4. Report: "Siblings: X/Y done"

### 5. Report Results

Format results using these EXACT patterns (hook validates these):

```
## Done Checklist

**Test Suite:** ✓ 156/156 tests pass (or ❌ 3 failures)
**Build:** ✅ Success (or ❌ Failed)
**Lint:** ✅ Clean (or ❌ 2 errors)
**Scenarios:** All 10 scenarios marked complete (or ❌ 8/10 complete)
**Parent Epic:** 006 (siblings: 2/3 done) or N/A

[If all pass]
Ready to mark done. Update ticket: phase: done, status: done

[If failures]
Fix these before marking done:
- [ ] Fix failing tests
- [ ] Complete remaining scenarios
```

**Important:** The stop hook validates evidence patterns:

- `✓ X/X tests pass` - proves test suite ran
- `All N scenarios marked complete` - proves scenarios checked

Without these patterns, the done phase will block.

## Summary

This command automates Phase 7 (Done Gate) verification. Use it before marking any feature ticket complete.

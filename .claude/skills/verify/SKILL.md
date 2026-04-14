---
name: verify
description: Verify ticket completion criteria — use when finishing a ticket,
  before marking work done, or checking acceptance criteria. Runs tests, build,
  lint, scenarios, and dependency drift checks.
allowed-tools: '*'
---

# Verify

Prove a ticket meets its criteria. Works with or without an active ticket.

## Instructions

### 1. Find Current Ticket (if any)

```bash
# Find in_progress tickets, excluding epics
for f in .safeword-project/tickets/*/ticket.md; do
  [ -f "$f" ] || continue
  grep -q "^status: in_progress" "$f" && ! grep -q "^type: epic" "$f" && echo "$f"
done | head -1
```

If a ticket is found, read it to get:

- `parent:` field (if any)
- Ticket ID/slug for test-definitions lookup

If no ticket is found, skip scenario validation (step 3) and parent check (step 4).

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

### 3. Validate Test Definitions (skip if no ticket)

1. Find matching file: `.safeword-project/tickets/{id}-{slug}/test-definitions.md`
2. Count scenarios: total `- [` lines
3. Count completed: `- [x]` lines
4. Report: "Scenarios: X/Y complete"

If any unchecked `[ ]` remain, list them.

### 4. Check Parent Epic (skip if no ticket)

If ticket has `parent:` field:

1. Read parent ticket
2. Get `children:` array
3. Check each child's `status:`
4. Report: "Siblings: X/Y done"

### 5. Check Dependency Drift

Compare `package.json` dependencies against `ARCHITECTURE.md`:

1. If `ARCHITECTURE.md` does not exist, skip this check
2. Read `ARCHITECTURE.md` content
3. Read `package.json` `dependencies` and `devDependencies` keys
4. For each dependency name:
   - Extract the package name (without `@scope/` prefix for matching — but check both full name and short name)
   - Check if `ARCHITECTURE.md` mentions the package name (case-insensitive)
5. Flag any dependency NOT mentioned: `"Dependency \`{name}\` not documented in ARCHITECTURE.md"`

Do NOT flag:

- `@types/*` packages (type-only, not architectural)
- Packages in `devDependencies` that are tooling (eslint plugins, prettier plugins, test utils) — only flag deps that represent architectural choices

### 6. Report Results

Format results using these EXACT patterns (hook validates these):

```
## Verify Checklist

**Test Suite:** ✓ 156/156 tests pass (or ❌ 3 failures)
**Build:** ✅ Success (or ❌ Failed)
**Lint:** ✅ Clean (or ❌ 2 errors)
**Scenarios:** All 10 scenarios marked complete (or ❌ 8/10 complete, or ⏭️ Skipped — no ticket)
**Dep Drift:** ✅ Clean (or ⚠️ 2 undocumented deps, or ⏭️ Skipped — no ARCHITECTURE.md)
**Parent Epic:** 006 (siblings: 2/3 done) or N/A

[If all pass]
Ready to mark done. Update ticket: phase: done, status: done

[If failures]
Fix these before marking done:
- [ ] Fix failing tests
- [ ] Complete remaining scenarios
```

**Important:** The stop hook validates evidence patterns for features:

- `✓ X/X tests pass` — proves test suite ran
- `All N scenarios marked complete` — proves scenarios checked
- `Audit passed` — proves /audit ran (run /audit separately)

Without all three patterns, the done phase will hard block.

## Summary

This command verifies ticket criteria (Phase 7 Done Gate). Use it before marking any feature ticket complete. It also works without a ticket for quick project health checks (tests + build + lint + dep drift).

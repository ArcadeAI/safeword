---
id: 025
type: feature
phase: define-behavior
status: in_progress
parent: null
supersedes: ['022']
created: 2026-02-21T16:15:00Z
last_modified: 2026-02-21T16:15:00Z
---

# Hierarchy Navigation After Ticket Completion

**User Story:** When the agent finishes a child ticket (marks it done), I want it to automatically navigate to the next sibling ticket so work continues without me having to intervene — even when the hierarchy is multiple levels deep.

**Goal:** After completing a child ticket, the Stop hook walks the ticket hierarchy to find the next undone sibling and directs the agent to start it. When all siblings are done, cascade completion up to the parent.

## The Problem

The agent reliably runs `/done` and marks individual tickets complete. But then it stops — it doesn't know what to do next. The user has to manually say "now work on the next ticket."

This compounds with depth:

```text
Epic 013 (children: [013a, 013b, 013c, 013d, 013e])
  └── Agent completes 013a
      └── Agent stops. Doesn't navigate to 013b.
          └── If 013 is itself a child of another epic, the problem compounds.
```

**Evidence from git history:**

- 013a, 013d: Agent marked done (Co-Authored-By Claude)
- 013b, 013c: Batch-marked done by human — agent didn't close these itself
- 013 epic: Agent marked done after all children done, but only when prompted

The hierarchy information already exists in ticket frontmatter (`parent:`, `children:[]`). The agent just doesn't use it at completion time.

## The Solution

Enhance the existing Stop hook's done gate. When a ticket is in `phase: done`, walk the tree:

```text
1. Read current ticket → get parent: field
2. If no parent → allow stop (standalone ticket, nothing to navigate to)
3. Read parent ticket → get children:[] list
4. Resolve each child ID to its ticket folder (glob: tickets/{id}-*/)
5. Read each sibling's status:
6. Find next sibling where status != done (in children:[] order)
7. If found → block stop, inject "start next ticket" directive
8. If all siblings done → mark parent status: done, phase: done
9. Check if parent has a parent → recurse (step 1 with parent)
```

### The "What's Next" Algorithm

```typescript
interface NextAction {
  type: 'navigate' | 'cascade-done' | 'all-done';
  ticketId?: string;
  ticketDir?: string;
  parentId?: string;
}

function findNextWork(ticketDir: string): NextAction {
  const ticket = readTicketFrontmatter(ticketDir);

  // No parent → standalone ticket, nothing to navigate to
  if (!ticket.parent) {
    return { type: 'all-done' };
  }

  // Find parent ticket directory
  const parentDir = resolveTicketDir(ticket.parent);
  if (!parentDir) return { type: 'all-done' };

  const parent = readTicketFrontmatter(parentDir);
  const children = parent.children ?? [];

  // No children listed → broken/incomplete hierarchy, don't cascade
  if (children.length === 0) return { type: 'all-done' };

  // Find next undone sibling (in order)
  for (const childId of children) {
    const childDir = resolveTicketDir(childId);
    if (!childDir) continue;
    const child = readTicketFrontmatter(childDir);
    if (child.status !== 'done' && child.status !== 'complete') {
      return { type: 'navigate', ticketId: childId, ticketDir: childDir };
    }
  }

  // All siblings done → cascade: mark parent done, recurse
  return { type: 'cascade-done', parentId: ticket.parent, ticketDir: parentDir };
}
```

### Parsing Frontmatter

The `children:` and `parent:` fields have inconsistent formats across existing tickets:

- `children: [006, 007, 008, 009, 010]` (unquoted numbers)
- `children: ['013a', '013b', '013c', '013d', '013e']` (quoted strings)
- `parent: 001` (unquoted number)
- `parent: '013'` (quoted string)
- `parent: null` or absent

Use the `yaml` package (already a project dependency at `^2.7.0`) to parse frontmatter reliably instead of regex. Coerce all IDs to strings after parsing.

### Resolving Ticket ID → Directory

Children are stored as IDs (`['013a', '013b']`), but directories are `013a-bdd-skill-compression/`. The existing `getCurrentTicketInfo()` in `stop-quality.ts` already does folder scanning. Reuse that pattern:

```typescript
function resolveTicketDir(ticketId: string): string | null {
  const ticketsDir = `${projectDir}/.safeword-project/tickets`;
  const dirs = readdirSync(ticketsDir).filter(d => d.startsWith(`${ticketId}-`));
  if (dirs.length === 1) return `${ticketsDir}/${dirs[0]}`;
  return null;
}
```

### Stop Hook Integration

In `stop-quality.ts`, REPLACE both `process.exit(0)` calls in the done gate's success paths (one for features at the test+scenario evidence check, one for tasks/patches at the test evidence check). Refactor to converge to a single point, then run hierarchy navigation before allowing stop:

```typescript
// In the done gate, where process.exit(0) currently lives after evidence check:
// REPLACE process.exit(0) with hierarchy navigation

const ticketDir = `${ticketsDir}/${ticketInfo.folder}`;

// CRITICAL: Mark current ticket done BEFORE walking hierarchy.
// getCurrentTicketInfo() only finds in_progress tickets, so when this code runs
// the current ticket is still status: in_progress, phase: done. Without this,
// findNextWork would see the current ticket as undone and navigate back to it.
updateTicketStatus(ticketDir, 'done', 'done');

const MAX_DEPTH = 5;
let currentDir = ticketDir;
let cascadedParents: string[] = [];

for (let depth = 0; depth < MAX_DEPTH; depth++) {
  const next = findNextWork(currentDir);

  if (next.type === 'navigate') {
    const cascadeMsg = cascadedParents.length
      ? ` Parents marked done: ${cascadedParents.join(', ')}.`
      : '';
    softBlock(`Ticket complete.${cascadeMsg}

Next ticket: ${next.ticketId}
Read ${next.ticketDir}/ticket.md and begin work on it.`);
    break; // softBlock exits, but for clarity
  }

  if (next.type === 'cascade-done') {
    // Mark parent done, continue up the tree
    updateTicketStatus(next.ticketDir!, 'done', 'done');
    cascadedParents.push(next.parentId!);
    currentDir = next.ticketDir!;
    continue; // Check parent's parent
  }

  // 'all-done' — standalone ticket or entire tree complete
  process.exit(0);
}

// Max depth reached — allow stop rather than infinite loop
process.exit(0);
```

### Updating Ticket Status

```typescript
function updateTicketStatus(ticketDir: string, newStatus: string, newPhase: string): void {
  const ticketPath = `${ticketDir}/ticket.md`;
  let content = readFileSync(ticketPath, 'utf-8');
  content = content.replace(/^status:\s*\S+/m, `status: ${newStatus}`);
  content = content.replace(/^phase:\s*\S+/m, `phase: ${newPhase}`);
  content = content.replace(/^last_modified:\s*.+/m, `last_modified: ${new Date().toISOString()}`);
  writeFileSync(ticketPath, content);
}
```

## Edge Cases

| Case                         | Handling                                         |
| ---------------------------- | ------------------------------------------------ |
| No parent field              | Allow stop (standalone ticket)                   |
| Parent directory not found   | Allow stop (broken hierarchy)                    |
| Children field empty/missing | Allow stop                                       |
| Child directory not found    | Skip that child, try next                        |
| All children already done    | Cascade parent to done, recurse                  |
| Circular parent references   | Max recursion depth (5 levels)                   |
| Parent is an epic            | Still works — epic's children are features/tasks |
| Ticket has no status field   | Treat as not-done                                |

## What This Does NOT Do

- **No runtime state machine** — walks the filesystem at done-time only
- **No stack** — reads `parent:` and `children:[]` from frontmatter
- **No history tracking** — tickets ARE the history
- **No work level assessment** — already in SAFEWORD.md
- **No dynamic child creation** — that's the BDD skill's job

## Acceptance Criteria

- [ ] Stop hook navigates to next undone sibling after ticket completion
- [ ] Sibling order follows `children:[]` array order in parent ticket
- [ ] When all siblings done, parent ticket auto-marked `status: done, phase: done`
- [ ] Cascading works at least 3 levels deep (child → parent → grandparent)
- [ ] Max recursion depth prevents infinite loops
- [ ] Standalone tickets (no parent) allow normal stop
- [ ] Broken hierarchy (missing dirs) degrades gracefully
- [ ] Navigation directive includes ticket path for the agent to read

## Testing

1. Complete child ticket with undone siblings → blocks stop, shows "next ticket: [sibling]"
2. Complete last child in a parent → parent auto-marked done
3. Complete last child whose parent has undone siblings → cascades up, navigates to parent's next sibling
4. Complete standalone ticket (no parent) → normal stop allowed
5. Parent directory missing → graceful fallback, stop allowed
6. Children field empty → stop allowed

## Work Log

---

- 2026-02-21T16:15:00Z Created: Extracted hierarchy navigation from 022, simplified to filesystem walk

---

---
id: 018a
type: feature
phase: intake
status: cancelled
parent: 018
created: 2026-01-10T20:42:00Z
last_modified: 2026-01-10T20:42:00Z
---

# Unified Hook I/O Library

**User Story:** When I write a new Safeword hook, I want one implementation that works in both Claude Code and Cursor without adapter files.

**Goal:** Create `lib/io.ts` that normalizes input/output across IDEs, eliminating `.safeword/hooks/cursor/`.

**Parent:** [018 - IDE Parity](../018-ide-parity/ticket.md)

## The Problem

Currently hooks need separate adapters for each IDE:

```
.safeword/hooks/
  post-tool-lint.ts       # Claude Code version
  stop-quality.ts         # Claude Code version
  cursor/
    after-file-edit.ts    # Cursor adapter
    stop.ts               # Cursor adapter (not phase-aware - bug)
```

**Why:** Input format and output format differ between IDEs.

## Solution

Create `lib/io.ts` that detects IDE at runtime and normalizes I/O:

```typescript
// .safeword/hooks/lib/io.ts

interface NormalizedInput {
  projectDir: string;
  filePath?: string;
  toolName?: string;
  transcriptPath?: string;
  conversationId?: string;
}

export async function parseInput(): Promise<NormalizedInput> {
  const raw = await Bun.stdin.json();

  // Claude Code: uses env var for project dir
  if (process.env.CLAUDE_PROJECT_DIR) {
    return {
      projectDir: process.env.CLAUDE_PROJECT_DIR,
      filePath: raw.tool_input?.file_path ?? raw.tool_input?.notebook_path,
      toolName: raw.tool_name,
      transcriptPath: raw.transcript_path,
    };
  }

  // Cursor: uses payload for project dir
  return {
    projectDir: raw.workspace_roots?.[0] ?? process.cwd(),
    filePath: raw.file_path,
    conversationId: raw.conversation_id,
  };
}

export function outputBlock(message: string): void {
  if (process.env.CLAUDE_PROJECT_DIR) {
    // Claude Code: JSON with decision field
    console.log(JSON.stringify({ decision: 'block', reason: message }));
  } else {
    // Cursor: JSON with followup_message
    console.log(JSON.stringify({ followup_message: message }));
  }
}

export function isClaudeCode(): boolean {
  return !!process.env.CLAUDE_PROJECT_DIR;
}
```

## Implementation

### Step 1: Create lib/io.ts

Add the normalized I/O library.

### Step 2: Refactor post-tool-lint.ts

```typescript
// Before: reads tool_input directly
const file = input.tool_input?.file_path;

// After: uses parseInput()
import { parseInput } from './lib/io.ts';
const { filePath, projectDir } = await parseInput();
```

### Step 3: Refactor stop-quality.ts

Use `outputBlock()` for consistent output format.

### Step 4: Delete cursor/ adapters

- Remove `hooks/cursor/after-file-edit.ts`
- Remove `hooks/cursor/stop.ts`

### Step 5: Update Cursor hooks.json

Point directly to unified hooks:

```json
{
  "version": 1,
  "hooks": {
    "afterFileEdit": [{ "command": "bun ./.safeword/hooks/post-tool-lint.ts" }],
    "stop": [{ "command": "bun ./.safeword/hooks/stop-quality.ts" }]
  }
}
```

## Acceptance Criteria

- [ ] `lib/io.ts` created with `parseInput()` and `outputBlock()`
- [ ] `post-tool-lint.ts` works in both IDEs (one file)
- [ ] `stop-quality.ts` works in both IDEs (one file)
- [ ] `hooks/cursor/` directory deleted
- [ ] `.cursor/hooks.json` points to unified hooks
- [ ] Tests pass in both Claude Code and Cursor

## Testing

1. In Claude Code: edit a file → lint runs
2. In Cursor: edit a file → lint runs
3. In Claude Code: stop → quality review appears
4. In Cursor: stop → quality review appears (with phase-awareness after 017b)

## Work Log

---

- 2026-01-10T20:42:00Z Created: Unified hook I/O to eliminate adapter files

---

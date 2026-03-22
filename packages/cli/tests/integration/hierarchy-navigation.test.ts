/**
 * Integration Test: Hierarchy Navigation (Ticket #025)
 *
 * Verifies that the stop hook navigates to the next sibling ticket
 * after completing a child ticket:
 * - Soft-blocks with "next ticket" directive when undone siblings exist
 * - Cascades parent to done when all siblings are done
 * - Handles multi-level cascading
 * - Allows stop for standalone tickets (no parent)
 * - Gracefully handles broken hierarchy (missing dirs, empty children)
 *
 * 8 scenarios from test-definitions.md.
 */

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  createTemporaryDirectory,
  removeTemporaryDirectory,
  TIMEOUT_QUICK,
  writeTestFile,
} from '../helpers';

/* eslint-disable unicorn/no-null -- Ticket frontmatter uses null values */

const SAFEWORD_ROOT = nodePath.resolve(import.meta.dirname, '../../../..');
const STOP_QUALITY = nodePath.join(SAFEWORD_ROOT, '.safeword/hooks/stop-quality.ts');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a ticket.md with frontmatter */
function createTicket(
  projectDirectory: string,
  slug: string,
  frontmatter: Record<string, unknown>,
): void {
  const lines = ['---'];
  for (const [key, value] of Object.entries(frontmatter)) {
    if (Array.isArray(value)) {
      const items = value.map(v => `'${v}'`);
      lines.push(`${key}: [${items.join(', ')}]`);
    } else if (value === null) {
      lines.push(`${key}: null`);
    } else {
      lines.push(`${key}: ${value as string | number}`);
    }
  }
  lines.push('---', '', `# ${slug}`);
  writeTestFile(projectDirectory, `.safeword-project/tickets/${slug}/ticket.md`, lines.join('\n'));
}

/** Create a minimal transcript with evidence for the done gate */
function createTranscript(projectDirectory: string, evidence: string): string {
  const transcriptPath = nodePath.join(projectDirectory, 'transcript.jsonl');
  const message = {
    type: 'assistant',
    message: {
      role: 'assistant',
      content: [
        { type: 'tool_use', name: 'Edit' },
        { type: 'text', text: evidence },
      ],
    },
  };
  writeTestFile(projectDirectory, 'transcript.jsonl', JSON.stringify(message));
  return transcriptPath;
}

/** Run the stop hook with a transcript and last_assistant_message evidence */
function runStopHook(projectDirectory: string, transcriptPath: string, lastAssistantMessage = '') {
  return spawnSync('bun', [STOP_QUALITY], {
    input: JSON.stringify({
      transcript_path: transcriptPath,
      last_assistant_message: lastAssistantMessage,
    }),
    cwd: projectDirectory,
    env: { ...process.env, CLAUDE_PROJECT_DIR: projectDirectory },
    encoding: 'utf8',
    timeout: TIMEOUT_QUICK,
  });
}

/** Create a test project with .safeword dir (required for hook to run) */
function createTestProject(): string {
  const directory = createTemporaryDirectory();
  writeTestFile(directory, '.safeword/.gitkeep', '');
  return directory;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

let projectDirectory: string;

beforeEach(() => {
  projectDirectory = createTestProject();
});

afterEach(() => {
  removeTemporaryDirectory(projectDirectory);
});

describe('hierarchy navigation in stop hook', () => {
  // Evidence that passes the done gate for features
  const featureEvidence = '✓ 15/15 tests pass\nAll 8 scenarios marked complete\nAudit passed';
  // Evidence that passes the done gate for tasks
  const taskEvidence = '✓ 15/15 tests pass';

  // Scenario 1: Navigate to next undone sibling
  it('soft-blocks with next sibling directive', () => {
    createTicket(projectDirectory, '001-epic', {
      id: "'001'",
      type: 'epic',
      status: 'in_progress',
      phase: 'planning',
      children: ['001a', '001b', '001c'],
    });

    // Current ticket — in_progress but phase: done (done gate will check evidence)
    createTicket(projectDirectory, '001a-feature', {
      id: "'001a'",
      type: 'feature',
      status: 'in_progress',
      phase: 'done',
      parent: "'001'",
      last_modified: '2026-01-01T00:00:00Z',
    });
    // Features at done phase require test-definitions.md (cumulative artifact check)
    writeTestFile(
      projectDirectory,
      '.safeword-project/tickets/001a-feature/test-definitions.md',
      '- [x] scenario 1',
    );

    // Next sibling — not done
    createTicket(projectDirectory, '001b-feature', {
      id: "'001b'",
      type: 'feature',
      status: 'ready',
      phase: 'intake',
      parent: "'001'",
      last_modified: '2026-01-01T00:00:00Z',
    });

    createTicket(projectDirectory, '001c-feature', {
      id: "'001c'",
      type: 'feature',
      status: 'ready',
      phase: 'intake',
      parent: "'001'",
      last_modified: '2026-01-01T00:00:00Z',
    });

    const transcriptPath = createTranscript(projectDirectory, featureEvidence);
    const result = runStopHook(projectDirectory, transcriptPath, featureEvidence);

    // Should soft-block with navigation directive
    expect(result.status).toBe(0);
    const output = JSON.parse(result.stdout.trim());
    expect(output.decision).toBe('block');
    expect(output.reason).toContain('001b');
    expect(output.reason).toContain('ticket.md');

    // Current ticket should be marked done
    const currentContent = readFileSync(
      nodePath.join(projectDirectory, '.safeword-project/tickets/001a-feature/ticket.md'),
      'utf8',
    );
    expect(currentContent).toMatch(/^status: done$/m);
  });

  // Scenario 3: All siblings done — cascade parent to done
  it('marks parent done when all siblings are done', () => {
    createTicket(projectDirectory, '013-epic', {
      id: "'013'",
      type: 'epic',
      status: 'in_progress',
      phase: 'planning',
      children: ['013a', '013b'],
    });

    createTicket(projectDirectory, '013a-feat', {
      id: "'013a'",
      type: 'task',
      status: 'done',
      phase: 'done',
      parent: "'013'",
      last_modified: '2026-01-01T00:00:00Z',
    });

    // Current ticket — last undone sibling
    createTicket(projectDirectory, '013b-feat', {
      id: "'013b'",
      type: 'task',
      status: 'in_progress',
      phase: 'done',
      parent: "'013'",
      last_modified: '2026-01-01T00:00:00Z',
    });

    const transcriptPath = createTranscript(projectDirectory, taskEvidence);
    const result = runStopHook(projectDirectory, transcriptPath, taskEvidence);

    // Should allow stop (no more siblings, parent has no parent)
    expect(result.status).toBe(0);
    // stdout should be empty (no block) since parent is standalone
    expect(result.stdout.trim()).toBe('');

    // Parent should be marked done
    const parentContent = readFileSync(
      nodePath.join(projectDirectory, '.safeword-project/tickets/013-epic/ticket.md'),
      'utf8',
    );
    expect(parentContent).toMatch(/^status: done$/m);
    expect(parentContent).toMatch(/^phase: done$/m);
  });

  // Scenario 4: Multi-level cascade
  it('cascades up and navigates to parent sibling', () => {
    // Grandparent
    createTicket(projectDirectory, '001-grand-epic', {
      id: "'001'",
      type: 'epic',
      status: 'in_progress',
      phase: 'planning',
      children: ['013', '014'],
    });

    // Parent — all children about to be done
    createTicket(projectDirectory, '013-epic', {
      id: "'013'",
      type: 'epic',
      status: 'in_progress',
      phase: 'planning',
      parent: "'001'",
      children: ['013a'],
    });

    // Current ticket — last child of 013
    createTicket(projectDirectory, '013a-feat', {
      id: "'013a'",
      type: 'task',
      status: 'in_progress',
      phase: 'done',
      parent: "'013'",
      last_modified: '2026-01-01T00:00:00Z',
    });

    // Uncle sibling — not done
    createTicket(projectDirectory, '014-epic', {
      id: "'014'",
      type: 'epic',
      status: 'ready',
      phase: 'intake',
      parent: "'001'",
      last_modified: '2026-01-01T00:00:00Z',
    });

    const transcriptPath = createTranscript(projectDirectory, taskEvidence);
    const result = runStopHook(projectDirectory, transcriptPath, taskEvidence);

    // Should soft-block navigating to 014
    expect(result.status).toBe(0);
    const output = JSON.parse(result.stdout.trim());
    expect(output.decision).toBe('block');
    expect(output.reason).toContain('014');

    // Parent 013 should be marked done (cascaded)
    const parentContent = readFileSync(
      nodePath.join(projectDirectory, '.safeword-project/tickets/013-epic/ticket.md'),
      'utf8',
    );
    expect(parentContent).toMatch(/^status: done$/m);
  });

  // Scenario 5: Standalone ticket — allow stop
  it('allows stop for standalone ticket with no parent', () => {
    createTicket(projectDirectory, '025-standalone', {
      id: "'025'",
      type: 'feature',
      status: 'in_progress',
      phase: 'done',
      parent: null,
      last_modified: '2026-01-01T00:00:00Z',
    });
    // Features at done phase require test-definitions.md
    writeTestFile(
      projectDirectory,
      '.safeword-project/tickets/025-standalone/test-definitions.md',
      '- [x] scenario 1',
    );

    const transcriptPath = createTranscript(projectDirectory, featureEvidence);
    const result = runStopHook(projectDirectory, transcriptPath, featureEvidence);

    // Should allow stop (no parent = no hierarchy to navigate)
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe('');
  });

  // Scenario 6: Broken hierarchy — parent directory missing
  it('allows stop when parent directory is missing', () => {
    createTicket(projectDirectory, '050-orphan', {
      id: "'050'",
      type: 'task',
      status: 'in_progress',
      phase: 'done',
      parent: "'999'",
      last_modified: '2026-01-01T00:00:00Z',
    });

    const transcriptPath = createTranscript(projectDirectory, taskEvidence);
    const result = runStopHook(projectDirectory, transcriptPath, taskEvidence);

    // Should allow stop (broken hierarchy = graceful fallback)
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe('');
  });

  // Scenario 7: Children field empty
  it('allows stop when parent has no children field', () => {
    createTicket(projectDirectory, '016-epic', {
      id: "'016'",
      type: 'epic',
      status: 'in_progress',
      phase: 'planning',
    });

    createTicket(projectDirectory, '016a-feat', {
      id: "'016a'",
      type: 'task',
      status: 'in_progress',
      phase: 'done',
      parent: "'016'",
      last_modified: '2026-01-01T00:00:00Z',
    });

    const transcriptPath = createTranscript(projectDirectory, taskEvidence);
    const result = runStopHook(projectDirectory, transcriptPath, taskEvidence);

    // Should allow stop (empty children = nothing to navigate)
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe('');
  });
});

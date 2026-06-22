import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  READINESS_POINTER,
  READINESS_POINTER_WORD_CAP,
  shouldSurfaceReadiness,
} from '../../../../.safeword/hooks/lib/readiness-pointer';
import {
  createTemporaryDirectory,
  readRepoFile,
  removeTemporaryDirectory,
  repoRoot,
} from '../helpers';

function runPromptHook(projectDirectory: string): string {
  const result = spawnSync('bun', ['.safeword/hooks/prompt-questions.ts'], {
    cwd: repoRoot,
    env: { ...process.env, CLAUDE_PROJECT_DIR: projectDirectory },
    input: '{}',
    encoding: 'utf8',
  });
  return result.stdout;
}

// Build a throwaway safeword project, optionally with an active ticket at a given
// phase/status, run the prompt hook against it, and return its output. The hook
// runs with input {} (no session_id), so it reads quality-state-undefined.json
// under the default .project namespace.
function hookOutputForProject(ticket?: { phase: string; status: string }): string {
  const project = createTemporaryDirectory();
  try {
    mkdirSync(nodePath.join(project, '.safeword'), { recursive: true });
    if (ticket) {
      const ticketDirectory = nodePath.join(project, '.project', 'tickets', 'AAA111-demo');
      mkdirSync(ticketDirectory, { recursive: true });
      writeFileSync(
        nodePath.join(ticketDirectory, 'ticket.md'),
        `---\nid: AAA111\nslug: demo\ntype: task\nphase: ${ticket.phase}\nstatus: ${ticket.status}\n---\n\n# Demo\n`,
      );
      writeFileSync(
        nodePath.join(project, '.project', 'quality-state-undefined.json'),
        JSON.stringify({ activeTicket: 'AAA111' }),
      );
    }
    return runPromptHook(project);
  } finally {
    removeTemporaryDirectory(project);
  }
}

describe('readiness pointer (TPP6Y2)', () => {
  // Rule: surfaces only during Clarify (decision logic)
  it('surfaces when there is no active ticket (pre-classify)', () => {
    expect(shouldSurfaceReadiness(undefined)).toBe(true);
  });

  it('surfaces during the intake phase', () => {
    expect(shouldSurfaceReadiness('intake')).toBe(true);
  });

  it('is suppressed once a build phase is under way', () => {
    expect(shouldSurfaceReadiness('implement')).toBe(false);
  });

  it.each(['define-behavior', 'scenario-gate', 'verify', 'done'])(
    'is suppressed during the %s build phase',
    phase => {
      expect(shouldSurfaceReadiness(phase)).toBe(false);
    },
  );

  // Rule: compressed pointer, not a checklist
  it('names all five dimensions', () => {
    const text = READINESS_POINTER.toLowerCase();
    expect(text).toContain('intent');
    expect(text).toContain('done');
    expect(text).toContain('must not break');
    expect(text).toContain('riskiest assumption');
    expect(text).toContain('problem or guess');
  });

  it('stays within the length cap (no spelled-out prompts)', () => {
    const words = READINESS_POINTER.trim().split(/\s+/).length;
    expect(words).toBeLessThanOrEqual(READINESS_POINTER_WORD_CAP);
  });

  it('scopes the constraint dimension to what must not break, not an NFR survey', () => {
    const text = READINESS_POINTER.toLowerCase();
    expect(text).toContain('must not break');
    expect(text).toContain('revers');
    expect(text).not.toContain('quality attribute');
  });

  // Rule: SAFEWORD.md carries the triage guidance
  it('SAFEWORD.md states the value-of-information triage', () => {
    const safeword = readRepoFile('packages/cli/templates/SAFEWORD.md');
    expect(safeword.toLowerCase()).toContain('reversible');
    expect(safeword.toLowerCase()).toContain('irreversible');
  });

  it('SAFEWORD.md defines readiness as edge-case-level questions', () => {
    const safeword = readRepoFile('packages/cli/templates/SAFEWORD.md');
    expect(safeword.toLowerCase()).toContain('edge-case');
    expect(safeword.toLowerCase()).toContain('not basics');
  });

  // Hook-output wiring: prompt-questions.ts actually surfaces / suppresses it
  it('prompt-questions.ts surfaces the pointer when no ticket is active', () => {
    expect(hookOutputForProject()).toContain('must not break');
  });

  it('prompt-questions.ts suppresses the pointer during the implement phase', () => {
    expect(hookOutputForProject({ phase: 'implement', status: 'in_progress' })).not.toContain(
      'must not break',
    );
  });

  it('prompt-questions.ts surfaces the pointer when the active ticket is not in progress', () => {
    // Implement phase but status done → not in_progress → back in Clarify.
    expect(hookOutputForProject({ phase: 'implement', status: 'done' })).toContain(
      'must not break',
    );
  });
});

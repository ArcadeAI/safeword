import { execSync, spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  READINESS_POINTER,
  READINESS_POINTER_WORD_CAP,
  shouldSurfaceReadiness,
} from '../../../../.safeword/hooks/lib/readiness-pointer';
import { createTemporaryDirectory, removeTemporaryDirectory } from '../helpers';

const repoRoot = execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).trim();

function runPromptHook(projectDirectory: string): string {
  const result = spawnSync('bun', ['.safeword/hooks/prompt-questions.ts'], {
    cwd: repoRoot,
    env: { ...process.env, CLAUDE_PROJECT_DIR: projectDirectory },
    input: '{}',
    encoding: 'utf8',
  });
  return result.stdout;
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
    const safeword = readFileSync(
      nodePath.join(repoRoot, 'packages/cli/templates/SAFEWORD.md'),
      'utf8',
    );
    expect(safeword.toLowerCase()).toContain('reversible');
    expect(safeword.toLowerCase()).toContain('irreversible');
  });

  it('SAFEWORD.md defines readiness as edge-case-level questions', () => {
    const safeword = readFileSync(
      nodePath.join(repoRoot, 'packages/cli/templates/SAFEWORD.md'),
      'utf8',
    );
    expect(safeword.toLowerCase()).toContain('edge-case');
    expect(safeword.toLowerCase()).toContain('not basics');
  });

  // Hook-output wiring: prompt-questions.ts actually surfaces / suppresses it
  it('prompt-questions.ts surfaces the pointer when no ticket is active', () => {
    const project = createTemporaryDirectory();
    try {
      mkdirSync(nodePath.join(project, '.safeword'), { recursive: true });
      const output = runPromptHook(project);
      expect(output).toContain('must not break');
    } finally {
      removeTemporaryDirectory(project);
    }
  });

  it('prompt-questions.ts suppresses the pointer during the implement phase', () => {
    const project = createTemporaryDirectory();
    try {
      mkdirSync(nodePath.join(project, '.safeword'), { recursive: true });
      const ticketDirectory = nodePath.join(project, '.project', 'tickets', 'AAA111-demo');
      mkdirSync(ticketDirectory, { recursive: true });
      writeFileSync(
        nodePath.join(ticketDirectory, 'ticket.md'),
        '---\nid: AAA111\nslug: demo\ntype: task\nphase: implement\nstatus: in_progress\n---\n\n# Demo\n',
      );
      // The hook runs with input {} (no session_id), so it reads
      // <namespace-root>/quality-state-undefined.json (default namespace .project).
      const namespaceDirectory = nodePath.join(project, '.project');
      mkdirSync(namespaceDirectory, { recursive: true });
      writeFileSync(
        nodePath.join(namespaceDirectory, 'quality-state-undefined.json'),
        JSON.stringify({ activeTicket: 'AAA111' }),
      );

      const output = runPromptHook(project);
      expect(output).not.toContain('must not break');
    } finally {
      removeTemporaryDirectory(project);
    }
  });

  it('prompt-questions.ts surfaces the pointer when the active ticket is not in progress', () => {
    const project = createTemporaryDirectory();
    try {
      mkdirSync(nodePath.join(project, '.safeword'), { recursive: true });
      const ticketDirectory = nodePath.join(project, '.project', 'tickets', 'AAA111-demo');
      mkdirSync(ticketDirectory, { recursive: true });
      // Implement phase but status done → not in_progress → back in Clarify.
      writeFileSync(
        nodePath.join(ticketDirectory, 'ticket.md'),
        '---\nid: AAA111\nslug: demo\ntype: task\nphase: implement\nstatus: done\n---\n\n# Demo\n',
      );
      writeFileSync(
        nodePath.join(project, '.project', 'quality-state-undefined.json'),
        JSON.stringify({ activeTicket: 'AAA111' }),
      );
      const output = runPromptHook(project);
      expect(output).toContain('must not break');
    } finally {
      removeTemporaryDirectory(project);
    }
  });
});

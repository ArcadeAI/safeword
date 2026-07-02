/**
 * Integration tests for Codex Stop-hook architecture drift nudges.
 *
 * Codex Stop is a continuation surface, not a hard done gate: `decision: "block"`
 * creates a follow-up prompt. The architecture document nudge should use that
 * continuation shape only when done-phase work moved the generated architecture
 * fingerprint.
 */

import { execSync, spawnSync } from 'node:child_process';
import nodePath from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { ARCHITECTURE_DOCUMENT_NUDGE } from '../../templates/hooks/lib/architecture-document-nudge.js';
import {
  createTemporaryDirectory,
  initGitRepo,
  removeTemporaryDirectory,
  writeTestFile,
} from '../helpers';

const SAFEWORD_ROOT = nodePath.resolve(import.meta.dirname, '../../../..');
const CODEX_STOP = nodePath.join(SAFEWORD_ROOT, 'packages/cli/templates/hooks/codex/stop.ts');

function generatedArchitectureDocument(fingerprint: string): string {
  return `---\ngenerator: safeword-architecture\nfingerprint: ${fingerprint}\n---\n\n# Architecture\n`;
}

function buildProject(options: { phase: string; architectureDrift?: boolean }): string {
  const cwd = createTemporaryDirectory();
  initGitRepo(cwd);
  writeTestFile(cwd, '.safeword/.gitkeep', '');
  writeTestFile(cwd, 'ARCHITECTURE.md', '# Architecture\n\nHuman narrative.\n');
  writeTestFile(
    cwd,
    '.project/architecture.generated.md',
    generatedArchitectureDocument('base-fp'),
  );
  writeTestFile(
    cwd,
    '.project/tickets/C0DEX1-demo/ticket.md',
    [
      '---',
      'id: C0DEX1',
      'status: in_progress',
      'type: task',
      `phase: ${options.phase}`,
      '---',
    ].join('\n'),
  );
  execSync('git add . && git commit -qm base', { cwd, stdio: 'pipe' });

  if (options.architectureDrift === true) {
    const baseBranch = execSync('git branch --show-current', { cwd, encoding: 'utf8' }).trim();
    execSync('git checkout -q -b feature-architecture-drift', { cwd, stdio: 'pipe' });
    execSync(`git branch --set-upstream-to=${baseBranch} feature-architecture-drift`, {
      cwd,
      stdio: 'pipe',
    });
    writeTestFile(
      cwd,
      '.project/architecture.generated.md',
      generatedArchitectureDocument('moved-fp'),
    );
  }

  return cwd;
}

function runCodexStop(cwd: string, input: Record<string, unknown> = {}) {
  return spawnSync('bun', [CODEX_STOP], {
    cwd,
    input: JSON.stringify({
      session_id: 'codex-session',
      stop_hook_active: false,
      last_assistant_message: 'Done.',
      ...input,
    }),
    env: { ...process.env, CLAUDE_PROJECT_DIR: cwd, SAFEWORD_AGENT_RUNTIME: 'codex' },
    encoding: 'utf8',
    timeout: 20_000,
  });
}

describe('Codex Stop architecture drift nudge', () => {
  let cwd = '';

  afterEach(() => {
    if (cwd) removeTemporaryDirectory(cwd);
    cwd = '';
  });

  it('emits the architecture drift advisory as a continuation nudge for done-phase work', () => {
    cwd = buildProject({ phase: 'done', architectureDrift: true });

    const result = runCodexStop(cwd);

    expect(result.status).toBe(0);
    const parsed = JSON.parse((result.stdout ?? '').trim()) as {
      decision?: string;
      reason?: string;
    };
    expect(parsed.decision).toBe('block');
    expect(parsed.reason).toContain(ARCHITECTURE_DOCUMENT_NUDGE);
  });

  it('stays silent outside done-phase work', () => {
    cwd = buildProject({ phase: 'implement', architectureDrift: true });

    const result = runCodexStop(cwd);

    expect(result.status).toBe(0);
    expect(result.stdout).toBe('');
    expect(result.stderr).toBe('');
  });

  it('stays silent when no architecture drift is detected', () => {
    cwd = buildProject({ phase: 'done', architectureDrift: false });

    const result = runCodexStop(cwd);

    expect(result.status).toBe(0);
    expect(result.stdout).toBe('');
    expect(result.stderr).toBe('');
  });

  it('does not re-enter when a Codex Stop continuation is already active', () => {
    cwd = buildProject({ phase: 'done', architectureDrift: true });

    const result = runCodexStop(cwd, { stop_hook_active: true });

    expect(result.status).toBe(0);
    expect(result.stdout).toBe('');
    expect(result.stderr).toBe('');
  });
});

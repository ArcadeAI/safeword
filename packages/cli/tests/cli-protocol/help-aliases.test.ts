import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

import { createTemporaryDirectory, runCli } from '../helpers.js';

describe('canonical help and compatibility aliases', () => {
  it('shows the simplified hierarchy and hides legacy and hook helpers', async () => {
    const result = await runCli(['--help']);

    for (const canonical of [
      'status',
      'setup',
      'plan',
      'doctor',
      'remove',
      'project',
      'tracker',
      'codex',
      'ticket',
      'retro',
      'capabilities',
    ]) {
      expect(result.stdout).toContain(canonical);
    }
    const helpLines = result.stdout.split('\n').map(line => line.trimStart());
    for (const hidden of ['check', 'diff', 'reset', 'boundary', 'codex-hook']) {
      expect(helpLines.some(line => line === hidden || line.startsWith(`${hidden} `))).toBe(false);
    }
  });

  it.each([
    ['check', 'status'],
    ['diff', 'plan'],
    ['reset', 'remove'],
    ['retro', 'retro run'],
  ])('runs %s as a JSON-compatible alias for %s', async (legacy, replacement) => {
    const directory = createTemporaryDirectory();
    const result = await runCli([legacy, '--json', '--no-input', '--offline', '--cwd', directory], {
      cwd: directory,
    });

    const envelope = JSON.parse(result.stdout) as {
      findings: { code: string; metadata: { replacement: string } }[];
    };
    expect(envelope.findings).toContainEqual(
      expect.objectContaining({
        code: 'CLI_ALIAS_DEPRECATED',
        metadata: expect.objectContaining({ replacement }),
      }),
    );
  });

  it('retains the diff -v argument spelling', async () => {
    const directory = createTemporaryDirectory();
    const result = await runCli(['diff', '-v', '--json', '--no-input', '--offline'], {
      cwd: directory,
    });

    expect(result.stderr).toBe('');
    const envelope = JSON.parse(result.stdout) as {
      state: string;
      findings: { code: string }[];
    };
    expect(envelope.state).toBe('action_required');
    expect(envelope.findings.map(finding => finding.code)).toContain('RECONCILIATION_AVAILABLE');
  });

  it('accepts reset -y safely without applying an unbound destructive plan', async () => {
    const directory = createTemporaryDirectory();
    const safewordDirectory = nodePath.join(directory, '.safeword');
    mkdirSync(safewordDirectory);
    writeFileSync(nodePath.join(safewordDirectory, 'version'), '0.69.0\n');

    const result = await runCli(['reset', '-y', '--json', '--no-input', '--cwd', directory], {
      cwd: directory,
    });

    expect(result.exitCode).toBe(2);
    expect(existsSync(safewordDirectory)).toBe(true);
    const envelope = JSON.parse(result.stdout) as {
      state: string;
      changed: boolean;
      findings: { code: string }[];
      data: { plan: { id: string; requires_confirmation: boolean } };
    };
    expect(envelope).toMatchObject({
      state: 'action_required',
      changed: false,
      data: {
        plan: {
          id: expect.stringMatching(/^[a-f\d]{64}$/),
          requires_confirmation: true,
        },
      },
    });
    expect(envelope.findings.map(finding => finding.code)).toEqual(
      expect.arrayContaining(['CONFIRMATION_REQUIRED', 'CLI_ALIAS_DEPRECATED']),
    );
  });
});

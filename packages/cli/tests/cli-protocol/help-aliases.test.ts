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
});

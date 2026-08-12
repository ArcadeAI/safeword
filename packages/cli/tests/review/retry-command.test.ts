import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { runReview } from '../../src/review/coordinator.js';
import { runCli } from '../helpers.js';

/**
 * The recovery command is copy-pasted by a builder, so a reviewed file whose
 * name begins with a hyphen must not arrive at the CLI as an option. Shell
 * quoting cannot prevent that — the argument parser, not the shell, is what
 * misreads it — so the command needs an end-of-options separator.
 */
const directories: string[] = [];

afterEach(() => {
  for (const directory of directories) rmSync(directory, { recursive: true, force: true });
  directories.length = 0;
});

function projectWithTarget(name: string): string {
  const directory = mkdtempSync(nodePath.join(tmpdir(), 'safeword-retry-'));
  directories.push(directory);
  mkdirSync(nodePath.join(directory, '.safeword'), { recursive: true });
  writeFileSync(nodePath.join(directory, name), 'bounded review input\n');
  return directory;
}

async function recoveryCommandFor(name: string): Promise<string> {
  const directory = projectWithTarget(name);
  // Pin the author identity rather than inheriting the host test runner. No
  // reviewer is on PATH, so every route fails and the result carries recovery.
  const originalPath = process.env.PATH;
  const originalRuntime = process.env.SAFEWORD_AGENT_RUNTIME;
  process.env.PATH = '/nonexistent-for-this-test';
  process.env.SAFEWORD_AGENT_RUNTIME = 'claude';
  try {
    const result = await runReview({ cwd: directory, kind: 'quality-review', targets: [name] });
    return result.recovery?.[0]?.command ?? '';
  } finally {
    if (originalPath === undefined) delete process.env.PATH;
    else process.env.PATH = originalPath;
    if (originalRuntime === undefined) delete process.env.SAFEWORD_AGENT_RUNTIME;
    else process.env.SAFEWORD_AGENT_RUNTIME = originalRuntime;
  }
}

describe('the recovery command Safeword suggests', () => {
  it.each([
    ['a name that looks like a flag', '--help'],
    ['a name that looks like an option with a value', '--cwd'],
    ['a short flag', '-r'],
  ])('keeps %s a filename, not an option', async (_label, name) => {
    const command = await recoveryCommandFor(name);

    expect(command).toContain(name);
    // `--` ends option parsing, so everything after it is a positional target.
    const separator = command.indexOf(' -- ');
    expect(separator, `no end-of-options separator in: ${command}`).toBeGreaterThan(-1);
    expect(command.slice(separator).includes(name)).toBe(true);
  });

  it('still reads naturally for an ordinary filename', async () => {
    const command = await recoveryCommandFor('review-input.md');

    expect(command).toBe('safeword review run quality-review -- review-input.md');
  });

  it('preserves supporting context in the suggested retry', async () => {
    const directory = projectWithTarget('review-input.md');
    writeFileSync(nodePath.join(directory, 'evidence.md'), 'supporting evidence\n');
    const originalPath = process.env.PATH;
    const originalRuntime = process.env.SAFEWORD_AGENT_RUNTIME;
    process.env.PATH = '/nonexistent-for-this-test';
    process.env.SAFEWORD_AGENT_RUNTIME = 'claude';
    try {
      const result = await runReview({
        cwd: directory,
        kind: 'quality-review',
        targets: ['review-input.md'],
        context: ['evidence.md'],
      });

      expect(result.recovery?.[0]?.command).toBe(
        'safeword review run quality-review --context evidence.md -- review-input.md',
      );
    } finally {
      if (originalPath === undefined) delete process.env.PATH;
      else process.env.PATH = originalPath;
      if (originalRuntime === undefined) delete process.env.SAFEWORD_AGENT_RUNTIME;
      else process.env.SAFEWORD_AGENT_RUNTIME = originalRuntime;
    }
  });

  it('passes a flag-shaped target through the public command as a filename', async () => {
    const directory = projectWithTarget('--help');
    const result = await runCli(
      [
        'review',
        'run',
        'quality-review',
        '--json',
        '--no-input',
        '--cwd',
        directory,
        '--',
        '--help',
      ],
      {
        cwd: directory,
        env: {
          PATH: '/nonexistent-for-this-test',
          SAFEWORD_AGENT_RUNTIME: 'claude',
          SAFEWORD_NO_UPDATE_CHECK: '1',
        },
      },
    );

    expect(result.stderr).not.toContain('Usage:');
    expect(JSON.parse(result.stdout)).toMatchObject({
      state: 'action_required',
      data: {
        command: 'review run',
        status: 'blocked',
      },
    });
  });
});

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { runReview } from '../../src/review/coordinator.js';

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
  // No reviewer on PATH, so every route fails and the result carries recovery.
  const originalPath = process.env.PATH;
  process.env.PATH = '/nonexistent-for-this-test';
  try {
    const result = await runReview({ cwd: directory, kind: 'quality-review', targets: [name] });
    return result.recovery?.[0]?.command ?? '';
  } finally {
    if (originalPath === undefined) delete process.env.PATH;
    else process.env.PATH = originalPath;
  }
}

describe('the recovery command Safe Word suggests', () => {
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
});

import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, statSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { reconcileGeneratedFile } from '../../scripts/lib/reconcile-generated-file.js';

describe('reconcileGeneratedFile', () => {
  const temporaryDirectories: string[] = [];

  function outputPath(): string {
    const directory = mkdtempSync(nodePath.join(tmpdir(), 'safeword-generated-file-'));
    temporaryDirectories.push(directory);
    return nodePath.join(directory, 'generated.ts');
  }

  function runGenerator(script: string, path: string, ...arguments_: string[]) {
    return spawnSync('bun', [`scripts/${script}`, '--output', path, ...arguments_], {
      cwd: nodePath.join(import.meta.dirname, '../..'),
      encoding: 'utf8',
    });
  }

  afterEach(() => {
    for (const directory of temporaryDirectories) {
      rmSync(directory, { recursive: true, force: true });
    }
    temporaryDirectories.length = 0;
  });

  it('does not touch an identical generated file', () => {
    const path = outputPath();
    writeFileSync(path, 'same\n');
    const fixedTime = new Date('2020-01-02T03:04:05.000Z');
    utimesSync(path, fixedTime, fixedTime);
    const before = statSync(path).mtimeMs;

    expect(
      reconcileGeneratedFile({
        check: false,
        content: 'same\n',
        outputPath: path,
      }),
    ).toBe('current');

    expect(statSync(path).mtimeMs).toBe(before);
  });

  it('writes missing or changed generated output', () => {
    const path = outputPath();

    expect(
      reconcileGeneratedFile({
        check: false,
        content: 'first\n',
        outputPath: path,
      }),
    ).toBe('updated');
    expect(readFileSync(path, 'utf8')).toBe('first\n');

    expect(
      reconcileGeneratedFile({
        check: false,
        content: 'second\n',
        outputPath: path,
      }),
    ).toBe('updated');
    expect(readFileSync(path, 'utf8')).toBe('second\n');
  });

  it.each(['missing', 'different'] as const)(
    'returns stale when check-mode output is %s',
    state => {
      const path = outputPath();
      if (state === 'different') writeFileSync(path, 'old\n');

      expect(
        reconcileGeneratedFile({
          check: true,
          content: 'current\n',
          outputPath: path,
        }),
      ).toBe('stale');
    },
  );

  it('returns current when check-mode output matches', () => {
    const path = outputPath();
    writeFileSync(path, 'current\n');

    expect(
      reconcileGeneratedFile({
        check: true,
        content: 'current\n',
        outputPath: path,
      }),
    ).toBe('current');
  });

  it('reports a clean failure when a generator entry point checks stale output', () => {
    const path = outputPath();
    writeFileSync(path, 'stale\n');

    const result = runGenerator('generate-plan-rubric.ts', path, '--check');

    expect(result.status).toBe(1);
    expect(result.stderr.trim()).toBe(
      `Generated plan-review rubric at ${path} is stale; run generate:plan-rubric`,
    );
    expect(result.stderr).not.toContain('Error:');
  });

  it.each([
    ['generate-plan-rubric.ts', 'plan-review'],
    ['generate-quality-rubric.ts', 'quality-review'],
    ['generate-red-rubric.ts', 'executable RED'],
    ['generate-scenario-rubric.ts', 'scenario-review'],
  ])('reports %s output states without rewriting current output', (script, label) => {
    const path = outputPath();
    const generated = runGenerator(script, path);
    expect(generated.status, generated.stderr).toBe(0);
    expect(generated.stdout).toContain(`Generated the ${label} runtime rubric.`);
    const before = statSync(path).mtimeMs;

    const noOp = runGenerator(script, path);
    expect(noOp.status, noOp.stderr).toBe(0);
    expect(noOp.stdout).toContain(
      `${label[0]?.toUpperCase()}${label.slice(1)} runtime rubric is already current.`,
    );
    expect(statSync(path).mtimeMs).toBe(before);

    const checked = runGenerator(script, path, '--check');
    expect(checked.status, checked.stderr).toBe(0);
    expect(checked.stdout).toContain(`Generated ${label} runtime rubric at ${path} is current.`);
  });

  it('rejects an output flag without a path', () => {
    const result = spawnSync('bun', ['scripts/generate-plan-rubric.ts', '--output', '--check'], {
      cwd: nodePath.join(import.meta.dirname, '../..'),
      encoding: 'utf8',
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('--output requires a path');
  });
});

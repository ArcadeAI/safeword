import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { runTests } from '../../../../.safeword/hooks/lib/test-runner';

const temporaryDirectories: string[] = [];

function makeProject(scripts: Record<string, string>): string {
  const directory = mkdtempSync(nodePath.join(tmpdir(), 'safeword-test-runner-'));
  temporaryDirectories.push(directory);
  writeFileSync(nodePath.join(directory, 'package-lock.json'), '{}\n');
  writeFileSync(
    nodePath.join(directory, 'package.json'),
    `${JSON.stringify({ scripts }, undefined, 2)}\n`,
  );
  return directory;
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { force: true, recursive: true });
  }
});

describe('runTests', () => {
  it('blocks when the Gherkin acceptance lane fails after primary tests pass', () => {
    const project = makeProject({
      'test:done': 'node -e "console.log(\'PRIMARY_OK\')"',
      'test:bdd': 'node -e "console.error(\'BDD_FAIL\'); process.exit(1)"',
    });

    const result = runTests(project);

    expect(result.skipped).toBe(false);
    expect(result.passed).toBe(false);
    expect(result.output).toContain('test:bdd');
    expect(result.output).toContain('BDD_FAIL');
  });

  it('passes when both primary tests and the Gherkin acceptance lane pass', () => {
    const project = makeProject({
      test: 'node -e "console.log(\'PRIMARY_OK\')"',
      'test:bdd': 'node -e "console.log(\'BDD_OK\')"',
    });

    const result = runTests(project);

    expect(result.skipped).toBe(false);
    expect(result.passed).toBe(true);
    expect(result.output).toContain('test');
    expect(result.output).toContain('test:bdd');
  });

  it('skips when the project has no runnable test scripts', () => {
    const project = makeProject({});

    const result = runTests(project);

    expect(result).toEqual({ passed: true, output: '', skipped: true });
  });

  it('keeps the template and dogfood runner aligned', () => {
    const repoRoot = nodePath.resolve(import.meta.dirname, '../../../..');
    const template = readFileSync(
      nodePath.join(repoRoot, 'packages/cli/templates/hooks/lib/test-runner.ts'),
      'utf8',
    );
    const dogfood = readFileSync(
      nodePath.join(repoRoot, '.safeword/hooks/lib/test-runner.ts'),
      'utf8',
    );

    expect(dogfood).toBe(template);
  });
});

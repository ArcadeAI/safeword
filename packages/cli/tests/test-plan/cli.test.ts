import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { runCli } from '../helpers.js';

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const dir of temporaryDirectories.splice(0)) rmSync(dir, { force: true, recursive: true });
});

function makeGoRepo(): string {
  const root = mkdtempSync(nodePath.join(tmpdir(), 'safeword-test-plan-cli-'));
  temporaryDirectories.push(root);
  writeFileSync(nodePath.join(root, 'go.mod'), 'module x\n');
  return root;
}

describe('safeword test-plan --json', () => {
  it('prints the resolved plan as a JSON array with the entry contract', async () => {
    const root = makeGoRepo();

    const result = await runCli(['test-plan', '--kind', 'test', '--json'], { cwd: root });

    expect(result.exitCode).toBe(0);
    const plan = JSON.parse(result.stdout) as {
      language: string;
      command: string;
      available: unknown;
    }[];
    expect(Array.isArray(plan)).toBe(true);
    const go = plan.find(entry => entry.language === 'go');
    expect(go).toBeDefined();
    expect(go?.command).not.toBe('');
    expect(typeof go?.available).toBe('boolean');
  });
});

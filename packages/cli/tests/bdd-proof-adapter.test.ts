import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { expect, it } from 'vitest';

const repo = nodePath.resolve(import.meta.dirname, '../../..');

it('fails a bound acceptance step when its proof hook never ran', () => {
  const directory = mkdtempSync(nodePath.join(tmpdir(), 'safeword-proof-adapter-'));
  try {
    const feature = nodePath.join(directory, 'missing-proof.feature');
    const config = nodePath.join(directory, 'cucumber.mjs');
    writeFileSync(
      feature,
      [
        'Feature: Detect an omitted proof hook',
        '  Scenario: A bound step without the owning Rule tag',
        '    Given an accepted contribution is one coherent independently provable change',
        '',
      ].join('\n'),
    );
    writeFileSync(
      config,
      `export default ${JSON.stringify({
        import: [
          'tsx/esm',
          nodePath.join(repo, 'steps/world.ts'),
          nodePath.join(repo, 'steps/turn-decisions-into-startable-work.steps.ts'),
        ],
        paths: [feature],
      })};\n`,
    );
    const result = spawnSync(
      process.execPath,
      [
        '--import',
        'tsx',
        nodePath.join(repo, 'node_modules/.bin/cucumber-js'),
        '--config',
        nodePath.relative(repo, config),
      ],
      {
        cwd: repo,
        encoding: 'utf8',
        timeout: 30_000,
        env: { ...process.env, NODE_OPTIONS: undefined },
      },
    );
    expect(result.error).toBeUndefined();
    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(1);
    expect(result.stdout).toContain('acceptance proof was not run');
    expect(result.stdout).toContain('1 scenario (1 failed)');
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

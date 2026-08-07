/**
 * Reproducibility contract: Bun.build output is toolchain-sensitive, so every
 * workflow and the committed Claude plugin generator must share one exact Bun
 * version from the root package.json.
 *
 * setup-bun's package.json reader resolves packageManager:
 * https://github.com/oven-sh/setup-bun/blob/main/src/utils.ts
 */

import { spawnSync } from 'node:child_process';
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

const repoRoot = nodePath.resolve(import.meta.dirname, '../../..');
const generatorPath = nodePath.join(repoRoot, 'packages/cli/scripts/generate-claude-plugin.ts');

interface Workflow {
  jobs?: Record<string, { steps?: { uses?: string; with?: Record<string, unknown> }[] }>;
}

describe('Claude plugin Bun version contract', () => {
  it('declares one exact Bun version at the repository root', () => {
    const packageJson = JSON.parse(
      readFileSync(nodePath.join(repoRoot, 'package.json'), 'utf8'),
    ) as {
      packageManager?: string;
    };

    expect(packageJson.packageManager).toMatch(/^bun@\d+\.\d+\.\d+$/);
  });

  it('makes every setup-bun step read the root version declaration', () => {
    const workflowsRoot = nodePath.join(repoRoot, '.github/workflows');
    const setupSteps = readdirSync(workflowsRoot)
      .filter(file => /\.ya?ml$/.test(file))
      .flatMap(file => {
        const workflow = parse(
          readFileSync(nodePath.join(workflowsRoot, file), 'utf8'),
        ) as Workflow;
        return Object.values(workflow.jobs ?? {}).flatMap(job => job.steps ?? []);
      })
      .filter(step => step.uses?.startsWith('oven-sh/setup-bun@'));

    expect(setupSteps.length).toBeGreaterThan(0);
    for (const step of setupSteps) {
      expect(step.with?.['bun-version-file']).toBe('package.json');
      expect(step.with?.['bun-version']).toBeUndefined();
    }
  });

  it('refuses a mismatched Bun before writing generated plugin files', () => {
    const fixtureRoot = mkdtempSync(nodePath.join(tmpdir(), 'safeword-bun-pin-'));
    try {
      const fixturePackageRoot = nodePath.join(fixtureRoot, 'packages/cli');
      const fixtureGeneratorPath = nodePath.join(
        fixturePackageRoot,
        'scripts/generate-claude-plugin.ts',
      );
      mkdirSync(nodePath.join(fixturePackageRoot, 'scripts'), { recursive: true });
      mkdirSync(nodePath.join(fixturePackageRoot, 'src/claude-plugin'), { recursive: true });
      mkdirSync(nodePath.join(fixtureRoot, 'plugin'), { recursive: true });
      cpSync(generatorPath, fixtureGeneratorPath);
      writeFileSync(nodePath.join(fixtureRoot, 'package.json'), '{"packageManager":"bun@0.0.0"}\n');
      writeFileSync(nodePath.join(fixturePackageRoot, 'package.json'), '{"version":"0.0.0"}\n');
      writeFileSync(
        nodePath.join(fixturePackageRoot, 'src/claude-plugin/catalogue.js'),
        'export const sealClaudePluginCatalogue = () => {};\n' +
          'export const writeClaudePluginCatalogue = () => [];\n',
      );
      const sentinelPath = nodePath.join(fixtureRoot, 'plugin/sentinel');
      writeFileSync(sentinelPath, 'untouched');

      const result = spawnSync('bun', [fixtureGeneratorPath], {
        cwd: fixtureRoot,
        encoding: 'utf8',
      });

      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain('Claude plugin generation requires Bun 0.0.0');
      expect(readFileSync(sentinelPath, 'utf8')).toBe('untouched');
    } finally {
      rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });
});

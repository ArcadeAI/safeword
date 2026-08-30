/**
 * Reproducibility contract: Bun.build output is toolchain-sensitive, so every
 * workflow and the committed Claude plugin generator must share one exact Bun
 * version from the root package.json.
 *
 * setup-bun's package.json reader resolves packageManager:
 * https://github.com/oven-sh/setup-bun/blob/main/src/utils.ts
 */

import { readdirSync, readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

import { requirePinnedBunVersion } from '../scripts/bun-version.js';

const repoRoot = nodePath.resolve(import.meta.dirname, '../../..');
const bundleBuilderPath = nodePath.join(
  repoRoot,
  'packages/cli/scripts/lib/build-plugin-cli-bundle.ts',
);

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

  it('rejects a Bun runtime that differs from the root pin', () => {
    expect(() => requirePinnedBunVersion('bun@0.0.0', '1.3.14')).toThrow(
      'Claude plugin generation requires Bun 0.0.0 from root package.json; found 1.3.14.',
    );
  });

  it('runs the version guard before invoking Bun.build', () => {
    const bundleBuilder = readFileSync(bundleBuilderPath, 'utf8');
    const guardIndex = bundleBuilder.indexOf('requirePinnedBunVersion(');
    const buildIndex = bundleBuilder.indexOf('Bun.build(');

    expect(guardIndex).toBeGreaterThan(-1);
    expect(buildIndex).toBeGreaterThan(guardIndex);
  });
});

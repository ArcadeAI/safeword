import { readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';
import { parseDocument } from 'yaml';

import { SAFEWORD_SCHEMA } from '../src/schema.js';
import { createProjectContext } from '../src/utils/context.js';
import { isSafePackageVersion } from '../src/utils/version.js';

const repoRoot = nodePath.resolve(import.meta.dirname, '../../..');
const reviewWorkflows = ['publisher', 'worker'] as const;

describe('PR review template version pins', () => {
  it('resolves each source template to the installed project version', () => {
    const installedVersion = readFileSync(
      nodePath.join(repoRoot, '.safeword/version'),
      'utf8',
    ).trim();
    expect(isSafePackageVersion(installedVersion)).toBe(true);

    for (const name of reviewWorkflows) {
      const template = readFileSync(
        nodePath.join(repoRoot, `packages/cli/templates/workflows/pr-review-${name}.yml`),
        'utf8',
      );
      expect(template, `${name} must declare a version placeholder`).toContain(
        '__SAFEWORD_VERSION__',
      );
      const installed = SAFEWORD_SCHEMA.managedFiles[
        `.github/workflows/safeword-pr-review-${name}.yml`
      ]?.generator?.(createProjectContext(repoRoot));
      expect(installed).toBeDefined();
      const document = parseDocument(installed ?? '').toJS() as {
        jobs: Record<string, { steps?: { run?: string }[] }>;
      };
      const invocations = Object.values(document.jobs).flatMap(job =>
        (job.steps ?? []).flatMap(step =>
          (step.run ?? '')
            .matchAll(/(?:npx|bunx)(?:\s+--[\w-]+)*\s+safeword(?:@(\S+))?/gu)
            .map(match => match[1])
            .toArray(),
        ),
      );
      expect(invocations.length).toBeGreaterThan(0);
      expect(invocations.every(version => version === installedVersion)).toBe(true);
      expect(installed).not.toContain('__SAFEWORD_VERSION__');
    }
  });
});

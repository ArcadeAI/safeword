import { readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

import { isSafePackageVersion } from '../src/utils/version.js';

const repoRoot = nodePath.resolve(import.meta.dirname, '../../..');
const reviewWorkflows = ['publisher', 'worker'] as const;

describe('dogfood PR review version pins', () => {
  it('matches each source template with the installed project version substituted', () => {
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
      const dogfood = readFileSync(
        nodePath.join(repoRoot, `.github/workflows/safeword-pr-review-${name}.yml`),
        'utf8',
      );

      expect(template, `${name} must declare a version placeholder`).toContain(
        '__SAFEWORD_VERSION__',
      );
      expect(dogfood, `${name} must use the installed Safeword version`).toBe(
        template.replaceAll('__SAFEWORD_VERSION__', () => installedVersion),
      );
    }
  });
});

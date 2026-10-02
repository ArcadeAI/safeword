import { readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

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
      const installed = template.replaceAll('__SAFEWORD_VERSION__', () => installedVersion);
      expect(installed).toContain(`safeword@${installedVersion}`);
      expect(installed).not.toContain('__SAFEWORD_VERSION__');
    }
  });
});

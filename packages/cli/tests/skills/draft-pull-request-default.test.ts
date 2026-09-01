import { readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

const repoRoot = nodePath.resolve(import.meta.dirname, '../../../..');

const readRepoFile = (relativePath: string): string =>
  readFileSync(nodePath.join(repoRoot, relativePath), 'utf8');

const reviewerAsCustomerPolicy = '**Reviewer-as-customer pull requests.**';

describe('reviewer-as-customer pull request default', () => {
  it.each([
    ['canonical SAFEWORD template', 'packages/cli/templates/SAFEWORD.md'],
    ['dogfood SAFEWORD copy', '.safeword/SAFEWORD.md'],
  ])(
    '%s keeps incomplete pull requests in Draft and reserves Ready promotion for an explicit request',
    (_label, path) => {
      const content = readRepoFile(path);

      expect(content).toContain(reviewerAsCustomerPolicy);
      expect(content).toContain('run `/pr-readiness`');
      expect(content).toContain('Missing evidence keeps the PR Draft');
      expect(content).toContain('the user explicitly asks');
    },
  );
});

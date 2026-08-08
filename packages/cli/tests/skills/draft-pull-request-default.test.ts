import { readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

const repoRoot = nodePath.resolve(import.meta.dirname, '../../../..');

const readRepoFile = (relativePath: string): string =>
  readFileSync(nodePath.join(repoRoot, relativePath), 'utf8');

describe('draft pull request default', () => {
  it.each([
    ['canonical SAFEWORD template', 'packages/cli/templates/SAFEWORD.md'],
    ['dogfood SAFEWORD copy', '.safeword/SAFEWORD.md'],
  ])(
    '%s keeps agent-created pull requests in draft until the user says otherwise',
    (_label, path) => {
      const content = readRepoFile(path);

      expect(content).toContain('**Draft pull requests.**');
      expect(content).toContain('Create every pull request as a draft by default');
      expect(content).toContain('`gh pr create --draft`');
      expect(content).toContain('Only create or mark a pull request ready for review');
      expect(content).toContain('explicitly asks');
      expect(content).toContain(
        'a request to push, publish, or open a pull request does not count',
      );
    },
  );
});

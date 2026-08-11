import { readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

const repoRoot = nodePath.resolve(import.meta.dirname, '../../../..');

const readRepoFile = (relativePath: string): string =>
  readFileSync(nodePath.join(repoRoot, relativePath), 'utf8');

const draftPullRequestPolicy =
  '**Draft pull requests.** Create every pull request as a draft by default (' +
  '`gh pr create --draft` on GitHub). Only create or mark a pull request ready ' +
  'for review when the user explicitly asks; a request to push, publish, or open ' +
  'a pull request does not count.';

describe('draft pull request default', () => {
  it.each([
    ['canonical SAFEWORD template', 'packages/cli/templates/SAFEWORD.md'],
    ['dogfood SAFEWORD copy', '.safeword/SAFEWORD.md'],
  ])(
    '%s keeps agent-created pull requests in draft until the user says otherwise',
    (_label, path) => {
      const content = readRepoFile(path);

      expect(content).toContain(draftPullRequestPolicy);
    },
  );
});

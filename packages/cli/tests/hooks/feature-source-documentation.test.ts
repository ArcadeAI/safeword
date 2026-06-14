import { readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

const repoRoot = nodePath.resolve(import.meta.dirname, '../../../..');

const files = [
  nodePath.join(repoRoot, 'packages/cli/templates/skills/bdd/SCENARIOS.md'),
  nodePath.join(repoRoot, '.claude/skills/bdd/SCENARIOS.md'),
  nodePath.join(repoRoot, 'packages/cli/templates/skills/review-spec/SKILL.md'),
  nodePath.join(repoRoot, '.claude/skills/review-spec/SKILL.md'),
  nodePath.join(repoRoot, 'packages/cli/templates/guides/planning-guide.md'),
  nodePath.join(repoRoot, '.safeword/guides/planning-guide.md'),
  nodePath.join(repoRoot, 'packages/cli/templates/doc-templates/test-definitions-feature.md'),
  nodePath.join(repoRoot, '.safeword/templates/test-definitions-feature.md'),
];

describe('feature-file source documentation (1DT29X)', () => {
  it.each(files)('%s names feature files as source and test-definitions as ledger', file => {
    const content = readFileSync(file, 'utf8');

    expect(content).toContain('.feature');
    expect(content).toContain('test-definitions.md is the R/G/R ledger');
  });
});

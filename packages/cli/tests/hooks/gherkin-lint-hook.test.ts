import { readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

const repoRoot = nodePath.resolve(import.meta.dirname, '../../../..');

const files = [
  nodePath.join(repoRoot, 'packages/cli/templates/hooks/lib/lint.ts'),
  nodePath.join(repoRoot, '.safeword/hooks/lib/lint.ts'),
];

describe('Gherkin lint hook wiring', () => {
  it.each(files)('%s routes .feature files through safeword lint-gherkin', file => {
    const content = readFileSync(file, 'utf8');

    expect(content).toContain('FEATURE_EXTENSIONS');
    expect(content).toContain('safewordCliCommand');
    expect(content).toContain('lint-gherkin');
    expect(content).not.toContain('gherkin-lint');
  });
});

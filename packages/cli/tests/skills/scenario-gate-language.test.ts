import { readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

const repoRoot = nodePath.resolve(import.meta.dirname, '../../../..');

const readRepoFile = (relativePath: string): string =>
  readFileSync(nodePath.join(repoRoot, relativePath), 'utf8');

const scenarioGuides = [
  'packages/cli/templates/skills/bdd/SCENARIOS.md',
  '.safeword/skills/bdd/SCENARIOS.md',
  '.claude/skills/bdd/SCENARIOS.md',
  'packages/cli/codex-plugin/skills/bdd/references/SCENARIOS.md',
  'plugin/skills/bdd/SCENARIOS.md',
];

describe('scenario gate decision language', () => {
  it.each(scenarioGuides)('%s asks users about completeness in plain language', path => {
    const content = readRepoFile(path);

    expect(content).toContain(
      'Do these scenarios fully describe the intended behavior and important boundaries, or is anything missing?',
    );
    expect(content).toContain(
      'Do these scenarios now fully cover the intended behavior and important boundaries, or is anything still missing?',
    );
    expect(content).not.toContain('### Scenario saturation');
    expect(content).not.toContain('### Coverage saturation');
    expect(content).not.toMatch(/saturated at/iu);
  });
});

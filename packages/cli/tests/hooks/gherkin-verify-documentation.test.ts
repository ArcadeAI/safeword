import { readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

const repoRoot = nodePath.resolve(import.meta.dirname, '../../../..');

// commands/verify.md is a thin pointer at the skill since 7PG694 — it carries
// no Gherkin guidance of its own.
const verifyGuidanceFiles = [
  nodePath.join(repoRoot, 'packages/cli/templates/skills/verify/SKILL.md'),
  nodePath.join(repoRoot, '.agents/skills/verify/SKILL.md'),
  nodePath.join(repoRoot, '.claude/skills/verify/SKILL.md'),
];

const doneGateGuidanceFiles = [
  nodePath.join(repoRoot, 'packages/cli/templates/hooks/stop-quality.ts'),
  nodePath.join(repoRoot, '.safeword/hooks/stop-quality.ts'),
];

describe('Gherkin verify evidence documentation (BFCWDB)', () => {
  it.each(verifyGuidanceFiles)('%s reports the Gherkin acceptance lane', file => {
    const content = readFileSync(file, 'utf8');

    expect(content).toContain('bun run test:bdd');
    expect(content).toContain('**Gherkin:**');
    expect(content).toContain('Skipped — no test:bdd script');
  });

  it.each(doneGateGuidanceFiles)('%s requests Gherkin done-gate evidence', file => {
    const content = readFileSync(file, 'utf8');

    expect(content).toContain('Gherkin acceptance');
    expect(content).toContain('Skipped — no test:bdd script');
  });
});

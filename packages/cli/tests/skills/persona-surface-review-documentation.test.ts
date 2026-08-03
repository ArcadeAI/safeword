import { readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

import { reviewArtifactPaths } from '../helpers/review-entrypoints.js';

const repoRoot = nodePath.resolve(import.meta.dirname, '../../../..');
const read = (relativePath: string): string =>
  readFileSync(nodePath.join(repoRoot, relativePath), 'utf8');

const VERIFY_SURFACES = [
  'packages/cli/templates/skills/verify/SKILL.md',
  '.claude/skills/verify/SKILL.md',
  'packages/cli/codex-plugin/skills/verify/SKILL.md',
];

describe('persona and surface review flow', () => {
  it.each(reviewArtifactPaths('plan'))(
    '%s gives independent plan review the source artifacts',
    path => {
      const content = read(path);

      expect(content).toMatch(/reviewer[\s\S]*spec\.md/i);
      expect(content).toMatch(/reviewer[\s\S]*configured personas file/i);
      expect(content).toMatch(/reviewer[\s\S]*configured surfaces file/i);
      expect(content).toMatch(/omitted[\s\S]*surface/i);
    },
  );

  it.each(reviewArtifactPaths('spec'))(
    '%s validates spec references against configured knowledge',
    path => {
      const content = read(path);

      expect(content).toContain('paths.personas');
      expect(content).toContain('paths.surfaces');
      expect(content).toMatch(/affected surface[\s\S]*configured surfaces/i);
    },
  );

  it.each(reviewArtifactPaths('scenario'))(
    '%s grounds persona and surface checks in configured knowledge',
    path => {
      const content = read(path);

      expect(content).toContain('paths.personas');
      expect(content).toContain('paths.surfaces');
      expect(content).toMatch(/persona consistency/i);
      expect(content).toMatch(/surface coverage/i);
    },
  );

  it.each(reviewArtifactPaths('quality'))(
    '%s challenges persona fulfillment and surface proof',
    path => {
      const content = read(path);

      expect(content).toMatch(/persona[\s\S]*JTBD/i);
      expect(content).toMatch(/affected surface[\s\S]*proof/i);
      expect(content).toMatch(/surface evidence/i);
    },
  );

  it.each(VERIFY_SURFACES)('%s records a per-surface evidence matrix', path => {
    const content = read(path);

    expect(content).toMatch(/surface evidence/i);
    expect(content).toMatch(/affected surface[\s\S]*command[\s\S]*result/i);
  });
});

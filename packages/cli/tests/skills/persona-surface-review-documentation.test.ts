import { readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

const repoRoot = nodePath.resolve(import.meta.dirname, '../../../..');
const read = (relativePath: string): string =>
  readFileSync(nodePath.join(repoRoot, relativePath), 'utf8');

const PLAN_SURFACES = [
  'packages/cli/templates/skills/bdd/PLAN_IMPLEMENTATION.md',
  '.claude/skills/bdd/PLAN_IMPLEMENTATION.md',
  'packages/cli/codex-plugin/skills/bdd/references/PLAN_IMPLEMENTATION.md',
];

const SELF_REVIEW_SURFACES = [
  'packages/cli/templates/skills/self-review/SKILL.md',
  '.claude/skills/self-review/SKILL.md',
  'packages/cli/codex-plugin/skills/self-review/SKILL.md',
];

const SCENARIO_REVIEW_SURFACES = [
  'packages/cli/templates/skills/review-spec/SKILL.md',
  '.claude/skills/review-spec/SKILL.md',
  'packages/cli/codex-plugin/skills/review-spec/SKILL.md',
];

const QUALITY_REVIEW_SURFACES = [
  'packages/cli/templates/skills/quality-review/SKILL.md',
  '.claude/skills/quality-review/SKILL.md',
  'packages/cli/codex-plugin/skills/quality-review/SKILL.md',
];

const VERIFY_SURFACES = [
  'packages/cli/templates/skills/verify/SKILL.md',
  '.claude/skills/verify/SKILL.md',
  'packages/cli/codex-plugin/skills/verify/SKILL.md',
];

describe('persona and surface review flow', () => {
  it.each(PLAN_SURFACES)('%s gives independent plan review the source artifacts', path => {
    const content = read(path);

    expect(content).toMatch(/reviewer[\s\S]*spec\.md/i);
    expect(content).toMatch(/reviewer[\s\S]*configured personas file/i);
    expect(content).toMatch(/reviewer[\s\S]*configured surfaces file/i);
    expect(content).toMatch(/omitted[\s\S]*surface/i);
  });

  it.each(SELF_REVIEW_SURFACES)(
    '%s validates spec references against configured knowledge',
    path => {
      const content = read(path);

      expect(content).toContain('paths.personas');
      expect(content).toContain('paths.surfaces');
      expect(content).toMatch(/affected surface[\s\S]*configured surfaces/i);
    },
  );

  it.each(SCENARIO_REVIEW_SURFACES)(
    '%s grounds persona and surface checks in configured knowledge',
    path => {
      const content = read(path);

      expect(content).toContain('paths.personas');
      expect(content).toContain('paths.surfaces');
      expect(content).toMatch(/persona consistency/i);
      expect(content).toMatch(/surface coverage/i);
    },
  );

  it.each(QUALITY_REVIEW_SURFACES)('%s challenges persona fulfillment and surface proof', path => {
    const content = read(path);

    expect(content).toMatch(/persona[\s\S]*JTBD/i);
    expect(content).toMatch(/affected surface[\s\S]*proof/i);
    expect(content).toMatch(/surface evidence/i);
  });

  it.each(VERIFY_SURFACES)('%s records a per-surface evidence matrix', path => {
    const content = read(path);

    expect(content).toMatch(/surface evidence/i);
    expect(content).toMatch(/affected surface[\s\S]*command[\s\S]*result/i);
  });
});

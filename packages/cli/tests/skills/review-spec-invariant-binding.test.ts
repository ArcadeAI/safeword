import { readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

const repoRoot = nodePath.resolve(import.meta.dirname, '../../../..');

/**
 * Every surface that ships review-spec. `.agents/skills` is included
 * deliberately: it is git-tracked and byte-identical to the template for every
 * other skill, but `parity:fix` does not sync it, so it is the copy that drifts
 * silently.
 */
const surfaces = [
  'packages/cli/templates/skills/review-spec/SKILL.md',
  '.claude/skills/review-spec/SKILL.md',
  '.agents/skills/review-spec/SKILL.md',
  'packages/cli/codex-plugin/skills/review-spec/SKILL.md',
].map(relative => nodePath.join(repoRoot, relative));

const canonical = nodePath.join(repoRoot, 'packages/cli/templates/skills/review-spec/SKILL.md');

describe('review-spec invariant-binding lens (Y9P3ZC)', () => {
  it.each(surfaces)('%s carries the invariant-binding lens', file => {
    const content = readFileSync(file, 'utf8');

    expect(content).toContain('**Invariant binding**');
    // A bare scenario reference is the degenerate form the lens exists to
    // reject — it survives the invariant being violated, so demanding the
    // falsifying condition is the load-bearing half of the check.
    expect(content).toContain('the condition under which it fails');
    // The named-but-weaker shape is what made QRX2DN read as covered; a lens
    // that only asks "is there a scenario?" would have passed it.
    expect(content).toContain('weaker precondition');
  });

  it('counts its cross-cutting lenses correctly', () => {
    const content = readFileSync(canonical, 'utf8');
    const section = content.slice(content.indexOf('## Cross-cutting checks'));
    const declared = /^(?<count>\w+) lenses across the whole scenario set/m.exec(section)?.groups
      ?.count;
    const bullets = section.slice(0, section.indexOf('\n## ', 1)).match(/^- \*\*/gm)?.length;

    expect(declared).toBe('Eight');
    expect(bullets).toBe(8);
  });
});

import { existsSync, readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

const repoRoot = nodePath.resolve(import.meta.dirname, '../../../..');
const readRaw = (path: string): string => {
  const fullPath = nodePath.join(repoRoot, path);
  expect(existsSync(fullPath), `missing installed guidance: ${path}`).toBe(true);
  return readFileSync(fullPath, 'utf8');
};
const read = (path: string): string => readRaw(path).replaceAll(/\s+/gu, ' ');
const readBoundarySection = (path: string): string =>
  readRaw(path)
    .split('A genuine boundary retains the blocked step', 2)[1]
    ?.split('An unsuccessful TDD step stays at the failing step', 1)[0]
    .replaceAll(/\s+/gu, ' ') ?? '';

const tddCopies = [
  'packages/cli/templates/skills/bdd/TDD.md',
  '.safeword/skills/bdd/TDD.md',
  '.claude/skills/bdd/TDD.md',
  'packages/cli/codex-plugin/skills/bdd/references/TDD.md',
];

const prReadinessCopies = [
  'packages/cli/templates/skills/pr-readiness/SKILL.md',
  '.safeword/skills/pr-readiness/SKILL.md',
  '.claude/skills/pr-readiness/SKILL.md',
  'packages/cli/codex-plugin/skills/pr-readiness/SKILL.md',
];

const unsuccessfulSteps = [
  {
    outcome: 'RED proof passes',
    current: 'RED',
    evidence: 'proof passed',
    following: 'implementation',
  },
  {
    outcome: 'GREEN check fails',
    current: 'GREEN',
    evidence: 'check failed',
    following: 'refactor',
  },
];

const verificationBoundaries = [
  ['authority', 'request the required human decision'],
  ['safety', 'approve the exact risky operation'],
  ['dependency', 'restore the required dependency'],
  ['scope', 'decide the proposed scope change'],
] as const;

describe('installed delivery continuation contract', () => {
  it.each(tddCopies)('%s advances from approved RED without a routine prompt', path => {
    const content = read(path);

    expect(content).toContain(
      'After an approved RED, continue directly into implementation without asking whether to proceed.',
    );
  });

  it('routes Cursor TDD guidance to the canonical installed contract', () => {
    expect(read('.cursor/rules/bdd-tdd.mdc')).toContain('@.safeword/skills/bdd/TDD.md');
  });

  it.each(tddCopies)('%s advances from GREEN through refactor to the next scenario', path => {
    const content = read(path);

    expect(content).toContain(
      'After GREEN, continue through refactor and then start the next incomplete scenario without asking whether to proceed.',
    );
  });

  it.each(tddCopies.flatMap(path => unsuccessfulSteps.map(step => ({ path, ...step }))))(
    '$path keeps $outcome at its failing evidence',
    ({ path, outcome, current, evidence, following }) => {
      const content = readRaw(path);
      expect(content).toContain('### Trusted executable RED review');
      const section =
        content
          .split(
            'An unsuccessful TDD step stays at the failing step and reports its evidence:',
            2,
          )[1]
          ?.split('### Trusted executable RED review', 1)[0] ?? '';
      const rows = section
        .split('\n')
        .filter(line => line.startsWith('|'))
        .filter(line => line.split('|', 2)[1]?.trim() === outcome);

      expect(rows, `missing unhealthy-step directive for ${outcome}`).toHaveLength(1);
      const cells = rows[0]?.split('|').map(cell => cell.trim()) ?? [];
      expect(cells).toHaveLength(5);
      const directive = cells[2] ?? '';
      expect(directive).toContain(current);
      expect(directive).toContain(evidence);
      expect(directive.toLowerCase()).not.toContain(following.toLowerCase());
    },
  );

  it.each(tddCopies)('%s closes the whole ticket after the final scenario', path => {
    expect(read(path)).toContain(
      'After the final scenario, continue in order through whole-ticket review, plan reconciliation, verification, audit, and recorded ticket closure without asking whether to proceed.',
    );
  });

  it.each(tddCopies)(
    '%s classifies PR readiness after closure without automatic promotion',
    path => {
      expect(read(path)).toContain(
        "After recorded ticket closure, continue into PR-readiness classification without invoking GitHub CLI Ready promotion, and request the builder's explicit authorization for that state change.",
      );
    },
  );

  it.each(tddCopies)(
    '%s restores a manifest-authorized missing dependency without prompting',
    path => {
      expect(read(path)).toContain(
        'When a required dependency is already authorized by the manifest but missing locally, restore it and rerun the failed check without asking whether to continue.',
      );
    },
  );

  it.each(
    tddCopies.flatMap(path =>
      verificationBoundaries.map(([boundary, recovery]) => ({
        path,
        boundary,
        recovery,
      })),
    ),
  )('$path stops at verification for a $boundary boundary', ({ path, boundary, recovery }) => {
    const article = boundary === 'authority' ? 'an' : 'a';
    expect(read(path)).toContain(
      `At ${article} ${boundary} boundary during verification, stop at verification without advancing; ${recovery}, then report the blocking evidence.`,
    );
  });

  it.each(tddCopies)('%s retains an authority boundary at implementation', path => {
    expect(read(path)).toContain(
      'At an authority boundary during implementation, stop at implementation without advancing; request the required human decision.',
    );
  });

  it.each(tddCopies)('%s stops for an unauthorized missing dependency', path => {
    expect(readBoundarySection(path)).toContain(
      'When verification requires a dependency absent from the manifest, stop at verification without advancing and ask the builder to authorize the dependency change.',
    );
  });

  it.each(tddCopies)('%s gives a non-technical builder a plain recovery action', path => {
    const boundarySection = readBoundarySection(path);

    expect(boundarySection).toContain(
      'When reporting a boundary to a Non-Technical Builder, name the exact decision needed to resume in plain language and omit internal workflow-stage names.',
    );
    expect(boundarySection).not.toMatch(/\b(?:red|green|refactor|reconciliation|audit)\b/iu);
  });

  it.each(prReadinessCopies)('%s returns from Draft evidence to delivery', path => {
    const content = readRaw(path);
    expect(content).toContain('## Observe and preserve');
    expect(content).toContain('## Seven hard Ready-for-Review gates');
    const draftSection = content
      .split('## Observe and preserve', 2)[1]
      ?.split('## Seven hard Ready-for-Review gates', 1)[0]
      .replaceAll(/\s+/gu, ' ');

    expect(draftSection).toContain(
      'After creating a Draft pull request for evidence, return directly to the next unfinished delivery step instead of reporting the change ready for review.',
    );
  });

  it('routes Cursor PR-readiness guidance to the canonical installed contract', () => {
    expect(read('.cursor/rules/safeword-pr-readiness.mdc')).toContain(
      '@.safeword/skills/pr-readiness/SKILL.md',
    );
  });
});

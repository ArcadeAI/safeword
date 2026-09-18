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
const readBoundarySection = (path: string): string => {
  const content = readRaw(path);
  const startMarker = 'A genuine boundary retains the blocked step';
  const endMarker = 'An unsuccessful TDD step stays at the failing step';
  const start = content.indexOf(startMarker);
  const end = content.indexOf(endMarker, start + startMarker.length);

  expect(start, `missing boundary-section start in ${path}`).toBeGreaterThanOrEqual(0);
  expect(end, `missing boundary-section end in ${path}`).toBeGreaterThan(start);

  return content.slice(start, end).replaceAll(/\s+/gu, ' ');
};

const tddCopies = [
  'packages/cli/templates/skills/bdd/TDD.md',
  '.safeword/skills/bdd/TDD.md',
  '.claude/skills/bdd/TDD.md',
  'packages/cli/codex-plugin/skills/bdd/references/TDD.md',
  'plugin/skills/bdd/TDD.md',
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
] as const;

const verificationBoundaries = [
  ['authority', 'request the required human decision'],
  ['safety', 'approve the exact risky operation'],
  ['dependency', 'restore the required dependency'],
  ['scope', 'decide the proposed scope change'],
] as const;

const recoveryStates = [
  [
    'implementation',
    'the required decision outstanding',
    'Implementation remains blocked — make the required decision to resume.',
  ],
  ['implementation', 'the required decision completed', 'Resume implementation work.'],
  [
    'verification',
    'the required decision outstanding',
    'Verification remains blocked — make the required decision to resume.',
  ],
  ['verification', 'the required decision completed', 'Resume verification work.'],
] as const;

describe('installed delivery continuation contract', () => {
  it('every installed copy advances from approved RED without a routine prompt', () => {
    for (const path of tddCopies) {
      expect(read(path)).toContain(
        'After an approved RED, continue directly into implementation without asking whether to proceed.',
      );
    }
  });

  it('routes Cursor TDD guidance to the canonical installed contract', () => {
    expect(read('.cursor/rules/bdd-tdd.mdc')).toContain('@.safeword/skills/bdd/TDD.md');
  });

  it('every installed copy advances from GREEN through refactor to the next scenario', () => {
    for (const path of tddCopies) {
      expect(read(path)).toContain(
        'After GREEN, continue through refactor and then start the next incomplete scenario without asking whether to proceed.',
      );
    }
  });

  function expectUnsuccessfulStep(step: (typeof unsuccessfulSteps)[number]): void {
    for (const path of tddCopies) {
      const { outcome, current, evidence, following } = step;
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
    }
  }

  it('every installed copy keeps a passing RED proof at RED', () => {
    expectUnsuccessfulStep(unsuccessfulSteps[0]);
  });

  it('every installed copy keeps a failing GREEN check at GREEN', () => {
    expectUnsuccessfulStep(unsuccessfulSteps[1]);
  });

  it('every installed copy closes the whole ticket after the final scenario', () => {
    for (const path of tddCopies) {
      expect(read(path)).toContain(
        'After the final scenario, continue in order through whole-ticket review, plan reconciliation, verification, audit, and recorded ticket closure without asking whether to proceed.',
      );
    }
  });

  it('every installed copy classifies PR readiness without automatic promotion', () => {
    for (const path of tddCopies) {
      expect(read(path)).toContain(
        "After recorded ticket closure, continue into PR-readiness classification without invoking GitHub CLI Ready promotion, and request the builder's explicit authorization for that state change.",
      );
    }
  });

  it('every installed copy restores an authorized missing dependency without prompting', () => {
    for (const path of tddCopies) {
      expect(read(path)).toContain(
        'When a required dependency is already authorized by the manifest but missing locally, restore it and rerun the failed check without asking whether to continue.',
      );
    }
  });

  function expectVerificationBoundary(
    boundary: (typeof verificationBoundaries)[number][0],
    recovery: (typeof verificationBoundaries)[number][1],
  ): void {
    const article = boundary === 'authority' ? 'an' : 'a';
    for (const path of tddCopies) {
      expect(read(path)).toContain(
        `At ${article} ${boundary} boundary during verification, stop at verification without advancing; ${recovery}, then report the blocking evidence.`,
      );
    }
  }

  it('every installed copy stops verification at an authority boundary', () => {
    expectVerificationBoundary(...verificationBoundaries[0]);
  });

  it('every installed copy stops verification at a safety boundary', () => {
    expectVerificationBoundary(...verificationBoundaries[1]);
  });

  it('every installed copy stops verification at a dependency boundary', () => {
    expectVerificationBoundary(...verificationBoundaries[2]);
  });

  it('every installed copy stops verification at a scope boundary', () => {
    expectVerificationBoundary(...verificationBoundaries[3]);
  });

  it('every installed copy retains an authority boundary at implementation', () => {
    for (const path of tddCopies) {
      expect(read(path)).toContain(
        'At an authority boundary during implementation, stop at implementation without advancing; request the required human decision.',
      );
    }
  });

  it('every installed copy stops for an unauthorized missing dependency', () => {
    for (const path of tddCopies) {
      expect(readBoundarySection(path)).toContain(
        'When verification requires a dependency absent from the manifest, stop at verification without advancing and ask the builder to authorize the dependency change.',
      );
    }
  });

  it('every installed copy gives a non-technical builder a plain recovery action', () => {
    for (const path of tddCopies) {
      const boundarySection = readBoundarySection(path);

      expect(boundarySection).toContain(
        'When reporting a boundary to a Non-Technical Builder, name the exact decision needed to resume in plain language and omit internal workflow-stage names.',
      );
      expect(boundarySection).not.toMatch(/\b(?:red|green|refactor|reconciliation|audit)\b/iu);
    }
  });

  function expectRecoveryState(state: (typeof recoveryStates)[number]): void {
    const [step, recoveryState, directive] = state;
    for (const path of tddCopies) {
      expect(readBoundarySection(path)).toContain(
        `| ${step} | ${recoveryState} | \`${directive}\` |`,
      );
    }
  }

  it('every installed copy repeats an outstanding implementation decision', () => {
    expectRecoveryState(recoveryStates[0]);
  });

  it('every installed copy resumes implementation after the decision', () => {
    expectRecoveryState(recoveryStates[1]);
  });

  it('every installed copy repeats an outstanding verification decision', () => {
    expectRecoveryState(recoveryStates[2]);
  });

  it('every installed copy resumes verification after the decision', () => {
    expectRecoveryState(recoveryStates[3]);
  });

  it('every installed copy returns from Draft evidence to delivery', () => {
    for (const path of prReadinessCopies) {
      const content = readRaw(path);
      const startMarker = '## Observe and preserve';
      const endMarker = '## Seven hard Ready-for-Review gates';
      const start = content.indexOf(startMarker);
      const end = content.indexOf(endMarker, start + startMarker.length);

      expect(start, `missing Draft-section start in ${path}`).toBeGreaterThanOrEqual(0);
      expect(end, `missing Draft-section end in ${path}`).toBeGreaterThan(start);
      const draftSection = content.slice(start, end).replaceAll(/\s+/gu, ' ');

      expect(draftSection).toContain(
        'After creating a Draft pull request for evidence, return directly to the next unfinished delivery step instead of reporting the change ready for review.',
      );
    }
  });

  it('routes Cursor PR-readiness guidance to the canonical installed contract', () => {
    expect(read('.cursor/rules/safeword-pr-readiness.mdc')).toContain(
      '@.safeword/skills/pr-readiness/SKILL.md',
    );
  });
});

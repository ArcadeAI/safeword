/**
 * Unit tests for the impl-plan parser + section validation (ticket XDNSZA).
 * Covers test-definitions.md Rules 1-2. Pure functions — no filesystem.
 */

import { readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

import { IMPL_PLAN_SECTIONS, parseImplPlan } from '../../templates/hooks/lib/impl-plan.js';

const FIVE_SECTIONS = `## Approach

Build the thing in one slice.

## Decisions

| Decision | Choice | Alternatives considered | Rejected because |
| -------- | ------ | ----------------------- | ---------------- |
| Storage  | File   | DB                      | Overkill         |

## Arch alignment

Honors the sibling-artifact pattern.

## Known deviations

None.

## Assessment triggers

Revisit past 10x load.
`;

function plan(status: string, body: string = FIVE_SECTIONS): string {
  return `# Impl Plan: x\n\n**Status:** ${status}\n\n${body}`;
}

describe('parseImplPlan status lifecycle (Rule 1)', () => {
  it('reports status planned', () => {
    const result = parseImplPlan(plan('planned'));
    expect(result.status).toBe('planned');
  });

  it('reports status implemented', () => {
    const result = parseImplPlan(plan('implemented'));
    expect(result.status).toBe('implemented');
  });

  it('reports a validation error when the status line is missing', () => {
    const result = parseImplPlan(`# Impl Plan: x\n\n${FIVE_SECTIONS}`);
    expect(result.status).toBeNull();
    expect(result.errors.some(error => error.includes('**Status:**'))).toBe(true);
  });

  it('reports a validation error listing allowed values for an unknown status', () => {
    const result = parseImplPlan(plan('shipped'));
    expect(result.status).toBeNull();
    expect(
      result.errors.some(error => error.includes('planned') && error.includes('implemented')),
    ).toBe(true);
  });
});

const SECTION_BODIES: Record<string, string> = {
  Approach: 'Build the thing in one slice.',
  Decisions:
    '| Decision | Choice | Alternatives considered | Rejected because |\n| - | - | - | - |\n| Storage | File | DB | Overkill |',
  'Arch alignment': 'Honors the sibling-artifact pattern.',
  'Known deviations': 'None.',
  'Assessment triggers': 'Revisit past 10x load.',
};

/** The five sections with selected bodies overridden (empty string = blank section). */
function sectionsWith(overrides: Record<string, string> = {}): string {
  return Object.entries({ ...SECTION_BODIES, ...overrides })
    .map(([name, body]) => (body === '' ? `## ${name}\n` : `## ${name}\n\n${body}\n`))
    .join('\n');
}

/** The five sections minus one heading entirely. */
function sectionsWithout(omitted: string): string {
  return Object.entries(SECTION_BODIES)
    .filter(([name]) => name !== omitted)
    .map(([name, body]) => `## ${name}\n\n${body}\n`)
    .join('\n');
}

describe('parseImplPlan section validation (Rule 2)', () => {
  it('reports a populated section as satisfied', () => {
    const result = parseImplPlan(plan('planned'));
    expect(result.sections.Decisions?.satisfied).toBe(true);
    expect(result.sections.Decisions?.skip).toBeNull();
  });

  it('reports a skip-annotated section as satisfied with its reason preserved', () => {
    const result = parseImplPlan(
      plan('planned', sectionsWith({ 'Arch alignment': 'skip: no ADRs in this project yet' })),
    );
    expect(result.sections['Arch alignment']?.satisfied).toBe(true);
    expect(result.sections['Arch alignment']?.skip).toBe('no ADRs in this project yet');
    expect(result.errors).toEqual([]);
  });

  it('treats HTML-comment-only content as empty', () => {
    const result = parseImplPlan(
      plan('planned', sectionsWith({ Approach: '<!-- guidance comment\nspanning lines -->' })),
    );
    expect(result.sections.Approach?.satisfied).toBe(false);
    expect(result.errors.some(error => error.includes('Approach') && error.includes('empty'))).toBe(
      true,
    );
  });

  it('reports a missing section heading as invalid, naming it', () => {
    const result = parseImplPlan(plan('planned', sectionsWithout('Assessment triggers')));
    expect(result.sections['Assessment triggers']).toBeUndefined();
    expect(
      result.errors.some(
        error => error.includes('Assessment triggers') && error.includes('Missing'),
      ),
    ).toBe(true);
  });

  it('reports an empty unskipped section as invalid, naming it', () => {
    const result = parseImplPlan(plan('planned', sectionsWith({ Approach: '' })));
    expect(result.sections.Approach?.satisfied).toBe(false);
    expect(result.errors.some(error => error.includes('Approach') && error.includes('empty'))).toBe(
      true,
    );
  });

  it('reports a whitespace-only skip reason as invalid, naming the section', () => {
    const result = parseImplPlan(
      plan('planned', sectionsWith({ 'Assessment triggers': 'skip:   ' })),
    );
    expect(result.sections['Assessment triggers']?.satisfied).toBe(false);
    expect(
      result.errors.some(
        error => error.includes('Assessment triggers') && error.includes('non-empty reason'),
      ),
    ).toBe(true);
  });

  it('reports a bare skip: as invalid, naming the section and the empty-reason rule', () => {
    const result = parseImplPlan(plan('planned', sectionsWith({ 'Known deviations': 'skip:' })));
    expect(result.sections['Known deviations']?.satisfied).toBe(false);
    expect(
      result.errors.some(
        error => error.includes('Known deviations') && error.includes('non-empty reason'),
      ),
    ).toBe(true);
  });
});

describe('impl-plan docs (Rule 4)', () => {
  const repoRoot = nodePath.join(__dirname, '../../../..');
  const copies = [
    nodePath.join(repoRoot, 'packages/cli/templates/skills/bdd'),
    nodePath.join(repoRoot, '.claude/skills/bdd'),
  ];

  it('SCENARIOS.md gate exit and TDD.md entry reference impl-plan.md in both copies', () => {
    for (const skillDirectory of copies) {
      const scenarios = readFileSync(nodePath.join(skillDirectory, 'SCENARIOS.md'), 'utf8');
      const tdd = readFileSync(nodePath.join(skillDirectory, 'TDD.md'), 'utf8');
      expect(scenarios, `${skillDirectory}/SCENARIOS.md`).toContain('impl-plan.md');
      for (const section of IMPL_PLAN_SECTIONS) {
        expect(scenarios, `${skillDirectory}/SCENARIOS.md section ${section}`).toContain(section);
      }
      expect(tdd, `${skillDirectory}/TDD.md`).toContain('impl-plan.md');
    }
  });
});

describe('impl-plan template (Rule 4)', () => {
  it('parses the shipped template as unfilled — guidance comments are not content', () => {
    const template = readFileSync(
      nodePath.join(__dirname, '../../templates/doc-templates/impl-plan-template.md'),
      'utf8',
    );
    const result = parseImplPlan(template);
    for (const name of IMPL_PLAN_SECTIONS) {
      expect(result.sections[name]?.satisfied, `section ${name}`).toBe(false);
    }
  });
});

describe('Doc impact optional section (TXRHMD, decision 22)', () => {
  it('accepts a legacy five-section plan with no Doc impact section', () => {
    const parsed = parseImplPlan(plan('planned'));
    expect(parsed.errors).toEqual([]);
  });

  it('validates a present Doc impact section: content satisfies', () => {
    const parsed = parseImplPlan(
      plan('planned', `${FIVE_SECTIONS}\n## Doc impact\n\nUpdate the README quickstart.\n`),
    );
    expect(parsed.errors).toEqual([]);
  });

  it('validates a present Doc impact section: skip with reason satisfies', () => {
    const parsed = parseImplPlan(
      plan(
        'planned',
        `${FIVE_SECTIONS}\n## Doc impact\n\nskip: no customer-visible behavior change\n`,
      ),
    );
    expect(parsed.errors).toEqual([]);
  });

  it('rejects a present but empty Doc impact section, naming it', () => {
    const parsed = parseImplPlan(plan('planned', `${FIVE_SECTIONS}\n## Doc impact\n`));
    expect(parsed.errors.join(' ')).toContain('Doc impact');
  });

  it('ships the Doc impact section in the template, wired to docs.sources', () => {
    const repoRoot = nodePath.resolve(__dirname, '../../../..');
    for (const templatePath of [
      nodePath.join(repoRoot, 'packages/cli/templates/doc-templates/impl-plan-template.md'),
      nodePath.join(repoRoot, '.safeword/templates/impl-plan-template.md'),
    ]) {
      const template = readFileSync(templatePath, 'utf8');
      expect(template, templatePath).toContain('## Doc impact');
      expect(template, templatePath).toContain('docs.sources');
    }
  });
});

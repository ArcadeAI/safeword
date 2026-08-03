import { describe, expect, it } from 'vitest';

import { SETTINGS_HOOKS } from '../../src/templates/config.js';
import {
  DECISION_BRIEF_CONTRACT,
  evaluateDecisionBriefCompliance,
} from '../../templates/hooks/lib/quality.js';
import { appendDecisionBriefContract } from '../../templates/hooks/session-safeword-context.js';

describe('proactive decision-brief contract', () => {
  it.each(['startup', 'resume', 'clear', 'compact', 'fork'])(
    'adds the exact contract once for a Claude %s SessionStart',
    source => {
      const standingContext = 'SAFEWORD standing instructions';
      const context = appendDecisionBriefContract('claude', standingContext);

      expect(source).toBeTruthy();
      expect(context).toContain(standingContext);
      expect(context).toContain(DECISION_BRIEF_CONTRACT);
      expect(context.split(DECISION_BRIEF_CONTRACT)).toHaveLength(2);
      expect(context).not.toContain('Phase: implement. CONFIDENT cites');
    },
  );

  it('leaves non-Claude standing context unchanged', () => {
    expect(appendDecisionBriefContract('cursor', 'standing')).toBe('standing');
    expect(appendDecisionBriefContract('codex', 'standing')).toBe('standing');
  });

  it('configures one phase-neutral context command for every SessionStart source', () => {
    const contextEntries = SETTINGS_HOOKS.SessionStart.filter(entry =>
      entry.hooks.some(hook => hook.command.includes('session-safeword-context.ts')),
    );

    expect(contextEntries).toHaveLength(1);
    expect(contextEntries[0]).not.toHaveProperty('matcher');
  });
});

const CONFIDENT = [
  '**CONFIDENT** — The change is complete.',
  '**Decided:** Keep the implementation focused.',
  '**Open:** none.',
  '**Next:** Review the result.',
];
const BLOCKED = [
  '**BLOCKED** — A release target is required.',
  '**Tried:** Checked the ticket and release configuration.',
  '**Need:** Choose the intended release target.',
];
const brief = (paragraphs: string[], separator = '\n\n') => paragraphs.join(separator);

describe('terminal decision-brief parser', () => {
  it.each([
    [
      'CONFIDENT with optional Rejected',
      brief([
        CONFIDENT[0],
        CONFIDENT[1],
        '**Rejected:** A broader rewrite.',
        ...CONFIDENT.slice(2),
      ]),
    ],
    ['CONFIDENT without Rejected', brief(CONFIDENT)],
    ['CONFIDENT with CRLF', brief(CONFIDENT, '\r\n\r\n')],
    ['BLOCKED', brief(BLOCKED)],
    ['BLOCKED with CRLF', brief(BLOCKED, '\r\n\r\n')],
  ])('accepts %s deterministically', (_name, reply) => {
    expect(evaluateDecisionBriefCompliance(reply).compliant).toBe(true);
    expect(evaluateDecisionBriefCompliance(reply)).toEqual(evaluateDecisionBriefCompliance(reply));
  });

  const fenced = ['```md', ...CONFIDENT, '```'].join('\n\n');
  const ignoredOnly = [
    ['blockquote', brief(CONFIDENT.map(paragraph => `> ${paragraph}`))],
    ['list item', brief(CONFIDENT.map(paragraph => `- ${paragraph}`))],
    ['fenced block', fenced],
    ['indented code', brief(CONFIDENT.map(paragraph => `    ${paragraph}`))],
    ['HTML comment', `<!--\n${brief(CONFIDENT)}\n-->`],
    ['HTML block', `<div>\n${brief(CONFIDENT)}\n</div>`],
  ] as const;

  it.each([
    ['no verdict', 'Implemented and tested.'],
    ['both verdicts', `${brief(CONFIDENT)}\n\n${brief(BLOCKED)}`],
    ['two identical verdicts', `${brief(CONFIDENT)}\n\n${brief(CONFIDENT)}`],
    ...ignoredOnly.map(([name, reply]) => [`template only inside ${name}`, reply] as const),
    [
      'verdict mentioned in prose',
      `The result is **CONFIDENT** but this is prose.\n\n${brief(CONFIDENT.slice(1))}`,
    ],
    ['labels before terminal block', `**Open:** none.\n\n${brief(CONFIDENT)}`],
    ['wrong order', brief([CONFIDENT[0], CONFIDENT[2], CONFIDENT[1], CONFIDENT[3]])],
    ['duplicate Decided', brief([CONFIDENT[0], CONFIDENT[1], CONFIDENT[1], ...CONFIDENT.slice(2)])],
    [
      'duplicate Rejected',
      brief([
        CONFIDENT[0],
        CONFIDENT[1],
        '**Rejected:** A.',
        '**Rejected:** B.',
        ...CONFIDENT.slice(2),
      ]),
    ],
    [
      'duplicate Open',
      brief([CONFIDENT[0], CONFIDENT[1], CONFIDENT[2], CONFIDENT[2], CONFIDENT[3]]),
    ],
    ['duplicate Next', brief([...CONFIDENT, CONFIDENT[3]])],
    ['duplicate Tried', brief([BLOCKED[0], BLOCKED[1], BLOCKED[1], BLOCKED[2]])],
    ['duplicate Need', brief([...BLOCKED, BLOCKED[2]])],
    [
      'Rejected after Open',
      brief([CONFIDENT[0], CONFIDENT[1], CONFIDENT[2], '**Rejected:** Too late.', CONFIDENT[3]]),
    ],
    ['BLOCKED without Tried', brief([BLOCKED[0], BLOCKED[2]])],
    ['BLOCKED without Need', brief(BLOCKED.slice(0, 2))],
    ['BLOCKED Need before Tried', brief([BLOCKED[0], BLOCKED[2], BLOCKED[1]])],
    ['BLOCKED with Next', brief([...BLOCKED, CONFIDENT[3]])],
    ['trailing prose', `${brief(CONFIDENT)}\n\nOne more thing.`],
    ['empty body', brief([CONFIDENT[0], CONFIDENT[1], '**Open:**   ', CONFIDENT[3]])],
  ])('rejects %s deterministically', (_name, reply) => {
    expect(evaluateDecisionBriefCompliance(reply).compliant).toBe(false);
    expect(evaluateDecisionBriefCompliance(reply)).toEqual(evaluateDecisionBriefCompliance(reply));
  });

  it.each([
    ...ignoredOnly,
    ['ordinary prose', 'An earlier paragraph says CONFIDENT and **Next:** informally.'],
  ])('ignores %s before a valid top-level brief', (_name, ignored) => {
    expect(evaluateDecisionBriefCompliance(`${ignored}\n\n${brief(CONFIDENT)}`).compliant).toBe(
      true,
    );
  });

  it('reports a fixed linear examined-character bound', () => {
    for (const size of [1024, 2048, 4096]) {
      const reply = `${'x'.repeat(size)}\n\n${fenced}`;
      const result = evaluateDecisionBriefCompliance(reply);
      expect(result.compliant).toBe(false);
      expect(result.examinedCharacters).toBeLessThanOrEqual(reply.length * 4);
    }
  });
});

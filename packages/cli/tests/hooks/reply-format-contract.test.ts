import { readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

import { SETTINGS_HOOKS } from '../../src/templates/config.js';
import {
  DECISION_BRIEF_CONTRACT,
  DECISION_BRIEF_GRAMMAR,
  DECISION_BRIEF_MAX_WORK_FACTOR,
  evaluateDecisionBriefCompliance,
  GENERIC_REVIEW_EVIDENCE,
  renderDecisionBriefContract,
  renderDecisionBriefCorrection,
} from '../../templates/hooks/lib/quality.js';
import { createDecisionBriefContextResponse } from '../../templates/hooks/session-reply-format.js';

describe('proactive decision-brief contract', () => {
  it.each(['startup', 'resume', 'clear', 'compact', 'fork'])(
    'adds the exact contract once for a Claude %s SessionStart',
    source => {
      const response = createDecisionBriefContextResponse('claude');
      const context = JSON.parse(response ?? '{}').hookSpecificOutput.additionalContext as string;

      expect(source).toBeTruthy();
      expect(context).toBe(DECISION_BRIEF_CONTRACT);
      expect(context.length).toBeLessThan(10_000);
      expect(context).not.toContain('Phase: implement. CONFIDENT cites');
    },
  );

  it('leaves non-Claude standing context unchanged', () => {
    expect(createDecisionBriefContextResponse('cursor')).toBeUndefined();
    expect(createDecisionBriefContextResponse('codex')).toBeUndefined();
  });

  it('configures one phase-neutral context command for every SessionStart source', () => {
    const replyEntries = SETTINGS_HOOKS.SessionStart.filter(entry =>
      entry.hooks.some(hook => hook.command.includes('session-reply-format.ts')),
    );
    const standingEntries = SETTINGS_HOOKS.SessionStart.filter(entry =>
      entry.hooks.some(hook => hook.command.includes('session-safeword-context.ts')),
    );

    expect(replyEntries).toHaveLength(1);
    expect(replyEntries[0]).not.toHaveProperty('matcher');
    expect(standingEntries).toHaveLength(1);
  });

  it('keeps generated plugin SessionStart outputs at separate host boundaries', () => {
    const manifest = JSON.parse(
      readFileSync(
        nodePath.resolve(import.meta.dirname, '../../../../plugin/hooks/hooks.json'),
        'utf8',
      ),
    ) as {
      hooks: { SessionStart: { hooks: { command: string }[] }[] };
    };
    const commands = manifest.hooks.SessionStart.flatMap(entry =>
      entry.hooks.map(hook => hook.command),
    );

    expect(commands).toHaveLength(10);
    expect(commands).not.toContain(expect.stringContaining('--event-group'));
    expect(commands.filter(command => command.includes('session-reply-format.ts'))).toHaveLength(1);
  });

  it('derives rendered wording and validation from one grammar fixture', () => {
    const changed = structuredClone(DECISION_BRIEF_GRAMMAR);
    const openParagraph = changed.variants.CONFIDENT.paragraphs[2];
    if (!openParagraph) throw new Error('CONFIDENT grammar fixture is incomplete');
    openParagraph.label = 'Risks';
    const changedReply = brief([CONFIDENT[0], CONFIDENT[1], '**Risks:** none.', CONFIDENT[3]]);

    expect(renderDecisionBriefContract(changed)).toContain('**Risks:**');
    expect(renderDecisionBriefContract(changed)).not.toContain('**Open:**');
    expect(evaluateDecisionBriefCompliance(changedReply, changed).compliant).toBe(true);
    expect(evaluateDecisionBriefCompliance(brief(CONFIDENT), changed).compliant).toBe(false);
  });
});

const CONFIDENT = [
  '**CONFIDENT** — The change is complete.',
  '**Decided:** Keep the implementation focused.',
  '**Open:** none.',
  '**Next:** Review the result.',
] as const;
const BLOCKED = [
  '**BLOCKED** — A release target is required.',
  '**Tried:** Checked the ticket and release configuration.',
  '**Need:** Choose the intended release target.',
] as const;
const brief = (paragraphs: readonly string[], separator = '\n\n') => paragraphs.join(separator);

describe('terminal decision-brief parser', () => {
  it('renders a self-contained phase-neutral correction when no verdict is recognized', () => {
    const evaluation = evaluateDecisionBriefCompliance('Defined the upload scope.');
    const correction = renderDecisionBriefCorrection(evaluation, GENERIC_REVIEW_EVIDENCE);

    expect(evaluation.violation).toEqual({ kind: 'verdict-count', count: 0 });
    expect(correction).toContain('no recognized verdict');
    expect(correction).toMatch(/\*\*CONFIDENT\*\*[^\n]*\n\n\*\*Decided:\*\*/u);
    expect(correction).toMatch(/\*\*BLOCKED\*\*[^\n]*\n\n\*\*Tried:\*\*/u);
    expect(correction).toContain('only if human input is required');
    expect(correction).toContain(GENERIC_REVIEW_EVIDENCE);
    expect(correction).not.toContain('Phase: implement');
    expect(correction).not.toContain('Apply SAFEWORD.md');
    expect(correction.length).toBeLessThan(DECISION_BRIEF_CONTRACT.length);
  });

  it.each([
    ['multiple verdicts', `${brief(CONFIDENT)}\n\n${brief(BLOCKED)}`, 'verdict-count'],
    ['labels before verdict', `**Open:** none.\n\n${brief(CONFIDENT)}`, 'labels-before-verdict'],
    [
      'wrong label sequence',
      brief([CONFIDENT[0], CONFIDENT[2], CONFIDENT[1], CONFIDENT[3]]),
      'label-sequence',
    ],
  ])('classifies %s for a specific correction', (_name, reply, expectedKind) => {
    expect(evaluateDecisionBriefCompliance(reply).violation?.kind).toBe(expectedKind);
  });

  it('uses a self-contained generic correction when no classified violation is available', () => {
    const correction = renderDecisionBriefCorrection(
      { compliant: false, examinedCharacters: 0 },
      GENERIC_REVIEW_EVIDENCE,
    );

    expect(correction).toContain('does not match the decision-brief grammar');
    expect(correction).toContain('**CONFIDENT**');
    expect(correction).toContain('**BLOCKED**');
    expect(correction).toContain(GENERIC_REVIEW_EVIDENCE);
  });

  it('rejects prototype property names as unrecognized verdicts', () => {
    const evaluation = evaluateDecisionBriefCompliance('**toString** — Looks plausible.');

    expect(evaluation).toMatchObject({
      compliant: false,
      violation: { kind: 'verdict-count', count: 0 },
    });
  });

  it('recognizes a valid brief after a blank line ends a generic HTML block', () => {
    const reply = `<span>\n\n${brief(CONFIDENT)}`;

    expect(evaluateDecisionBriefCompliance(reply).compliant).toBe(true);
  });

  it('recognizes a valid brief after a blank line ends block-tag HTML', () => {
    const reply = `<div>\nexample\n\n${brief(CONFIDENT)}`;

    expect(evaluateDecisionBriefCompliance(reply).compliant).toBe(true);
  });

  it('recognizes lone carriage returns as CommonMark line endings', () => {
    expect(evaluateDecisionBriefCompliance(brief(CONFIDENT, '\r\r')).compliant).toBe(true);
  });

  it.each([
    ['verdict', `${brief(CONFIDENT, '\r\r')}\r\r${BLOCKED[0]}`],
    ['label', `${brief(CONFIDENT, '\r\r')}\r\r**Open:** hidden.`],
  ])('rejects a trailing %s separated by lone carriage returns', (_name, reply) => {
    expect(evaluateDecisionBriefCompliance(reply).compliant).toBe(false);
  });

  it('keeps block-tag HTML active through a closing tag until a blank line', () => {
    const reply = `<div>\nexample\n</div>\n${brief(CONFIDENT)}`;

    expect(evaluateDecisionBriefCompliance(reply).compliant).toBe(false);
  });

  it.each([
    ['unclosed HTML comment', '<!--'],
    ['unclosed raw HTML tag', '<script>'],
    ['list-looking content', '- example'],
  ])('keeps %s inside a closed fence opaque', (_name, example) => {
    const reply = `\`\`\`md\n${example}\n\`\`\`\n${brief(CONFIDENT)}`;

    expect(evaluateDecisionBriefCompliance(reply).compliant).toBe(true);
  });

  it.each([
    ['backtick', '```'],
    ['tilde', '~~~'],
  ])('does not treat a %s fence with trailing text as a closing fence', (_name, fence) => {
    const reply = `${fence}\nexample\n${fence}not-closed\n${brief(CONFIDENT)}`;

    expect(evaluateDecisionBriefCompliance(reply).compliant).toBe(false);
  });

  it.each([
    ['single-line HTML comment', '<!-- example -->'],
    ['multiline HTML comment', '<!--\nexample\n-->'],
    ['single-line raw HTML tag', '<script>example</script>'],
    ['multiline raw HTML tag', '<script>\nexample\n</script>'],
    ['CDATA block', '<![CDATA[example]]>'],
    ['processing instruction', '<?example?>'],
    ['declaration', '<!DOCTYPE html>'],
  ])('recognizes a valid brief immediately after a closed %s', (_name, html) => {
    expect(evaluateDecisionBriefCompliance(`${html}\n${brief(CONFIDENT)}`).compliant).toBe(true);
  });

  it.each([
    ['fenced block', '```text\ntrailing\n```'],
    ['blockquote', '> trailing'],
    ['list', '- trailing'],
    ['indented code', '    trailing'],
    ['HTML block', '<div>\ntrailing'],
    ['HTML comment', '<!-- trailing -->'],
  ])('rejects %s after an otherwise valid terminal brief', (_name, trailing) => {
    expect(evaluateDecisionBriefCompliance(`${brief(CONFIDENT)}\n\n${trailing}`).compliant).toBe(
      false,
    );
  });

  it.each([
    ['label before a fence', `**Open:** must remain visible.\n\`\`\`\nexample\n\`\`\``],
    ['extra verdict before an HTML block', `${CONFIDENT[0]}\n<div>\nexample\n</div>`],
    ['extra verdict before a list', `${CONFIDENT[0]}\n- example`],
  ])('keeps top-level content visible when interrupted by %s', (_name, prefix) => {
    expect(evaluateDecisionBriefCompliance(`${prefix}\n\n${brief(CONFIDENT)}`).compliant).toBe(
      false,
    );
  });

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
  const nestedBulletBrief = brief(CONFIDENT.map(paragraph => `  ${paragraph}`));
  const orderedListBrief = brief(CONFIDENT.map(paragraph => ' '.repeat(3) + paragraph));
  const ignoredOnly: readonly (readonly [string, string])[] = [
    ['blockquote', brief(CONFIDENT.map(paragraph => `> ${paragraph}`))],
    ['list item', brief(CONFIDENT.map(paragraph => `- ${paragraph}`))],
    ['fenced block', fenced],
    ['indented code', brief(CONFIDENT.map(paragraph => `    ${paragraph}`))],
    ['HTML comment', `<!--\n${brief(CONFIDENT)}\n-->`],
    ['HTML block', `<div>\n${brief(CONFIDENT, '\n')}\n</div>`],
    ['nested bullet continuation', `- example\n\n${nestedBulletBrief}`],
    ['ordered-list continuation', `1. example\n\n${orderedListBrief}`],
    ['HTML declaration', `<!DOCTYPE html\n${brief(CONFIDENT)}\n>`],
    ['HTML processing instruction', `<?example\n${brief(CONFIDENT)}\n?>`],
    ['HTML CDATA block', `<![CDATA[\n${brief(CONFIDENT)}\n]]>`],
    ['multiline script block', `<script\n${brief(CONFIDENT)}\n</script>`],
    ['multiline generic HTML block', `<div\n${brief(CONFIDENT, '\n')}\n</div>`],
    ['lowercase HTML declaration', `<!doctype\n${brief(CONFIDENT)}\n>`],
  ];

  const rejectedCases: readonly (readonly [string, string])[] = [
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
  ];

  it.each(rejectedCases)('rejects %s deterministically', (_name, reply) => {
    expect(evaluateDecisionBriefCompliance(reply).compliant).toBe(false);
    expect(evaluateDecisionBriefCompliance(reply)).toEqual(evaluateDecisionBriefCompliance(reply));
  });

  const ignoredBeforeValid: readonly (readonly [string, string])[] = [
    ...ignoredOnly,
    ['ordinary prose', 'An earlier paragraph says CONFIDENT and **Next:** informally.'],
  ];

  it.each(ignoredBeforeValid)('ignores %s before a valid top-level brief', (_name, ignored) => {
    expect(evaluateDecisionBriefCompliance(`${ignored}\n\n${brief(CONFIDENT)}`).compliant).toBe(
      true,
    );
  });

  it.each(['**Tests:** 89 passed.', '**Summary:** Implemented it.'])(
    'allows an unrelated labelled paragraph before the terminal brief: %s',
    paragraph => {
      expect(evaluateDecisionBriefCompliance(`${paragraph}\n\n${brief(CONFIDENT)}`).compliant).toBe(
        true,
      );
    },
  );

  it('reports a fixed linear examined-character bound', () => {
    for (const size of [1024, 2048, 4096]) {
      const reply = `${'x'.repeat(size)}\n\n${fenced}`;
      const result = evaluateDecisionBriefCompliance(reply);
      expect(result.compliant).toBe(false);
      expect(result.examinedCharacters).toBeGreaterThan(reply.length);
      expect(result.examinedCharacters).toBeLessThanOrEqual(
        reply.length * DECISION_BRIEF_MAX_WORK_FACTOR,
      );
    }
  });
});

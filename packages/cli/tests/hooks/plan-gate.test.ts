import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

import { evaluateImplementEntry } from '../../templates/hooks/lib/plan-gate.js';
import { createTemporaryDirectory, removeTemporaryDirectory, writeTestFile } from '../helpers.js';

const VALID_INSPIRATION = [
  '### Implementation Inspiration',
  '',
  '| Reference | Checked on | Source version | Target version | Evidence of fit | Principle to borrow | Mismatch / license / security boundary |',
  '| --- | --- | --- | --- | --- | --- | --- |',
  '| https://spec.commonmark.org/0.31.2/ | 2026-08-09 | 0.31.2 | 0.31.2 | Defines comments | Exact marker | Accept strict subset |',
  '',
  '**Decision impact:** retained: exact markers fit the design',
].join('\n');

function plan(inspiration: string): string {
  return [
    '# Impl Plan: Test',
    '',
    '**Status:** planned',
    '**Planned on:** 2026-08-09',
    '',
    '## Approach',
    '',
    'Build one validated slice.',
    '',
    '## Decisions',
    '',
    inspiration,
    '',
    '### Recorded Decisions',
    '',
    '| Decision | Choice | Alternatives considered | Rejected because |',
    '| --- | --- | --- | --- |',
    '| parser | https://spec.commonmark.org/0.31.2/ | full Markdown | strict subset |',
    '',
    '## Design alignment',
    '',
    'Exact structure proves the boundary.',
    '',
    '## Known deviations',
    '',
    'skip: no deviations',
    '',
    '## Assessment triggers',
    '',
    'Revisit for v2.',
  ].join('\n');
}

describe('implementation entry inspiration wiring', () => {
  it('blocks and then accepts evidence through the real plan parser and gate', () => {
    const projectDirectory = createTemporaryDirectory();
    const ticketDirectory = nodePath.join(projectDirectory, 'ticket');
    try {
      writeTestFile(
        projectDirectory,
        'ticket/ticket.md',
        [
          '---',
          'inspiration_contract: v1',
          'inspiration_contract_scaffold: v1',
          'created: 2026-08-09T00:00:00.000Z',
          '---',
        ].join('\n'),
      );
      writeTestFile(
        projectDirectory,
        'ticket/spec.md',
        '# Spec\n<!-- safeword:inspiration-contract:v1 -->\n',
      );
      writeTestFile(projectDirectory, 'ticket/impl-plan.md', plan('No evidence yet.'));

      const blocked = evaluateImplementEntry(ticketDirectory, {
        evaluationDate: '2026-08-09',
      });
      expect(blocked.ok).toBe(false);
      if (!blocked.ok) expect(blocked.reason).toContain('Implementation Inspiration');

      writeTestFile(projectDirectory, 'ticket/impl-plan.md', plan(VALID_INSPIRATION));

      expect(evaluateImplementEntry(ticketDirectory, { evaluationDate: '2026-08-09' })).toEqual({
        ok: true,
      });
    } finally {
      removeTemporaryDirectory(projectDirectory);
    }
  });
});

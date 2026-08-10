import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

import { evaluateImplementEntry } from '../../templates/hooks/lib/plan-gate.js';
import { validImplementationInspiration } from '../fixtures/inspiration.js';
import { createTemporaryDirectory, removeTemporaryDirectory, writeTestFile } from '../helpers.js';

const VALID_INSPIRATION = validImplementationInspiration('2026-08-09', 'parser');

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
    '## Doc impact',
    '',
    'skip: fixture has no customer-visible documentation change',
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

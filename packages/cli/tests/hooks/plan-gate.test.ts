import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';

import { evaluateImplementEntry } from '../../templates/hooks/lib/plan-gate.js';
import { validImplementationInspiration } from '../fixtures/inspiration.js';
import { createTemporaryDirectory, removeTemporaryDirectory, writeTestFile } from '../helpers.js';

const VALID_INSPIRATION = validImplementationInspiration('2026-08-09', 'parser');

function plan(
  inspiration: string,
  designAlignment = 'Exact structure proves the boundary.',
): string {
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
    designAlignment,
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
        projectDirectory,
      });
      expect(blocked.ok).toBe(false);
      if (!blocked.ok) expect(blocked.reason).toContain('Implementation Inspiration');

      writeTestFile(projectDirectory, 'ticket/impl-plan.md', plan(VALID_INSPIRATION));

      expect(
        evaluateImplementEntry(ticketDirectory, {
          evaluationDate: '2026-08-09',
          projectDirectory,
        }),
      ).toEqual({
        ok: true,
      });
    } finally {
      removeTemporaryDirectory(projectDirectory);
    }
  });
});

describe('implementation entry principle trace wiring', () => {
  function traceTable(principle: string): string {
    return [
      '| Principle | Consequence | Proof | Conflict |',
      '| --- | --- | --- | --- |',
      `| ${principle} | Recovery stays in context | evidence.md | |`,
    ].join('\n');
  }

  function scaffold(projectDirectory: string): void {
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
    writeTestFile(
      projectDirectory,
      '.project/principles.md',
      '# Principles\n\n## Keep customer PII out of logs\n\nRedaction happens before any log write.\n',
    );
    writeTestFile(projectDirectory, 'evidence.md', '# Evidence\n');
  }

  it('refuses entry while the trace cites a principle the source does not define', () => {
    const projectDirectory = createTemporaryDirectory();
    const ticketDirectory = nodePath.join(projectDirectory, 'ticket');
    try {
      scaffold(projectDirectory);
      writeTestFile(
        projectDirectory,
        'ticket/impl-plan.md',
        plan(VALID_INSPIRATION, traceTable('Invented principle')),
      );

      const verdict = evaluateImplementEntry(ticketDirectory, {
        evaluationDate: '2026-08-09',
        projectDirectory,
      });

      expect(verdict.ok).toBe(false);
      if (!verdict.ok) {
        expect(verdict.reason).toContain('missing source principle: Invented principle');
        expect(verdict.remediation).toContain('Design alignment');
      }
    } finally {
      removeTemporaryDirectory(projectDirectory);
    }
  });

  it('admits a trace whose principle resolves against the authored source', () => {
    const projectDirectory = createTemporaryDirectory();
    const ticketDirectory = nodePath.join(projectDirectory, 'ticket');
    try {
      scaffold(projectDirectory);
      writeTestFile(
        projectDirectory,
        'ticket/impl-plan.md',
        plan(VALID_INSPIRATION, traceTable('Keep customer PII out of logs')),
      );

      expect(
        evaluateImplementEntry(ticketDirectory, {
          evaluationDate: '2026-08-09',
          projectDirectory,
        }),
      ).toEqual({ ok: true });
    } finally {
      removeTemporaryDirectory(projectDirectory);
    }
  });
});

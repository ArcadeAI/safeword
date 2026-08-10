import { describe, expect, it } from 'vitest';

import {
  evaluateFeatureTicketReadiness,
  formatFeatureTicketReadiness,
} from '../../templates/hooks/lib/active-ticket.js';
import { createTemporaryDirectory, removeTemporaryDirectory, writeTestFile } from '../helpers.js';

function withProject(run: (projectDirectory: string) => void): void {
  const projectDirectory = createTemporaryDirectory();
  try {
    run(projectDirectory);
  } finally {
    removeTemporaryDirectory(projectDirectory);
  }
}

function writeScopedFeatureTicket(projectDirectory: string): void {
  writeTestFile(
    projectDirectory,
    '.project/tickets/099-test/ticket.md',
    [
      '---',
      'id: 099',
      'type: feature',
      'phase: define-behavior',
      'scope: Build morning digest',
      'out_of_scope: Real-time alerts',
      'done_when: Daily digest delivered',
      '---',
      '# Test',
    ].join('\n'),
  );
}

describe('feature ticket readiness helper (#404)', () => {
  it('reports invalid spec content and invalid dimensions skip together', () => {
    withProject(projectDirectory => {
      writeScopedFeatureTicket(projectDirectory);
      writeTestFile(projectDirectory, '.project/personas.md', '## Technical Builder (TB)\n');
      writeTestFile(
        projectDirectory,
        '.project/tickets/099-test/spec.md',
        [
          '# Spec',
          '',
          '## Jobs To Be Done',
          '',
          '### feature-ticket-readiness.TB1 - Avoid late blocks',
          '',
          '**Persona:** Technical Builder (TB)',
          '',
          '> When I resume a feature ticket, I want readiness gaps listed early, so I can repair them once.',
        ].join('\n'),
      );
      writeTestFile(projectDirectory, '.project/tickets/099-test/dimensions.md', 'skip:\n');

      const readiness = evaluateFeatureTicketReadiness(projectDirectory, '099-test');

      expect(readiness.ok).toBe(false);
      const message = formatFeatureTicketReadiness(readiness);
      expect(message).toContain('criteria gate');
      expect(message).toContain('dimensions.md');
      expect(message).toContain('no reason after the colon');
    });
  });

  it('accepts complete frontmatter, spec skip, and dimensions skip with reasons', () => {
    withProject(projectDirectory => {
      writeScopedFeatureTicket(projectDirectory);
      writeTestFile(
        projectDirectory,
        '.project/tickets/099-test/spec.md',
        '# Spec\n\n## Jobs To Be Done\n\nskip: fixture deliberately omits JTBD details\n',
      );
      writeTestFile(
        projectDirectory,
        '.project/tickets/099-test/dimensions.md',
        'skip: single behavioral dimension, no partitioning to enumerate\n',
      );

      expect(evaluateFeatureTicketReadiness(projectDirectory, '099-test')).toEqual({
        ok: true,
        issues: [],
      });
    });
  });

  it('rejects an empty dimensions artifact', () => {
    withProject(projectDirectory => {
      writeScopedFeatureTicket(projectDirectory);
      writeTestFile(
        projectDirectory,
        '.project/tickets/099-test/spec.md',
        '# Spec\n\n## Jobs To Be Done\n\nskip: fixture deliberately omits JTBD details\n',
      );
      writeTestFile(projectDirectory, '.project/tickets/099-test/dimensions.md', '');

      const readiness = evaluateFeatureTicketReadiness(projectDirectory, '099-test');

      expect(readiness.ok).toBe(false);
      expect(formatFeatureTicketReadiness(readiness)).toContain('dimensions.md: empty');
    });
  });

  it('blocks and then accepts activated Product Inspiration through real readiness collaborators', () => {
    withProject(projectDirectory => {
      const ticketPath = '.project/tickets/099-test/ticket.md';
      writeTestFile(
        projectDirectory,
        ticketPath,
        [
          '---',
          'id: 099',
          'type: feature',
          'phase: define-behavior',
          'scope: Build morning digest',
          'out_of_scope: Real-time alerts',
          'done_when: Daily digest delivered',
          'inspiration_contract: v1',
          'inspiration_contract_scaffold: v1',
          'created: 2026-08-09T00:00:00.000Z',
          '---',
          '# Test',
        ].join('\n'),
      );
      writeTestFile(
        projectDirectory,
        '.project/tickets/099-test/spec.md',
        [
          '# Spec',
          '<!-- safeword:inspiration-contract:v1 -->',
          '',
          '## Jobs To Be Done',
          '',
          'skip: fixture deliberately omits JTBD details',
        ].join('\n'),
      );
      writeTestFile(
        projectDirectory,
        '.project/tickets/099-test/dimensions.md',
        'skip: single behavioral dimension, no partitioning to enumerate\n',
      );

      const blocked = evaluateFeatureTicketReadiness(projectDirectory, '099-test', {
        evaluationDate: '2026-08-09',
      });
      expect(blocked.ok).toBe(false);
      expect(formatFeatureTicketReadiness(blocked)).toContain('Product Inspiration');

      writeTestFile(
        projectDirectory,
        '.project/tickets/099-test/spec.md',
        [
          '# Spec',
          '<!-- safeword:inspiration-contract:v1 -->',
          '',
          '## Product Inspiration',
          '',
          '| Reference | Checked on | Source version / edition | Customer-value evidence | Principle to borrow | Non-copy boundary | Decision impact |',
          '| --- | --- | --- | --- | --- | --- | --- |',
          '| https://linear.app/docs/issue-templates | 2026-08-09 | n/a | Faster issue filing | Default good practice | Do not copy UI | retained: supports direction |',
          '',
          '## Jobs To Be Done',
          '',
          'skip: fixture deliberately omits JTBD details',
        ].join('\n'),
      );

      expect(
        evaluateFeatureTicketReadiness(projectDirectory, '099-test', {
          evaluationDate: '2026-08-09',
        }),
      ).toEqual({ ok: true, issues: [] });
    });
  });
});

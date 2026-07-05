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
});
